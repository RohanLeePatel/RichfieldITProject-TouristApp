// The new sign-in email: its wording, that it is skipped without SMTP, and that
// a mail failure never throws.
// node src/services/emailService.selfcheck.js
const assert = require('node:assert/strict');

const mails = [];
let failing = false;
require.cache[require.resolve('nodemailer')] = {
  exports: {
    createTransport: () => ({
      sendMail: async (message) => {
        if (failing) throw new Error('smtp down');
        mails.push(message);
      },
    }),
  },
};

const emailService = require('./emailService');
const info = { browser: 'Chrome', os: 'Windows', location: 'Cape Town, South Africa', ipAddress: '10.0.0.2', at: new Date('2026-11-02T08:00:00Z') };

(async () => {
  // no SMTP: nothing sent, nothing thrown
  delete process.env.SMTP_HOST;
  assert.equal(await emailService.sendNewSignInEmail('a@example.com', info), false);
  assert.equal(mails.length, 0);

  process.env.SMTP_HOST = 'smtp.test';
  process.env.SMTP_FROM = 'Roamio <no-reply@example.com>';
  assert.equal(await emailService.sendNewSignInEmail('a@example.com', info), true);
  assert.equal(mails[0].to, 'a@example.com');
  assert.equal(mails[0].subject, 'New sign-in to your Roamio account');
  assert.match(mails[0].text, /Device: Chrome on Windows/);
  assert.match(mails[0].text, /Place: Cape Town, South Africa/);
  assert.match(mails[0].text, /Address: 10\.0\.0\.2/);
  assert.match(mails[0].text, /Mon, 02 Nov 2026 08:00:00 GMT/);

  // no place known: the line is left out, not printed empty
  await emailService.sendNewSignInEmail('a@example.com', { ...info, location: '' });
  assert.doesNotMatch(mails[1].text, /Place:/);

  // a failing mail server must not break the sign-in
  failing = true;
  assert.equal(await emailService.sendNewSignInEmail('a@example.com', info), false);

  console.log('emailService selfcheck passed');
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
