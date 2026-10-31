const crypto = require('node:crypto');
const prisma = require('../config/prisma');
const { clientInfo } = require('../utils/clientInfo');

// A refresh token lasts 7 days from its last renewal, so a session nobody has
// renewed for that long is over even if it was never revoked.
const SESSION_DAYS = 7;
const ACTIVITY_SHOWN_DAYS = 30; // what Settings lists
const ACTIVITY_KEPT_DAYS = 90; // anything older is deleted on the next sign-in
const ACTIVITY_LIMIT = 100;
const DAY = 24 * 60 * 60 * 1000;

const sessionCutoff = () => new Date(Date.now() - SESSION_DAYS * DAY);
const live = (userId) => ({ userId, revokedAt: null, lastSeenAt: { gte: sessionCutoff() } });

// A sign-in: records it in the history and opens a session. Returns the session
// id, which goes into both tokens. `req` is the sign-in request.
async function start(userId, req, { record = true } = {}) {
  const info = clientInfo(req);
  const id = crypto.randomUUID();
  await prisma.userSession.create({ data: { id, userId, ...info } });
  if (record) {
    await prisma.loginEvent.create({ data: { userId, success: true, ...info } });
    await prisma.loginEvent.deleteMany({ where: { userId, at: { lt: new Date(Date.now() - ACTIVITY_KEPT_DAYS * DAY) } } });
  }
  return id;
}

// A wrong password for a real account. Unknown emails have no one to show it to.
async function recordFailure(userId, req) {
  await prisma.loginEvent.create({ data: { userId, success: false, ...clientInfo(req) } });
}

// A token is being renewed: true (and the session is marked as used) while it
// is still open, false once it was signed out or has gone unused too long.
async function touch(id, userId) {
  const { count } = await prisma.userSession.updateMany({
    where: { id, ...live(userId) },
    data: { lastSeenAt: new Date() },
  });
  return count === 1;
}

async function list(userId, currentId) {
  const rows = await prisma.userSession.findMany({ where: live(userId), orderBy: { lastSeenAt: 'desc' }, take: 50 });
  return rows.map((row) => ({
    id: row.id,
    browser: row.browser,
    os: row.os,
    deviceType: row.deviceType,
    location: row.location,
    ipAddress: row.ipAddress,
    lastActiveAt: row.lastSeenAt.toISOString(),
    current: row.id === currentId,
  }));
}

// false when it isn't theirs or is already over
async function revoke(userId, id) {
  const { count } = await prisma.userSession.updateMany({ where: { id, ...live(userId) }, data: { revokedAt: new Date() } });
  return count === 1;
}

async function revokeOthers(userId, currentId) {
  await prisma.userSession.updateMany({
    where: { ...live(userId), ...(currentId ? { id: { not: currentId } } : {}) },
    data: { revokedAt: new Date() },
  });
}

async function revokeAll(userId) {
  await prisma.userSession.updateMany({ where: live(userId), data: { revokedAt: new Date() } });
}

// newest first
async function activity(userId) {
  const rows = await prisma.loginEvent.findMany({
    where: { userId, at: { gte: new Date(Date.now() - ACTIVITY_SHOWN_DAYS * DAY) } },
    orderBy: { at: 'desc' },
    take: ACTIVITY_LIMIT,
  });
  return rows.map((row) => ({
    id: String(row.id),
    at: row.at.toISOString(),
    browser: row.browser,
    os: row.os,
    deviceType: row.deviceType,
    location: row.location,
    ipAddress: row.ipAddress,
    success: row.success,
  }));
}

module.exports = { start, recordFailure, touch, list, revoke, revokeOthers, revokeAll, activity, SESSION_DAYS };
