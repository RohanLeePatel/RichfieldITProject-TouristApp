// Sign-up with the emailed code, end to end over HTTP against an in-memory
// user store: register -> verify-otp -> login, in the shape the frontend
// reads ({ user, token }), and email delivery failing loudly in production.
// node src/routes/auth.selfcheck.js
const assert = require('node:assert/strict');
const path = require('node:path');
const express = require('express');
const cookieParser = require('cookie-parser');

process.env.JWT_ACCESS_SECRET = 'selfcheck-secret';
process.env.JWT_REFRESH_SECRET = 'selfcheck-refresh';
delete process.env.SMTP_HOST;

const users = new Map(); // email -> row
let nextId = 1;
const fakeUsers = {
  findByEmail: async (email) => users.get(email) || null,
  create: async (data) => {
    const row = { id: nextId++, isVerified: false, otpAttempts: 0, ...data };
    users.set(data.email, row);
    return row;
  },
  setOtp: async (id, data) => {
    const row = [...users.values()].find((u) => u.id === id);
    Object.assign(row, Object.fromEntries(Object.entries(data).filter(([, v]) => v !== undefined)));
  },
  findById: async (id) => [...users.values()].find((u) => u.id === id) || null,
  acceptTerms: async (id, termsVersion) => {
    const row = [...users.values()].find((u) => u.id === id);
    Object.assign(row, { termsAcceptedAt: new Date(), termsVersion });
    return { termsVersion };
  },
  setResetPasswordOtp: async (id, hash, expiresAt) => {
    Object.assign([...users.values()].find((u) => u.id === id), { resetPasswordOtpHash: hash, resetPasswordExpiresAt: expiresAt, resetPasswordAttempts: 0 });
  },
  updatePasswordAndClearResetOtp: async () => true,
  recordFailedOtp: async (id) => {
    [...users.values()].find((u) => u.id === id).otpAttempts += 1;
  },
  markVerified: async (id, otpHash) => {
    const row = [...users.values()].find((u) => u.id === id && u.otpHash === otpHash);
    if (!row) return false;
    Object.assign(row, { isVerified: true, otpHash: null });
    return true;
  },
};
require.cache[path.join(__dirname, '../repositories/userRepository.js')] = { exports: fakeUsers };

// Sessions: an in-memory stand-in for sessionService (its own queries are checked in services/sessionService.selfcheck.js)
const sessions = new Map(); // id -> { userId, open, record, agent }
const failures = [];
const revokedAll = [];
require.cache[path.join(__dirname, '../services/sessionService.js')] = {
  exports: {
    start: async (userId, req, { record = true } = {}) => {
      const id = `s${sessions.size + 1}`;
      sessions.set(id, { userId, open: true, record, agent: req?.headers?.['user-agent'] });
      return id;
    },
    recordFailure: async (userId) => { failures.push(userId); },
    touch: async (id, userId) => Boolean(sessions.get(id)?.open && sessions.get(id).userId === userId),
    revoke: async (userId, id) => {
      const session = sessions.get(id);
      if (!session || session.userId !== userId || !session.open) return false;
      session.open = false;
      return true;
    },
    revokeAll: async (userId) => { revokedAll.push(userId); for (const s of sessions.values()) if (s.userId === userId) s.open = false; },
  },
};

// capture the code the "email" would carry
const sent = [];
const realLog = console.log;
console.log = (...args) => {
  const match = /^\[DEV (?:RESET )?OTP\] (.+):(\d{6})$/.exec(args.join(' '));
  if (match) sent.push({ email: match[1], otp: match[2] });
  else realLog(...args);
};

const router = require('./auth');
const app = express().use(express.json()).use(cookieParser('x')).use('/api/auth', router);

