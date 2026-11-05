// Every AI-service route the Core API calls must exist in the AI service's
// committed API snapshot (ai-features/tests/openapi.snapshot.json), with that
// method. If a route is renamed or removed there, the snapshot test in
// ai-features forces the change to be reviewed, and this check then fails until
// the Core API is updated to match.
// node src/utils/aiContract.selfcheck.js
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const snapshotPath = path.join(__dirname, '../../../ai-features/tests/openapi.snapshot.json');
const paths = JSON.parse(fs.readFileSync(snapshotPath, 'utf8')).paths;

// [method, route as the AI service declares it] - keep in step with the proxies in src/routes and src/services
const CALLED = [
  ['get', '/v1/weather/{city}'], // routes/weather.js, routes/chat.js
  ['get', '/v1/places/search'], // routes/chat.js
  ['post', '/v1/chat'], // routes/chat.js
  ['post', '/v1/recommendations'], // routes/recommendations.js
  ['get', '/v1/recommendations/catalog'],
  ['get', '/v1/landmarks'],
  ['post', '/v1/destinations/enrich'], // services/catalogService.js
  ['post', '/v1/destinations/geocode'],
  ['get', '/v1/rates/{base}/{target}'], // services/ratesService.js
  ['post', '/v1/api/translate/text'], // routes/translation.js
  ['post', '/v1/api/translate/camera'],
  ['get', '/v1/api/translate/history'], // routes/translation.js, services/accountService.js
  ['delete', '/v1/api/translate/history'],
  ['delete', '/v1/api/translate/history/{record_id}'],
];

for (const [method, route] of CALLED) {
  assert.ok(paths[route]?.[method], `the AI service has no ${method.toUpperCase()} ${route} (see ai-features/tests/openapi.snapshot.json)`);
}

// the unversioned paths the health probe uses stay unversioned
assert.ok(paths['/health']?.get, 'GET /health is missing');

console.log('aiContract selfcheck passed');
