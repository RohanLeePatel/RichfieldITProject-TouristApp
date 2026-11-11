const prisma = require('../config/prisma');
const sessionService = require('./sessionService');
const { httpError } = require('./tripAccessService');
const { isAdminUser } = require('../middleware/isAdmin');

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;
const DAY = 86_400_000;

const positiveInt = (value, fallback) => {
  const n = Number.parseInt(value, 10);
  return Number.isInteger(n) && n > 0 ? n : fallback;
};

// Account state as the dashboard filters it
const STATUS_FILTERS = {
  active: { isActive: true, isVerified: true },
  unverified: { isActive: true, isVerified: false },
  suspended: { isActive: false },
};

const LIST_FIELDS = {
  id: true,
  fullName: true,
  email: true,
  avatarUrl: true,
  isActive: true,
  isVerified: true,
  createdAt: true,
  loginEvents: {
    where: { success: true },
    orderBy: { at: 'desc' },
    take: 1,
    select: { at: true, browser: true, os: true, deviceType: true },
  },
};

const withLastLogin = ({ loginEvents, ...user }) => {
  const last = loginEvents[0];
  return {
    ...user,
    lastLoginAt: last?.at ?? null,
    lastDevice: last ? { browser: last.browser, os: last.os, deviceType: last.deviceType } : null,
  };
};

// Only these columns leave the database: never passwordHash, OTP or reset fields.
async function listUsers({ page, pageSize, q, status, sort } = {}) {
  const currentPage = positiveInt(page, 1);
  const take = Math.min(positiveInt(pageSize, DEFAULT_PAGE_SIZE), MAX_PAGE_SIZE);
  const search = typeof q === 'string' ? q.trim() : '';

  // email and fullName are encrypted, so they can only be matched exactly: a full email
  // address (through its blind index) or a user id. No partial or by-name search.
  const where = {
    deletedAt: null,
    ...(STATUS_FILTERS[status] ?? {}),
    ...(search && {
      OR: [{ email: search }, ...(/^\d{1,9}$/.test(search) ? [{ id: Number(search) }] : [])],
    }),
  };

  const [rows, total] = await Promise.all([
    prisma.user.findMany({
      where,
      select: LIST_FIELDS,
      orderBy: { createdAt: sort === 'oldest' ? 'asc' : 'desc' },
      skip: (currentPage - 1) * take,
      take,
    }),
    prisma.user.count({ where }),
  ]);

  return { users: rows.map(withLastLogin), page: currentPage, pageSize: take, total };
}

const userId = (value) => {
  const id = Number(value);
  if (!Number.isInteger(id) || id <= 0) throw httpError(400, 'Invalid user id.');
  return id;
};

async function findUser(id) {
  const user = await prisma.user.findFirst({ where: { id, deletedAt: null }, select: { id: true, isActive: true } });
  if (!user) throw httpError(404, 'User not found.');
  return user;
}

// One person in full: what they have made, where they signed in from, whether they are signed in now
async function getUser(value, now = Date.now()) {
  const id = userId(value);
  const user = await prisma.user.findFirst({
    where: { id, deletedAt: null },
    select: {
      ...LIST_FIELDS,
      loginEvents: { orderBy: { at: 'desc' }, take: 10, select: { at: true, browser: true, os: true, deviceType: true, success: true } },
      _count: { select: { tripMemberships: true, groupMemberships: true, chatConversations: true, paidExpenses: true, uploadedDocuments: true } },
      tripMemberships: {
        orderBy: { joinedAt: 'desc' },
        take: 5,
        select: { role: true, trip: { select: { id: true, title: true, status: true } } },
      },
    },
  });
  if (!user) throw httpError(404, 'User not found.');

  const liveSessions = await prisma.userSession.count({
    where: { userId: id, revokedAt: null, lastSeenAt: { gte: new Date(now - sessionService.SESSION_DAYS * DAY) } },
  });
  const { loginEvents, _count, tripMemberships, ...profile } = user;
  const lastSuccess = loginEvents.find((e) => e.success);

  return {
    user: {
      ...profile,
      isAdmin: isAdminUser({ id }),
      lastLoginAt: lastSuccess?.at ?? null,
      counts: {
        trips: _count.tripMemberships,
        groups: _count.groupMemberships,
        chats: _count.chatConversations,
        expenses: _count.paidExpenses,
        documents: _count.uploadedDocuments,
      },
      liveSessions,
      recentTrips: tripMemberships.map((m) => ({ ...m.trip, role: m.role })),
      recentLogins: loginEvents,
    },
  };
}

// Admin actions are written to ActivityLog (no tripId, so no traveller's feed shows them)
const audit = (adminId, action, targetId) =>
  prisma.activityLog.create({ data: { userId: adminId, action, entityType: 'USER', entityId: targetId, details: 'admin dashboard' } });

// Suspend or reactivate. A suspended account can't sign in or refresh a session, and
// every device is signed out now. ponytail: an access token already issued works until
// it expires (15 minutes) - add a per-request isActive check only if that is too long.
async function setActive(adminId, value, active) {
  const id = userId(value);
  if (typeof active !== 'boolean') throw httpError(400, 'isActive must be true or false.');
  if (!active && id === adminId) throw httpError(400, "You can't suspend your own account.");
  if (!active && isAdminUser({ id })) throw httpError(400, "An administrator can't be suspended.");

  await findUser(id);
  await prisma.user.update({ where: { id }, data: { isActive: active } });
  if (!active) await sessionService.revokeAll(id);
  await audit(adminId, active ? 'ADMIN_REACTIVATE_USER' : 'ADMIN_SUSPEND_USER', id);
  return { id, isActive: active };
}

async function signOutEverywhere(adminId, value) {
  const id = userId(value);
  await findUser(id);
  await sessionService.revokeAll(id);
  await audit(adminId, 'ADMIN_SIGN_OUT_USER', id);
}

// A spreadsheet runs a cell that starts with = + - @ as a formula, and names are typed by
// users, so those cells get a leading quote.
const csvCell = (value) => {
  let text = value == null ? '' : String(value);
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

// Every registered user, oldest first, in pages so a big table never loads at once
async function exportCsv() {
  const lines = [['id', 'name', 'email', 'status', 'joined', 'last_login'].join(',')];
  const status = (u) => (!u.isActive ? 'suspended' : !u.isVerified ? 'unverified' : 'active');
  let cursor;
  for (;;) {
    const rows = await prisma.user.findMany({
      where: { deletedAt: null },
      select: LIST_FIELDS,
      orderBy: { id: 'asc' },
      take: 500,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
    });
    for (const user of rows.map(withLastLogin)) {
      lines.push(
        [user.id, user.fullName, user.email, status(user), user.createdAt.toISOString(), user.lastLoginAt?.toISOString() ?? ''].map(csvCell).join(','),
      );
    }
    if (rows.length < 500) break;
    cursor = rows[rows.length - 1].id;
  }
  return `${lines.join('\r\n')}\r\n`;
}

module.exports = { listUsers, getUser, setActive, signOutEverywhere, exportCsv, csvCell };
