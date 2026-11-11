const crypto = require('node:crypto');

// The headers that vouch for a traveller when this API calls ai-features on their behalf:
// x-user-id plus an HMAC of "<id>.<timestamp>". Holding the shared node-secretkey alone
// is not enough to act as another traveller there, because the signing key is separate.
// userSigningKey must equal ai-features' userSigningKey. It falls back to superSecretKey
// so nothing breaks while it is unset, but then the signature adds no protection.
const userHeaders = (userId) => {
  const key = process.env.userSigningKey || process.env.superSecretKey || '';
  const ts = String(Math.floor(Date.now() / 1000));
  const sig = crypto.createHmac('sha256', key).update(`${userId}.${ts}`).digest('hex');
  return { 'x-user-id': String(userId), 'x-user-ts': ts, 'x-user-sig': sig };
};

module.exports = { userHeaders };
