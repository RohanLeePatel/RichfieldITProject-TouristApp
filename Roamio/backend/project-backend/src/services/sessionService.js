const crypto = require('node:crypto');
const prisma = require('../config/prisma');
const { clientInfo } = require('../utils/clientInfo');
const { notifyUser } = require('./pushService');
const { sendNewSignInEmail } = require('./emailService');

// A session stays alive only while its refresh token keeps being renewed. Each renewal
// moves `lastSeenAt` forward, so a session nobody has renewed for SESSION_DAYS is
// dead even if nobody revoked it. This matches the refresh token's own expiry.
const SESSION_DAYS = 7;
const ACTIVITY_SHOWN_DAYS = 30; // the window Settings displays
const ACTIVITY_KEPT_DAYS = 90; // history older than this is pruned during sign-in
const ACTIVITY_LIMIT = 100;
const DAY = 24 * 60 * 60 * 1000;

const sessionCutoff = () => new Date(Date.now() - SESSION_DAYS * DAY);
// Every lookup goes through this filter, so a revoked or expired session is treated
// the same as one that never existed.
const live = (userId) => ({ userId, revokedAt: null, lastSeenAt: { gte: sessionCutoff() } });

/**
 * Opens a session at sign-in and records the attempt in the login history.
 * @param {string} userId
 * @param {import('express').Request} req - the sign-in request, used for device details
 * @param {{ record?: boolean }} [options] - set `record: false` to skip history and
 *   new-device alerts, for example on internal logins
 * @returns {Promise<string>} the new session id, embedded in both access and refresh tokens
 */
async function start(userId, req, { record = true } = {}) {
  const info = clientInfo(req);
  const id = crypto.randomUUID();
  const newDevice = record && (await isNewDevice(userId, info));
  await prisma.userSession.create({ data: { id, userId, ...info } });
  if (record) {
    await prisma.loginEvent.create({ data: { userId, success: true, ...info } });
    await prisma.loginEvent.deleteMany({ where: { userId, at: { lt: new Date(Date.now() - ACTIVITY_KEPT_DAYS * DAY) } } });
  }
  if (newDevice) await alertNewDevice(userId, id, info);
  return id;
}

// A "device" means browser + OS + device type. Location is left out on purpose: it
// changes too often on mobile networks to be a useful signal. A device is new if it
// isn't in the kept history. An account's very first sign-in is never flagged, since
// there is nothing to compare it against.
async function isNewDevice(userId, { browser, os, deviceType }) {
  const where = { userId, success: true };
  if (await prisma.loginEvent.findFirst({ where: { ...where, browser, os, deviceType }, select: { id: true } })) return false;
  return (await prisma.loginEvent.count({ where })) > 0;
}

// Warns the account owner about a sign-in from an unrecognized device. Push goes to
// the account's other devices, and email always goes out because not every account
// has push enabled, while Settings promises security alerts by email. Both calls are
// awaited, since serverless runtimes can freeze work once the response is sent.
// Neither call is allowed to fail the sign-in.
async function alertNewDevice(userId, sessionId, info) {
  const { browser, os, location } = info;
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { email: true } });
  await Promise.all([
    notifyUser(userId, {
      type: 'ALERT',
      topic: 'securityAlerts',
      title: 'New sign-in to your Roamio account',
      body: `${browser} on ${os}${location ? ` in ${location}` : ''}. Not you? Sign out other devices in Settings.`,
      url: '/settings#security',
      dedupeKey: `signin:${sessionId}`,
    }),
    user ? sendNewSignInEmail(user.email, info) : null,
  ]);
}

// Logs a failed password attempt. This is only called for real accounts, because an
// unknown email has no history to attach the event to.
async function recordFailure(userId, req) {
  await prisma.loginEvent.create({ data: { userId, success: false, ...clientInfo(req) } });
}

/**
 * Called on every refresh-token renewal. Bumps `lastSeenAt` only if the session is
 * still live, which keeps a revoked or idle session from being revived by a stale token.
 * @returns {Promise<boolean>} false means the caller must reject the refresh
 */
async function touch(id, userId) {
  const { count } = await prisma.userSession.updateMany({
    where: { id, ...live(userId) },
    data: { lastSeenAt: new Date() },
  });
  return count === 1;
}

/** Lists the account's live sessions for Settings, marking the caller's own session. */
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

// Signs out one device. Returns false when the session belongs to someone else or is
// already over. The caller can't tell those two cases apart, which avoids confirming
// that another user's session id exists.
async function revoke(userId, id) {
  const { count } = await prisma.userSession.updateMany({ where: { id, ...live(userId) }, data: { revokedAt: new Date() } });
  return count === 1;
}

// Backs the "sign out other devices" button in Settings. The current session is kept,
// so the user isn't logged out of the tab they're using.
async function revokeOthers(userId, currentId) {
  await prisma.userSession.updateMany({
    where: { ...live(userId), ...(currentId ? { id: { not: currentId } } : {}) },
    data: { revokedAt: new Date() },
  });
}

// Signs out every device, including the current one. Called after a password reset,
// because whoever knew the old password must not stay signed in.
async function revokeAll(userId) {
  await prisma.userSession.updateMany({ where: live(userId), data: { revokedAt: new Date() } });
}

/** Recent sign-in attempts (successful and failed), newest first, capped at ACTIVITY_LIMIT. */
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
