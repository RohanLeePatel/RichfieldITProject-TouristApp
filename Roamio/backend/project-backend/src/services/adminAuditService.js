const prisma = require('../config/prisma');

// Who did what in the admin dashboard. Entries go in ActivityLog with no tripId, so
// no traveller's activity feed ever shows them; every action starts with ADMIN_.

const PAGE_SIZE = 25;
const PREFIX = 'ADMIN_';

// Never throws: the action it describes has already happened, so a failed log
// line must not turn a success into an error. It is logged to the console instead.
async function log(adminId, action, { entityType = 'USER', entityId = null, details = 'admin dashboard' } = {}) {
  try {
    await prisma.activityLog.create({ data: { userId: adminId, action, entityType, entityId, details } });
  } catch (error) {
    console.error('Could not write the admin audit log:', error.message);
  }
}

async function list({ page } = {}) {
  const current = Math.max(1, Number.parseInt(page, 10) || 1);
  const where = { action: { startsWith: PREFIX } };
  const [rows, total] = await Promise.all([
    prisma.activityLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (current - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: { id: true, action: true, entityType: true, entityId: true, details: true, createdAt: true, user: { select: { id: true, fullName: true } } },
    }),
    prisma.activityLog.count({ where }),
  ]);

  // the people the actions were done to
  const targetIds = [...new Set(rows.filter((r) => r.entityType === 'USER' && r.entityId).map((r) => r.entityId))];
  const targets = targetIds.length ? await prisma.user.findMany({ where: { id: { in: targetIds } }, select: { id: true, fullName: true } }) : [];
  const nameOf = new Map(targets.map((u) => [u.id, u.fullName]));

  return {
    entries: rows.map((r) => ({
      id: r.id,
      at: r.createdAt,
      action: r.action,
      admin: { id: r.user.id, name: r.user.fullName },
      target: { type: r.entityType, id: r.entityId, name: nameOf.get(r.entityId) ?? null },
      details: r.details,
    })),
    page: current,
    pageSize: PAGE_SIZE,
    total,
  };
}

module.exports = { log, list, PAGE_SIZE };
