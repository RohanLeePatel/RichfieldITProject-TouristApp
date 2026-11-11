// Sign-up CAPTCHA (Cloudflare Turnstile), checked on the server: off without a
// secret, otherwise every register call needs a token siteverify accepts, the
// check runs before anything is stored or emailed, and the secret is only ever
// sent to Cloudflare. global.fetch is stubbed; nothing leaves the machine.
// node src/services/captchaService.selfcheck.js
const assert = require('node:assert/strict');
const path = require('node:path');

const SECRET = 'selfcheck-turnstile-secret';
const sent = []; // siteverify request bodies
let reply = { success: true }; // what siteverify answers; a function throws instead
global.fetch = async (url, init) => {
  assert.equal(url, 'https://challenges.cloudflare.com/turnstile/v0/siteverify');
  sent.push(JSON.parse(init.body));
  if (typeof reply === 'function') return reply();
  return { ok: true, json: async () => reply };
};

// the account store must not be touched until the challenge passes
const created = [];
require.cache[path.join(__dirname, '../repositories/userRepository.js')] = {
  exports: { findByEmail: async () => null, create: async (row) => (created.push(row), { id: 1, ...row }) },
};
require.cache[path.join(__dirname, './emailService.js')] = { exports: { sendOtpEmail: async () => {}, sendNewSignInEmail: async () => {} } };

const { verifyCaptcha } = require('./captchaService');
const authService = require('./authService');

const account = { email: 'ada@example.com', password: 'correct-horse-9', fullName: 'Ada Lovelace', acceptedTerms: true };
const rejects = (promise, status, code) =>
  assert.rejects(promise, (error) => (assert.equal(error.statusCode, status), assert.equal(error.code, code), true));

(async () => {
  // no secret configured: the check is off and Cloudflare is never called
  delete process.env.TURNSTILE_SECRET_KEY;
  assert.deepEqual(await verifyCaptcha(undefined), { skipped: true });
  assert.equal(sent.length, 0);

  process.env.TURNSTILE_SECRET_KEY = SECRET;

  // missing / malformed token: refused without a network call
  await rejects(verifyCaptcha(undefined), 400, 'CAPTCHA_FAILED');
  await rejects(verifyCaptcha(''), 400, 'CAPTCHA_FAILED');
  await rejects(verifyCaptcha('x'.repeat(2049)), 400, 'CAPTCHA_FAILED');
  assert.equal(sent.length, 0);

  // accepted: the secret, token and visitor IP go to siteverify
  assert.deepEqual(await verifyCaptcha('good-token', '203.0.113.9'), { skipped: false });
  assert.deepEqual(sent.at(-1), { secret: SECRET, response: 'good-token', remoteip: '203.0.113.9' });

  // rejected or expired/reused token: a 400 the page can retry from, never echoing the secret
  const logged = console.error;
  console.error = () => {}; // the secret-rejected case logs on purpose
  for (const codes of [['invalid-input-response'], ['timeout-or-duplicate'], ['invalid-input-secret']]) {
    reply = { success: false, 'error-codes': codes };
    await assert.rejects(verifyCaptcha('bad-token'), (error) => {
      assert.equal(error.statusCode, 400);
      assert.equal(error.code, 'CAPTCHA_FAILED');
      assert.ok(!error.message.includes(SECRET));
      return true;
    });
  }

  // Cloudflare unreachable: fail closed with a "try again" 503, not an account
  reply = () => { throw new Error('ECONNRESET'); };
  await rejects(verifyCaptcha('good-token'), 503, 'CAPTCHA_UNAVAILABLE');
  console.error = logged;

  // register: a failed challenge stops before the account is created
  reply = { success: false, 'error-codes': ['invalid-input-response'] };
  await rejects(authService.register({ ...account, captchaToken: 'bad-token' }, { ip: '203.0.113.9' }), 400, 'CAPTCHA_FAILED');
  await rejects(authService.register({ ...account }, {}), 400, 'CAPTCHA_FAILED');
  assert.equal(created.length, 0);

  // ...and a passed one goes through
  reply = { success: true };
  const result = await authService.register({ ...account, captchaToken: 'good-token' }, { ip: '203.0.113.9' });
  assert.equal(result.email, 'ada@example.com');
  assert.equal(created.length, 1);
  assert.equal(sent.at(-1).response, 'good-token');

  console.log('captchaService selfcheck: all assertions passed');
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
