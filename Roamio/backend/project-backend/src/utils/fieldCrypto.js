const crypto = require('node:crypto');

const TEXT_PREFIX = 'enc:v1:';
const BYTES_MAGIC = Buffer.from('RMENC1');
const IV_LEN = 12;
const TAG_LEN = 16;

let cachedKey;

// APP_ENCRYPTION_KEY: 32 random bytes, base64. Losing it makes the encrypted columns unrecoverable.
function getKey() {
  if (cachedKey) return cachedKey;
  const raw = process.env.APP_ENCRYPTION_KEY;
  if (!raw) throw new Error('APP_ENCRYPTION_KEY is not set');
  const key = Buffer.from(raw, 'base64');
  if (key.length !== 32) throw new Error('APP_ENCRYPTION_KEY must be 32 bytes, base64-encoded');
  cachedKey = key;
  return key;
}

const toBuffer = (value) => (Buffer.isBuffer(value) ? value : Buffer.from(value.buffer, value.byteOffset, value.byteLength));

function seal(plaintext, aad) {
  const iv = crypto.randomBytes(IV_LEN);
  const cipher = crypto.createCipheriv('aes-256-gcm', getKey(), iv);
  cipher.setAAD(Buffer.from(aad));
  const body = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), body]);
}

function open(blob, aad) {
  const decipher = crypto.createDecipheriv('aes-256-gcm', getKey(), blob.subarray(0, IV_LEN));
  decipher.setAAD(Buffer.from(aad));
  decipher.setAuthTag(blob.subarray(IV_LEN, IV_LEN + TAG_LEN));
  return Buffer.concat([decipher.update(blob.subarray(IV_LEN + TAG_LEN)), decipher.final()]);
}

const isEncryptedText = (value) => typeof value === 'string' && value.startsWith(TEXT_PREFIX);
const isEncryptedBytes = (value) => value != null && toBuffer(value).subarray(0, BYTES_MAGIC.length).equals(BYTES_MAGIC);

function encryptText(value, aad) {
  if (value === null || value === undefined || value === '') return value;
  return TEXT_PREFIX + seal(Buffer.from(String(value), 'utf8'), aad).toString('base64');
}

// Anything without the prefix is legacy plaintext and passes through; a prefixed
// value that fails authentication throws (wrong key or tampering) rather than leaking garbage.
function decryptText(value, aad) {
  if (!isEncryptedText(value)) return value;
  return open(Buffer.from(value.slice(TEXT_PREFIX.length), 'base64'), aad).toString('utf8');
}

function encryptBytes(value, aad) {
  if (value === null || value === undefined) return value;
  return Buffer.concat([BYTES_MAGIC, seal(toBuffer(value), aad)]);
}

function decryptBytes(value, aad) {
  if (value === null || value === undefined || !isEncryptedBytes(value)) return value;
  return open(toBuffer(value).subarray(BYTES_MAGIC.length), aad);
}

// Blind index: a keyed hash of a normalised value, so an encrypted column can still be
// matched for equality (login by email) without ever being decrypted in SQL. It uses a
// key derived from APP_ENCRYPTION_KEY, separate from the one that encrypts the data.
let cachedIndexKey;

function getIndexKey() {
  if (!cachedIndexKey) {
    cachedIndexKey = Buffer.from(crypto.hkdfSync('sha256', getKey(), Buffer.alloc(0), 'roamio-blind-index-v1', 32));
  }
  return cachedIndexKey;
}

function blindIndex(value) {
  return crypto.createHmac('sha256', getIndexKey()).update(String(value).trim().toLowerCase()).digest('hex');
}

module.exports = { getKey, blindIndex, encryptText, decryptText, encryptBytes, decryptBytes, isEncryptedText, isEncryptedBytes };
