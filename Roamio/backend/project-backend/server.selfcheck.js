// Boots server.js with the DB, cron and safety sync stubbed and checks the
// mount order: public AI proxies before the auth-wide /api routers, the
// frontend trip router before the group routes, the 2 MB documents limit, CORS.
// node server.selfcheck.js
const path = require('node:path');
const assert = require('node:assert/strict');
const root = __dirname;
process.env.PORT = '0';
process.env.NODE_ENV = 'test';
process.env.CLIENT_URL = '';
delete process.env.superSecretKey;
// stands in for Prisma and the safety sync, so nothing touches the database
const stub = new Proxy({}, { get: () => new Proxy(() => {}, { get: () => async () => null, apply: () => {} }) });
for (const m of ['src/config/prisma.js', 'src/prismaClient.js', 'src/services/safetySyncService.js'])
  require.cache[path.join(root, m)] = { exports: stub };
const Module = require('module'); const load = Module._load;
Module._load = function (r, ...a) { return r === 'node-cron' ? { schedule() {} } : load.call(this, r, ...a); };
const express = require(require.resolve('express', { paths: [root] }));
const listen = express.application.listen;
express.application.listen = function (port, cb) {
  const server = listen.call(this, 0, async () => {
    const base = `http://127.0.0.1:${server.address().port}`;
    const req = (p, init = {}) => fetch(base + p, init).then(async (r) => ({ status: r.status, headers: r.headers, body: await r.json().catch(() => null) }));
    try {
      // the personal trip router answers first (and needs auth)
      assert.equal((await req('/api/trips')).status, 401);
      // proxies are mounted (500 = superSecretKey not set, i.e. reached the route)
      let r = await req('/api/recommendations/catalog');
      assert.equal(r.status, 500); assert.match(r.body.message, /not configured/);
      r = await req('/api/weather/Paris');
      assert.equal(r.status, 500); assert.match(r.body.message, /not configured/);
      r = await req('/api/translate/text', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{"text":"hola"}' });
      assert.equal(r.status, 500); assert.match(r.body.detail, /not configured/);
      // a 1.5 MB body: accepted on the documents path (reaches auth -> 401), refused elsewhere (413)
      const big = JSON.stringify({ dataBase64: 'A'.repeat(1_500_000) });
      const h = { 'content-type': 'application/json' };
      assert.equal((await req('/api/trips/1/documents', { method: 'POST', headers: h, body: big })).status, 401);
      assert.equal((await req('/api/trips', { method: 'POST', headers: h, body: big })).status, 413);
      // CORS: a default dev origin is allowed, a random one isn't
      r = await req('/api/trips', { headers: { origin: 'http://localhost:5173' } });
      assert.equal(r.headers.get('access-control-allow-origin'), 'http://localhost:5173');
      r = await req('/api/trips', { headers: { origin: 'https://evil.example' } });
      assert.equal(r.headers.get('access-control-allow-origin'), null);
      // the group routes are still reachable behind the trip router
      assert.equal((await req('/api/groups')).status, 401);
      // health check and API docs (main's, kept)
      assert.equal((await req('/')).status, 200);
      assert.equal((await fetch(base + '/api-docs/')).status, 200);
      console.log('server smoke test: all assertions passed');
      process.exit(0);
    } catch (e) { console.error(e); process.exit(1); }
  });
  return server;
};
require(path.join(root, 'server.js'));
