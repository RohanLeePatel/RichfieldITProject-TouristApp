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

// capture the code the "email" would carry
const sent = [];
const realLog = console.log;
console.log = (...args) => {
  const match = /^\[DEV OTP\] (.+):(\d{6})$/.exec(args.join(' '));
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
  const account = { email: 'ada@example.com', password: 'longenough', fullName: 'Ada' };

  try {
    // register: no session yet, a code is "emailed"
    let r = await post('/register', account);
    assert.equal(r.status, 201);
    assert.equal(r.body.email, 'ada@example.com');
    assert.equal(r.body.token, undefined);
    assert.equal(sent.length, 1);

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
    assert.deepEqual(r.body.user, { id: 1, email: 'ada@example.com', fullName: 'Ada' });

    // login returns user + token too (the old API's shape)
    r = await post('/login', account);
    assert.equal(r.status, 200);
    assert.equal(typeof r.body.token, 'string');
    assert.equal(r.body.user.email, 'ada@example.com');

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

    console.log = realLog;
    console.log('auth selfcheck: all assertions passed');
  } finally {
    console.log = realLog;
    server.close();
  }
});
