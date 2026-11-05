const { httpError } = require('./tripAccessService');
const { aiApiUrl } = require('../utils/aiService');

const aiFeaturesUrl = aiApiUrl();

// One unit of `base` in `target`, from the ai-features /rates route (which
// holds the fastFOREX key and caches). Same currency -> 1 with no call.
// Throws 503 rather than guessing: an expense saved at a wrong rate would
// quietly corrupt every total after it.
async function fetchRate(base, target) {
  if (base === target) return { base, target, rate: 1, fetched_at: null, stale: false };

  const nodeSecretKey = process.env.superSecretKey;
  if (!nodeSecretKey) throw httpError(503, 'Exchange rates are not configured.');

  let response;
  try {
    response = await fetch(`${aiFeaturesUrl}/rates/${base}/${target}`, { headers: { 'node-secretkey': nodeSecretKey } });
  } catch {
    throw httpError(503, 'Could not reach the exchange rate service.');
  }
  const data = await response.json().catch(() => null);
  if (!response.ok || !(data?.rate > 0)) {
    throw httpError(response.status === 422 ? 400 : 503, data?.detail || 'Exchange rates are unavailable right now.');
  }
  return data;
}

module.exports = { fetchRate };
