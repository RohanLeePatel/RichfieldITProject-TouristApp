// The proxy is the only thing ai-features trusts to say who a traveller is,
// so the x-user-id it sends must come from a verified token and never from
// the browser. Runs against a fake ai-features that echoes what it received.
// node src/routes/translation.selfcheck.js
const assert = require('node:assert');
const http = require('node:http');
const express = require('express');
const jwt = require('jsonwebtoken');

process.env.JWT_ACCESS_SECRET = 'selfcheck-secret';
process.env.superSecretKey = 'selfcheck-service-key';

const echo = http.createServer((req, res) => {
  res.setHeader('content-type', 'application/json');
  res.end(JSON.stringify({ method: req.method, path: req.url, userId: req.headers['x-user-id'] ?? null }));
});

echo.listen(0, async () => {
  process.env.AI_FEATURES_URL = `http://127.0.0.1:${echo.address().port}`;
  const router = require('./translation');
  const app = express().use(express.json()).use(require('cookie-parser')()).use('/api/translate', router);
  const server = app.listen(0);
  const base = `http://127.0.0.1:${server.address().port}/api/translate`;
  const token = (userId) => `Bearer ${jwt.sign({ userId }, process.env.JWT_ACCESS_SECRET)}`;
  const post = (headers) =>
    fetch(`${base}/text`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...headers },
      body: JSON.stringify({ text: 'Salida' }),
    }).then((r) => r.json());

  try {
    // signed in: the id comes from the token, and the new endpoint is used
    let got = await post({ authorization: token(7) });
    assert.deepStrictEqual(got, { method: 'POST', path: '/v1/api/translate/text', userId: '7' });

    // signed in with the accessToken cookie instead of a header
    got = await post({ cookie: `accessToken=${token(7).split(' ')[1]}` });
    assert.strictEqual(got.userId, '7');

    // a browser claiming to be someone else is ignored
    got = await post({ authorization: token(7), 'x-user-id': '99' });
    assert.strictEqual(got.userId, '7');
    got = await post({ 'x-user-id': '99' });
    assert.strictEqual(got.userId, null);

    // a forged token is a guest, not an error - translation still works
    const forged = `Bearer ${jwt.sign({ userId: 99 }, 'not-the-secret')}`;
    got = await post({ authorization: forged });
    assert.strictEqual(got.userId, null);

    // history needs a real user
    assert.strictEqual((await fetch(`${base}/history`)).status, 401);
    got = await (await fetch(`${base}/history?limit=5&other=x`, { headers: { authorization: token(7) } })).json();
    assert.deepStrictEqual(got, { method: 'GET', path: '/v1/api/translate/history?limit=5', userId: '7' });

    got = await (await fetch(`${base}/history/abc`, { method: 'DELETE', headers: { authorization: token(7) } })).json();
    assert.deepStrictEqual(got, { method: 'DELETE', path: '/v1/api/translate/history/abc', userId: '7' });

    console.log('translation proxy selfcheck: all assertions passed');
  } finally {
    server.close();
    echo.close();
  }
});
