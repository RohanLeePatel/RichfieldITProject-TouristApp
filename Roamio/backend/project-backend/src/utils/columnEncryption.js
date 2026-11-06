const { Prisma } = require('../generated/prisma/index.js');
const { encryptText, decryptText, encryptBytes, decryptBytes, blindIndex, getKey } = require('./fieldCrypto');

// Prisma client extension that encrypts PII at the ORM boundary, so services and
// repositories read and write plaintext and never see ciphertext. Every model listed
// in FIELDS is transparently encrypted on write and decrypted on read.
//
// The hard part is queries. Ciphertext can't be compared, sorted, or searched with
// LIKE, so this layer enforces one rule: encrypted columns support equality only,
// and only where a blind index exists. Anything else throws instead of silently
// returning zero rows, because an empty result would look like "no such user".

// Which columns are encrypted, and how each is serialized before encryption.
// 'date' values are stored as 'YYYY-MM-DD' text so that the day never shifts with
// the server's timezone; 'bytes' is for binary blobs such as uploaded documents.
const FIELDS = {
  TripDocument: { data: 'bytes' },
  PushSubscription: { p256dh: 'text', auth: 'text' },
  SavedTraveller: {
    firstName: 'text', lastName: 'text', relationship: 'text', nationality: 'text',
    email: 'text', phone: 'text', documentLast4: 'text',
    dateOfBirth: 'date', documentExpiry: 'date',
  },
  UserSession: { ipAddress: 'text', location: 'text' },
  LoginEvent: { ipAddress: 'text', location: 'text' },
  User: { email: 'text', fullName: 'text' },
  Invitation: { email: 'text' },
};

// Blind indexes let us find a row by an encrypted value. Each one is a keyed hash of
// the plaintext stored beside the ciphertext, so `where: { email }` can be rewritten
// to `where: { emailHash }`. Login, invitations and the unique-account check depend
// on this. Encryption itself is randomized, so it can't serve as a lookup key.
const BLIND = {
  User: { email: 'emailHash' },
  Invitation: { email: 'emailHash' },
};

// Relation fields per model, read from Prisma's generated schema (DMMF) instead of
// being hand-maintained. The where- and orderBy-walkers need them to follow filters
// and decryption into related models, such as `user: { email }` on a session.
const RELATIONS = {};
for (const model of Prisma.dmmf.datamodel.models) {
  RELATIONS[model.name] = Object.fromEntries(model.fields.filter((f) => f.kind === 'object').map((f) => [f.name, f.type]));
}

const isBytes = (v) => v instanceof Uint8Array;
const isPlainObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v) && !(v instanceof Date) && !isBytes(v);
// AAD (additional authenticated data) binds each ciphertext to its own column. A value
// copied from one column into another then fails authentication on decrypt, so an
// attacker with database write access can't swap encrypted values between fields.
const aadFor = (model, field) => `${model}.${field}`;
// Keeps only the calendar day, so a Date from any timezone encodes the same string.
const isoDay = (v) => (v instanceof Date ? v.toISOString().slice(0, 10) : String(v));

function encryptValue(model, field, kind, value) {
  if (value === null || value === undefined) return value;
  const aad = aadFor(model, field);
  if (kind === 'bytes') return encryptBytes(value, aad);
  return encryptText(kind === 'date' ? isoDay(value) : value, aad);
}

function decryptValue(model, field, kind, value) {
  if (value === null || value === undefined) return value;
  const aad = aadFor(model, field);
  if (kind === 'bytes') return decryptBytes(value, aad);
  const plain = decryptText(value, aad);
  // Rebuild the date at UTC midnight so it matches how the day was stored.
  return kind === 'date' ? new Date(`${plain}T00:00:00Z`) : plain;
}

// Encrypts the write payload for create, update, and upsert. Plain values and
// `{ set: value }` are the only supported forms. Operators such as `increment` can't
// run on ciphertext, so they are rejected. Writing the blind index in the same pass
// keeps it in step with the encrypted value, so lookups never miss a row.
function encryptData(model, data) {
  const fields = FIELDS[model];
  if (!fields || !isPlainObject(data)) return data;
  const out = { ...data };
  for (const [field, kind] of Object.entries(fields)) {
    if (!(field in out)) continue;
    const value = out[field];
    const plain = isPlainObject(value) ? value.set : value;
    if (isPlainObject(value) && !('set' in value)) throw new Error(`${model}.${field} is encrypted: unsupported write operator`);
    const indexColumn = BLIND[model]?.[field];
    if (indexColumn) out[indexColumn] = typeof plain === 'string' ? blindIndex(plain) : null;
    const sealed = encryptValue(model, field, kind, plain);
    out[field] = isPlainObject(value) ? { set: sealed } : sealed;
  }
  return out;
}

