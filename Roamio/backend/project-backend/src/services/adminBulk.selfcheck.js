// Bulk user actions, the user filters, the alert email dedupe, and a scan that every
// admin write route leaves an audit entry. Stand-ins replace Prisma and the services.
// node src/services/adminBulk.selfcheck.js
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

process.env.ADMIN_USER_IDS = '1,2';
process.env.superSecretKey = 'service-key';

const stub = (file, exports) => {
  require.cache[path.join(__dirname, file)] = { id: file, filename: file, loaded: true, exports };
};

const audits = [];
const revoked = [];
const users = new Map([[1, { id: 1, isActive: true }], [2, { id: 2, isActive: true }], [5, { id: 5, isActive: true }], [6, { id: 6, isActive: true }]]);
const where = [];
const state = { row: null };
let down = [];
let flagged = [];
const sent = [];

stub('../config/prisma.js', {
  user: {
    findFirst: async ({ where: w }) => users.get(w.id) ?? null,
    update: async ({ where: w, data }) => Object.assign(users.get(w.id), data),
    findMany: async (args) => {
      where.push(args.where);
      return args.where?.id?.in ? [{ email: 'admin@example.com' }] : [];
    },
    count: async () => 0,
  },
  activityLog: { create: async ({ data }) => audits.push(data) },
  adminAlertState: {
    findUnique: async () => state.row,
    upsert: async ({ create }) => (state.row = create),
  },
});
stub('sessionService.js', { revokeAll: async (id) => revoked.push(id), SESSION_DAYS: 30 });
stub('tripAccessService.js', { httpError: (status, message) => Object.assign(new Error(message), { status }) });
stub('healthService.js', { checkAll: async () => Object.fromEntries(down.map((d) => [d, { status: 'down', detail: 'HTTP 500' }])) });
stub('destinationFeedbackService.js', { openReports: async () => flagged.map((name) => ({ name, placeKey: name, reportCount: 3, flagged: true })) });
stub('emailService.js', { sendAdminAlert: async (to, subject) => (sent.push({ to, subject }), true) });

const users_ = require('./adminUserService');
const alerts = require('./adminAlertService');

(async () => {
  // validation
  await assert.rejects(users_.bulk(5, { ids: [5], action: 'delete' }), /action must be/);
  await assert.rejects(users_.bulk(5, { ids: [], action: 'suspend' }), /between 1 and 100/);
  await assert.rejects(users_.bulk(5, { ids: Array(101).fill(5), action: 'suspend' }), /between 1 and 100/);

  // admins, yourself and unknown ids are skipped; the rest still go through
  const result = await users_.bulk(5, { ids: [1, 5, 6, 99], action: 'suspend' });
  assert.equal(result.done, 1);
  assert.deepEqual(result.failed.map((f) => f.id), [1, 5, 99]);
  assert.equal(users.get(6).isActive, false);
  assert.deepEqual(revoked, [6]);
  assert.deepEqual(audits.map((a) => [a.action, a.entityId]), [['ADMIN_SUSPEND_USER', 6]]);

  // reactivate and sign-out
  assert.equal((await users_.bulk(5, { ids: [6], action: 'reactivate' })).done, 1);
  assert.equal(users.get(6).isActive, true);
  assert.equal((await users_.bulk(5, { ids: [6], action: 'signOut' })).done, 1);
  assert.deepEqual(audits.map((a) => a.action).slice(1), ['ADMIN_REACTIVATE_USER', 'ADMIN_SIGN_OUT_USER']);

  // filters turn into the right queries
  await users_.listUsers({ status: 'no_trips' });
  assert.deepEqual(where.at(-1).tripMemberships, { none: {} });
  await users_.listUsers({ status: 'inactive' });
  assert.ok(where.at(-1).loginEvents.none.at instanceof Object && where.at(-1).loginEvents.none.at.gte instanceof Date);
  await users_.listUsers({ status: 'bogus' });
  assert.equal(where.at(-1).isActive, undefined, 'unknown status filters nothing');

  // alert email: once per change, never for "not configured", nothing when all is well
  assert.equal((await alerts.check()).sent, false); // nothing wrong
  down = ['email'];
  assert.equal((await alerts.check()).sent, true);
  assert.equal((await alerts.check()).sent, false, 'same problem, no second email');
  assert.match(sent[0].subject, /1 service down/);
  down = ['email', 'weather'];
  assert.equal((await alerts.check()).sent, true, 'a new problem emails again');
  down = [];
  flagged = ['Paris'];
  assert.equal((await alerts.check()).sent, true);
  assert.match(sent.at(-1).subject, /1 place flagged/);
  assert.equal(alerts.isDown({ status: 'down', detail: 'SMTP_HOST is not configured' }), false);

  // every admin route that writes also logs (a write route without log()/record() fails here)
  const dir = path.join(__dirname, '../routes');
  for (const file of fs.readdirSync(dir).filter((f) => /^admin.+\.js$/.test(f))) {
    const source = fs.readFileSync(path.join(dir, file), 'utf8').replaceAll(String.fromCharCode(13, 10), String.fromCharCode(10));
    const handlers = source.split(/\n(?=router\.(?:post|patch|put|delete)\()/).slice(1);
    for (const handler of handlers) {
      const head = handler.split('\n')[0];
      if (file === 'adminUsers.js') continue; // the user service logs each change itself (checked above)
      assert.match(handler.split(/\n(?=\/\/|router\.)/)[0], /\b(log|record)\(/, `${file}: ${head} has no audit entry`);
    }
  }
  console.log('admin bulk selfcheck passed');
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
