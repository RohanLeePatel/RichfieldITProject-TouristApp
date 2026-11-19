// Synthetic security regressions. No database, provider, or credential access.
const assert = require('node:assert/strict');
const path = require('node:path');
const express = require('express');
const { isPushEndpoint } = require('./pushEndpoint');

(async () => {
  // The scoped Minimatch update must preserve Nodemon's real include/exclude
  // and extension matching, including the Windows options it supplies.
  const match = require('nodemon/lib/monitor/match');
  assert.deepEqual(match(['src/index.js', 'src/data.json', 'src/index.txt', 'private/ignore.js'], ['**/*', '!**/private/**'], 'js,json').result.map((file) => path.basename(file)), ['index.js', 'data.json']);
  for (const url of ['https://fcm.googleapis.com/fcm/send/synthetic', 'https://updates.push.services.mozilla.com/wpush/v2/synthetic', 'https://web.push.apple.com/synthetic', 'https://wns2.notify.windows.com/synthetic']) {
    assert.equal(isPushEndpoint(url), true);
  }
  const unsafe = ['https://127.0.0.1/private', 'https://[::1]/private', 'https://169.254.169.254/private', 'https://internal.example/private', 'https://fcm.googleapis.com.evil.example/private', 'https://fcm.googleapis.com@evil.example/private', 'https://fcm.googleapis.com:444/private', 'http://fcm.googleapis.com/private', 'https://fcm.googleapis.com/private#fragment'];
  for (const url of unsafe) assert.equal(isPushEndpoint(url), false);

  // Exercise the actual subscribe route, before persistence or any outbound request.
  let saved = 0;
  require.cache[path.join(__dirname, '../config/prisma.js')] = { exports: { pushSubscription: { upsert: async () => { saved += 1; } } } };
  require.cache[path.join(__dirname, '../middleware/authMiddleware.js')] = { exports: (req, res, next) => { req.user = { id: 1 }; next(); } };
  const app = express();
  app.use(express.json());
  app.use(require('../routes/push'));
  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  try {
    for (const endpoint of unsafe.slice(0, 5)) {
      const response = await fetch(`http://127.0.0.1:${server.address().port}/subscribe`, {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ endpoint, keys: { p256dh: 'synthetic', auth: 'synthetic' } }),
      });
      assert.equal(response.status, 400);
    }
    assert.equal(saved, 0);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }

  // Login and refresh share these production cookie options.
  process.env.NODE_ENV = 'production';
  process.env.JWT_ACCESS_SECRET = 'synthetic-security-test-access';
  process.env.JWT_REFRESH_SECRET = 'synthetic-security-test-refresh';
  const tokens = require('../auth/tokenService');
  const cookies = [];
  const response = { cookie: (name, value, options) => cookies.push({ name, options }) };
  tokens.setAccessTokenCookie(response, 'synthetic');
  tokens.setRefreshTokenCookie(response, 'synthetic');
  for (const cookie of cookies) {
    assert.equal(cookie.options.secure, true);
    assert.equal(cookie.options.httpOnly, true);
    assert.equal(cookie.options.sameSite, 'None');
  }
  assert.equal(cookies[0].options.signed, true);
  console.log('security selfcheck: all assertions passed');
})().catch((error) => { console.error(error); process.exitCode = 1; });
