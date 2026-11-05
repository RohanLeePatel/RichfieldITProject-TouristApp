// What the recommendations proxy sends the AI service: the managed destinations
// when there are some (one country's for a city-level request), the browser's
// own candidates untouched, never a catalog the browser made up, and nothing
// extra when the database has none or is down.
// node src/routes/recommendations.selfcheck.js
const assert = require('node:assert/strict');
const path = require('node:path');

process.env.superSecretKey = 'service-key';
let catalog = [];
require.cache[path.join(__dirname, '../services/catalogService.js')] = {
  exports: {
    loadCatalog: async () => {
      if (catalog instanceof Error) throw catalog;
      return catalog;
    },
    countriesOf: (entries) => [{ id: 'japan', name: 'Japan', city_count: entries.length }],
    countrySlug: (name) => name.toLowerCase().replace(/ /g, '-'),
  },
};

const express = require('express');
const router = require('./recommendations');

const sent = [];
const realFetch = global.fetch;
const app = express();
app.use(express.json());
app.use('/api/recommendations', router);

const kyoto = { id: 'jp-kyo', country: 'Japan' };
const reykjavik = { id: 'is-rey', country: 'Iceland' };

const server = app.listen(0, async () => {
  const base = `http://127.0.0.1:${server.address().port}/api/recommendations`;
  global.fetch = async (url, init) => {
    if (!String(url).startsWith('http://127.0.0.1')) {
      sent.push({ url, body: init.body ? JSON.parse(init.body) : null });
      return { ok: true, status: 200, json: async () => ({ results: [], countries: [] }) };
    }
    return realFetch(url, init);
  };
  const post = async (body) => {
    sent.length = 0;
    const r = await realFetch(base, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
    assert.equal(r.status, 200);
    return sent[0].body;
  };
  try {
    catalog = [kyoto, reykjavik];
    assert.deepEqual((await post({ level: 'country' })).catalog, [kyoto, reykjavik]);
    assert.deepEqual((await post({ level: 'city', parent_id: 'japan' })).catalog, [kyoto]);
    // a country the list does not have still goes with the whole list, so the answer is "no cities"
    assert.deepEqual((await post({ level: 'city', parent_id: 'atlantis' })).catalog, [kyoto, reykjavik]);
    // the browser's own candidates are scored as sent; a catalog from the browser is dropped
    const own = [{ id: 'mine' }];
    const body = await post({ level: 'country', candidates: own, catalog: [{ id: 'evil' }] });
    assert.deepEqual(body.candidates, own);
    assert.equal(body.catalog, undefined);
    assert.equal((await post({ level: 'place', catalog: [{ id: 'evil' }] })).catalog, undefined);

    // no managed destinations, or the database is down: the AI service's built-in list answers
    catalog = [];
    assert.equal((await post({ level: 'country' })).catalog, undefined);
    catalog = new Error('db down');
    assert.equal((await post({ level: 'country' })).catalog, undefined);

    // the country list comes from the database when it has cities, else from the AI service
    catalog = [kyoto];
    sent.length = 0;
    let r = await realFetch(`${base}/catalog`);
    assert.deepEqual(await r.json(), { countries: [{ id: 'japan', name: 'Japan', city_count: 1 }] });
    assert.equal(sent.length, 0);
    catalog = [];
    r = await realFetch(`${base}/catalog`);
    assert.equal(r.status, 200);
    assert.match(sent[0].url, /\/recommendations\/catalog$/);

    console.log('recommendations proxy selfcheck passed');
    process.exit(0);
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
});