const server = app.listen(0, async () => {
  const base = `http://127.0.0.1:${server.address().port}/api/auth`;
  const post = (p, body) =>
    fetch(base + p, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
      .then(async (r) => ({ status: r.status, body: await r.json() }));
  const account = { email: 'ada@example.com', password: 'longenough', fullName: "Zoë O'Brien-Smith Jr.", acceptedTerms: true }; // accents, apostrophe, hyphen, full stop are all fine

  try {
    // register refuses input that doesn't fit the fields, with the reason
    let r;
    for (const [change, pattern] of [
      [{ fullName: 'R2D2 99' }, /letters, spaces/],
      [{ fullName: 'A' }, /2-80 characters/],
      [{ fullName: 'x'.repeat(81) }, /2-80 characters/],
      [{ password: 'a'.repeat(73) }, /longer than 72/],
      [{ email: `${'a'.repeat(250)}@example.com` }, /valid email/],
      [{ acceptedTerms: false }, /Terms and Privacy Policy/],
      [{ acceptedTerms: 'true' }, /Terms and Privacy Policy/],
      [{ acceptedTerms: undefined }, /Terms and Privacy Policy/],
    ]) {
      r = await post('/register', { ...account, ...change });
      assert.equal(r.status, 400);
      assert.match(r.body.error, pattern);
    }

    // register: no session yet, a code is "emailed"
    r = await post('/register', account);
    assert.equal(r.status, 201);
    assert.equal(r.body.email, 'ada@example.com');
    assert.equal(r.body.token, undefined);
    assert.equal(sent.length, 1);
    // the agreement is recorded with the wording version it was given for
    assert.ok(users.get('ada@example.com').termsAcceptedAt instanceof Date);
    assert.equal(users.get('ada@example.com').termsVersion, '2026-10-31');

    // can't log in before verifying
    r = await post('/login', account);
    assert.equal(r.status, 403);

    // wrong code, then the right one -> a session in the frontend's shape
    r = await post('/verify-otp', { email: account.email, otp: sent[0].otp === '000000' ? '111111' : '000000' });
    assert.equal(r.status, 400);
    r = await post('/verify-otp', { email: account.email, otp: sent[0].otp });
    assert.equal(r.status, 200);
    assert.equal(typeof r.body.token, 'string');
    assert.equal(r.body.token, r.body.accessToken);
    assert.deepEqual(r.body.user, { id: 1, email: 'ada@example.com', fullName: "Zoë O'Brien-Smith Jr." });

    // login returns user + token too (the old API's shape)
    r = await post('/login', account);
    assert.equal(r.status, 200);
    assert.equal(typeof r.body.token, 'string');
    assert.equal(r.body.user.email, 'ada@example.com');

    // wrong password for a real account is recorded; an unknown email has no one to show it to
    assert.equal((await post('/login', { ...account, password: 'not-the-password' })).status, 401);
    assert.equal((await post('/login', { email: 'nobody@example.com', password: 'whatever1' })).status, 401);
    assert.deepEqual(failures, [1]);

    // every sign-in opens a session, and both tokens carry its id
    const jwt = require('jsonwebtoken');
    const loginAs = (headers = {}) =>
      fetch(base + '/login', { method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: JSON.stringify(account) });
    const refreshCookie = (res) => res.headers.getSetCookie().find((c) => c.startsWith('refreshToken=')).split(';')[0];
    const renew = (cookie) => fetch(base + '/refresh', { method: 'POST', headers: { cookie } });
    let signIn = await loginAs({ 'user-agent': 'selfcheck-phone' });
    const cookieOne = refreshCookie(signIn);
    const { sid } = jwt.decode((await signIn.json()).token);
    assert.ok(sessions.get(sid).open);
    assert.equal(sessions.get(sid).agent, 'selfcheck-phone'); // the request reaches sessionService, so it can describe the device
    assert.equal(jwt.decode(cookieOne.split('=')[1]).sid, sid);

    // renewing works while the session is open, and keeps it
    let renewed = await renew(cookieOne);
    assert.equal(renewed.status, 200);
    assert.equal(jwt.decode((await renewed.json()).accessToken).sid, sid);

    // signed out from Settings: the next renewal is refused, so that device is out
    sessions.get(sid).open = false;
    renewed = await renew(cookieOne);
    assert.equal(renewed.status, 401);
    assert.match((await renewed.json()).error, /signed out/);

    // logging out ends the session behind the cookie
    signIn = await loginAs();
    const cookieTwo = refreshCookie(signIn);
    const second = jwt.decode((await signIn.json()).token).sid;
    await fetch(base + '/logout', { method: 'POST', headers: { cookie: cookieTwo } });
    assert.equal(sessions.get(second).open, false);
    assert.equal((await renew(cookieTwo)).status, 401);

    // a token from before sessions existed still renews, and is given one (without a sign-in entry)
    const tokenService = require('../auth/tokenService');
    const count = sessions.size;
    renewed = await renew(`refreshToken=${tokenService.generateRefreshToken({ id: 1 })}`);
    assert.equal(renewed.status, 200);
    assert.equal(sessions.size, count + 1);
    assert.equal([...sessions.values()].at(-1).record, false);
    assert.ok(jwt.decode((await renewed.json()).accessToken).sid);

    // resetting the password signs every device out
    await post('/forgot-password', { email: account.email });
    r = await post('/reset-password', { email: account.email, otp: sent.at(-1).otp, newPassword: 'another-long-one' });
    assert.equal(r.status, 200);
    assert.deepEqual(revokedAll, [1]);
    assert.ok([...sessions.values()].every((s) => !s.open));

    // an account on an older (or no) version of the terms is asked again, and agreeing records the current one
    const authed = (p, method = 'GET') =>
      fetch(base + p, { method, headers: { authorization: `Bearer ${r.body.token}` } }).then(async (res) => ({ status: res.status, body: await res.json() }));
    r = await post('/login', account);
    users.get('ada@example.com').termsVersion = null;
    let me = await authed('/users/me');
    assert.equal(me.body.currentTermsVersion, '2026-10-31');
    assert.notEqual(me.body.termsVersion, me.body.currentTermsVersion);
    assert.equal((await authed('/users/me/terms', 'POST')).body.termsVersion, '2026-10-31');
    me = await authed('/users/me');
    assert.equal(me.body.termsVersion, me.body.currentTermsVersion);
    assert.equal((await fetch(base + '/users/me/terms', { method: 'POST' })).status, 401);

    // production without SMTP: sign-up says so instead of sending nothing
    process.env.NODE_ENV = 'production';
    const realError = console.error;
    console.error = () => {};
    r = await post('/register', { ...account, email: 'bob@example.com' });
    assert.equal(r.status, 503);
    // resend keeps its uniform answer so it can't be used to probe accounts
    r = await post('/resend-otp', { email: 'bob@example.com' });
    assert.equal(r.status, 200);
    console.error = realError;
    delete process.env.NODE_ENV;

    // PATCH /users/me only passes the allow-listed fields on (B1)
    const { profileUpdate } = require('../controllers/authController');
    assert.deepEqual(
      profileUpdate({ fullName: ' Ada L ', passwordHash: 'x', isVerified: true, email: 'evil@x.com', preferences: { language: 'fr', userId: 9, pushAlerts: 'no' } }),
      { fullName: 'Ada L', preferences: { upsert: { create: { language: 'fr' }, update: { language: 'fr' } } } }
    );
    assert.equal(profileUpdate({ avatarUrl: 'javascript:alert(1)' }), null);
    assert.equal(profileUpdate({}), null);
    // a bad name is refused with the reason instead of being saved or silently cut
    for (const fullName of ['R2D2', 'A', '', '   ', 'x'.repeat(81), 42]) {
      assert.throws(() => profileUpdate({ fullName }), (e) => e.statusCode === 400 && /Full name must be 2-80/.test(e.message));
    }

    console.log = realLog;
    console.log('auth selfcheck: all assertions passed');
  } finally {
    console.log = realLog;
    server.close();
  }
});
