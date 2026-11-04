const { Prisma } = require('../generated/prisma/index.js');
const { encryptText, decryptText, encryptBytes, decryptBytes, blindIndex, getKey } = require('./fieldCrypto');

// model -> { column: kind }. kind: 'text' | 'date' (a Date stored as 'YYYY-MM-DD' text) | 'bytes'
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

// model -> { encrypted column: its blind-index column }. Equality filters on the left are
// rewritten to the right (login, invites and the unique-account check all look emails up).
const BLIND = {
  User: { email: 'emailHash' },
  Invitation: { email: 'emailHash' },
};

// model -> { relation field: model it holds }, from the generated schema
const RELATIONS = {};
for (const model of Prisma.dmmf.datamodel.models) {
  RELATIONS[model.name] = Object.fromEntries(model.fields.filter((f) => f.kind === 'object').map((f) => [f.name, f.type]));
}

const isBytes = (v) => v instanceof Uint8Array;
const isPlainObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v) && !(v instanceof Date) && !isBytes(v);
const aadFor = (model, field) => `${model}.${field}`;
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
  return kind === 'date' ? new Date(`${plain}T00:00:00Z`) : plain;
}

// Accepts `{ field: value }` and `{ field: { set: value } }`; refuses other write operators.
// A blind-indexed field also writes its index column, so the two can never disagree.
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

// Equality on a blind-indexed column becomes equality on its index. Anything else (contains,
// startsWith, ordering) cannot work on ciphertext, so it fails loudly instead of matching nothing.
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

// Rewrites a where clause (including filters through relations such as `user: { email }`)
// for the encrypted schema.
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

function assertNotSorted(model, orderBy) {
  if (Array.isArray(orderBy)) return orderBy.forEach((entry) => assertNotSorted(model, entry));
  if (!isPlainObject(orderBy)) return;
  for (const [key, value] of Object.entries(orderBy)) {
    if (FIELDS[model]?.[key]) throw new Error(`${model}.${key} is encrypted and cannot be used in orderBy`);
    if (RELATIONS[model]?.[key]) assertNotSorted(RELATIONS[model][key], value);
  }
}

// Decrypts in place (Prisma hands back fresh objects), walking nested relations by the schema.
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

function withColumnEncryption(client) {
  // Production fails at boot on a missing/invalid key instead of on the first request.
  if (process.env.NODE_ENV === 'production') getKey();
  return client.$extends({ name: 'column-encryption', query: { $allModels: { $allOperations: handler } } });
}

module.exports = { withColumnEncryption, handler, encryptData, rewriteWhere, decryptResult, FIELDS, BLIND, RELATIONS };
