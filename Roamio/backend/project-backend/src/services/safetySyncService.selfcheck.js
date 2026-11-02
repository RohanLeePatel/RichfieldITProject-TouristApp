// Live advisories from the State Department feed: matched by the alpha-3 code
// in the link, or by name when the link has none; level and text parsed;
// unknown emergency numbers left empty. The feed and the DB are stubbed.
// node src/services/safetySyncService.selfcheck.js
const assert = require('node:assert/strict');
const path = require('node:path');

const feed = [
  { Title: 'South Africa - Level 2: Exercise Increased Caution', Link: 'https://x/destination.zaf.html', Summary: 'Exercise increased caution<p>in <b>South Africa</b> due to crime.</p>', Updated: '2025-05-26T20:00:00-04:00' },
  { Title: 'Mexico Travel Advisory - Level 2: Exercise Increased Caution', Link: 'https://x/destination.mex.html', Summary: 'x', Updated: '2026-05-28T20:00:00-04:00' },
  { Title: 'Namibia - Level 1: Exercise Normal Precautions', Link: 'https://x/namibia-travel-advisory.html', Summary: 'Exercise normal precautions in Namibia.', Updated: '2026-01-01T00:00:00Z' },
];
let fetches = 0;
let riskCalls = 0;
require.cache[require.resolve('axios')] = { exports: { get: async (url) => {
  if (url.startsWith('https://risk.test/')) {
    riskCalls += 1;
    if (url.endsWith('/countries/NAM')) throw new Error('429 Too Many Requests');
    return { data: { advisory_level: 3, risk_score: 3.4, advisory_description: 'Reconsider travel<p>in <b>Mexico</b>.</p>', advisory_date: '2026-05-29T00:00:00' } };
  }
  fetches += 1;
  return { data: feed };
} } };
const stub = (file) => { require.cache[path.join(__dirname, file)] = { exports: {} }; };
stub('../repositories/safetyRepository.js');
stub('./pushService.js');

const sync = require('./safetySyncService');

(async () => {
  const za = await sync.fetchStateDeptAdvisory('zaf');
  assert.equal(za.countryIso, 'ZAF');
  assert.equal(za.riskLevel, 2);
  assert.equal(za.advisoryLevel, 'Exercise increased caution');
  assert.equal(za.summary, 'Exercise increased caution in South Africa due to crime.');
  assert.equal(za.policeNumber, '10111');
  assert.equal(za.source, 'US_STATE_DEPT');

  // no code in the link: found by name; no known numbers: empty, not "112"
  const na = await sync.fetchStateDeptAdvisory('NAM', 'Namibia');
  assert.equal(na.riskLevel, 1);
  assert.equal(na.policeNumber, null);

  assert.equal(sync.pickStateDeptEntry(feed, 'XXX', 'Mexico').Link, 'https://x/destination.mex.html');
  assert.equal(await sync.fetchStateDeptAdvisory('IDN', 'Indonesia'), null);
  assert.equal(fetches, 1); // the feed is cached

  // with a TravelRiskAPI key: that first, cached per country
  process.env.TRAVEL_RISK_API_KEY_1 = 'test';
  process.env.TRAVEL_RISK_API_URL_1 = 'https://risk.test/api/v1';
  const mx = await sync.liveAdvisory('mex');
  assert.equal(mx.source, 'TRAVEL_RISK_API');
  assert.equal(mx.riskLevel, 3);
  assert.equal(mx.summary, 'Reconsider travel in Mexico.');
  assert.equal(mx.policeNumber, '911');
  assert.equal(mx.lastUpdated.toISOString().slice(0, 10), '2026-05-29');
  await sync.liveAdvisory('MEX');
  assert.equal(riskCalls, 1);

  // TravelRiskAPI refuses (quota): the State Department feed instead
  const nam = await sync.liveAdvisory('NAM', 'Namibia');
  assert.equal(nam.source, 'US_STATE_DEPT');

  console.log('safetySyncService selfcheck: all assertions passed');
})();