// Turns an equality filter on an encrypted field into an equality filter on its blind
// index. Prisma's `mode` option is ignored because the index is an exact-match hash.
// Operators that need the plaintext (contains, startsWith, ordering) throw here.
function blindFilter(model, field, indexColumn, value) {
  const unsupported = () => new Error(`${model}.${field} is encrypted: only equality (equals / in) filters are supported`);
  if (typeof value === 'string') return { [indexColumn]: blindIndex(value) };
  if (isPlainObject(value)) {
    const keys = Object.keys(value).filter((k) => k !== 'mode');
    if (keys.length === 1 && keys[0] === 'equals' && typeof value.equals === 'string') return { [indexColumn]: blindIndex(value.equals) };
    if (keys.length === 1 && keys[0] === 'in' && Array.isArray(value.in)) return { [indexColumn]: { in: value.in.map(blindIndex) } };
  }
  throw unsupported();
}

const RELATION_OPERATORS = ['is', 'isNot', 'some', 'every', 'none'];

// Rewrites a where clause for the encrypted schema. It recurses through AND/OR/NOT
// and into relation filters. A relation filter can be wrapped in a relation operator
// (`is`, `some`, ...) or given directly, so both shapes are handled.
function rewriteWhere(model, where) {
  if (Array.isArray(where)) return where.map((clause) => rewriteWhere(model, clause));
  if (!isPlainObject(where)) return where;
  const out = {};
  for (const [key, value] of Object.entries(where)) {
    if (key === 'AND' || key === 'OR' || key === 'NOT') {
      out[key] = rewriteWhere(model, value);
    } else if (BLIND[model]?.[key]) {
      Object.assign(out, blindFilter(model, key, BLIND[model][key], value));
    } else if (FIELDS[model]?.[key]) {
      throw new Error(`${model}.${key} is encrypted and cannot be used in where`);
    } else if (RELATIONS[model]?.[key] && isPlainObject(value)) {
      const target = RELATIONS[model][key];
      const wrapped = Object.keys(value).length > 0 && Object.keys(value).every((k) => RELATION_OPERATORS.includes(k));
      out[key] = wrapped
        ? Object.fromEntries(Object.entries(value).map(([op, inner]) => [op, rewriteWhere(target, inner)]))
        : rewriteWhere(target, value);
    } else {
      out[key] = value;
    }
  }
  return out;
}

// Ciphertext has no meaningful sort order, so ordering by an encrypted field would
// return rows in an arbitrary order. Fail loudly instead.
function assertNotSorted(model, orderBy) {
  if (Array.isArray(orderBy)) return orderBy.forEach((entry) => assertNotSorted(model, entry));
  if (!isPlainObject(orderBy)) return;
  for (const [key, value] of Object.entries(orderBy)) {
    if (FIELDS[model]?.[key]) throw new Error(`${model}.${key} is encrypted and cannot be used in orderBy`);
    if (RELATIONS[model]?.[key]) assertNotSorted(RELATIONS[model][key], value);
  }
}

// Decrypts results in place. Prisma returns freshly built objects, so mutating them
// is safe. Nested relation payloads are walked too, so an included User comes back
// with a readable email.
function decryptResult(model, result) {
  if (Array.isArray(result)) {
    result.forEach((row) => decryptResult(model, row));
    return result;
  }
  if (!isPlainObject(result)) return result;
  for (const [field, kind] of Object.entries(FIELDS[model] || {})) {
    if (field in result) result[field] = decryptValue(model, field, kind, result[field]);
  }
  for (const [relation, target] of Object.entries(RELATIONS[model] || {})) {
    if (result[relation] && typeof result[relation] === 'object') decryptResult(target, result[relation]);
  }
  return result;
}

// The single query hook for every model. Each operation goes through the same steps:
// rewrite filters, reject unsortable ordering, encrypt the payload, run the query, then
// decrypt the result.
async function handler({ model, args, query }) {
  const next = { ...args };
  if (next.where) next.where = rewriteWhere(model, next.where);
  if (FIELDS[model]) {
    assertNotSorted(model, next.orderBy);
    if (next.data) next.data = Array.isArray(next.data) ? next.data.map((d) => encryptData(model, d)) : encryptData(model, next.data);
    if (next.create) next.create = encryptData(model, next.create);
    if (next.update) next.update = encryptData(model, next.update);
  }
  return decryptResult(model, await query(next));
}

/**
 * Wraps a Prisma client so every query goes through column encryption.
 * Call once at startup and use the returned client everywhere.
 * @param {import('@prisma/client').PrismaClient} client
 * @returns {import('@prisma/client').PrismaClient} the extended client
 */
function withColumnEncryption(client) {
  // In production, a missing or malformed key stops the process at boot. The
  // alternative is failing on the first user request, which is much harder to diagnose.
  if (process.env.NODE_ENV === 'production') getKey();
  return client.$extends({ name: 'column-encryption', query: { $allModels: { $allOperations: handler } } });
}

module.exports = { withColumnEncryption, handler, encryptData, rewriteWhere, decryptResult, FIELDS, BLIND, RELATIONS };
