const prisma = require('../config/prisma');

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

const positiveInt = (value, fallback) => {
  const n = Number.parseInt(value, 10);
  return Number.isInteger(n) && n > 0 ? n : fallback;
};

// Only these columns leave the database: never passwordHash, OTP or reset fields.
async function listUsers({ page, pageSize, q } = {}) {
  const currentPage = positiveInt(page, 1);
  const take = Math.min(positiveInt(pageSize, DEFAULT_PAGE_SIZE), MAX_PAGE_SIZE);
  const search = typeof q === 'string' ? q.trim() : '';

  // email and fullName are encrypted, so they can only be matched exactly: a full email
  // address (through its blind index) or a user id. No partial or by-name search.
  const where = {
    deletedAt: null,
    ...(search && {
      OR: [{ email: search }, ...(/^\d{1,9}$/.test(search) ? [{ id: Number(search) }] : [])],
    }),
  };

  const [rows, total] = await Promise.all([
    prisma.user.findMany({
      where,
      select: {
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
      },
      orderBy: { createdAt: 'desc' },
      skip: (currentPage - 1) * take,
      take,
    }),
    prisma.user.count({ where }),
  ]);

  const users = rows.map(({ loginEvents, ...user }) => {
    const last = loginEvents[0];
    return {
      ...user,
      lastLoginAt: last?.at ?? null,
      lastDevice: last ? { browser: last.browser, os: last.os, deviceType: last.deviceType } : null,
    };
  });

  return { users, page: currentPage, pageSize: take, total };
}

module.exports = { listUsers };
