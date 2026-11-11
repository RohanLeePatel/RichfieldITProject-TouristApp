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

// Filters: action (exact code), adminId, targetId (the user it was done to), from / to (YYYY-MM-DD)
function whereFor({ action, adminId, targetId, from, to } = {}) {
  const id = (v) => (/^\d{1,9}$/.test(String(v ?? '')) ? Number(v) : null);
  const date = (v, end) => {
    const d = /^\d{4}-\d{2}-\d{2}$/.test(String(v ?? '')) ? new Date(`${v}T${end ? '23:59:59.999' : '00:00:00'}Z`) : null;
    return d && !Number.isNaN(d.getTime()) ? d : null;
  };
  const gte = date(from);
  const lte = date(to, true);
  return {
    action: typeof action === 'string' && action.startsWith(PREFIX) ? action : { startsWith: PREFIX },
    ...(id(adminId) && { userId: id(adminId) }),
    ...(id(targetId) && { entityType: 'USER', entityId: id(targetId) }),
    ...((gte || lte) && { createdAt: { ...(gte && { gte }), ...(lte && { lte }) } }),
  };
}

const SELECT = { id: true, action: true, entityType: true, entityId: true, details: true, createdAt: true, user: { select: { id: true, fullName: true } } };

async function shape(rows) {
  // the people the actions were done to
  const targetIds = [...new Set(rows.filter((r) => r.entityType === 'USER' && r.entityId).map((r) => r.entityId))];
  const targets = targetIds.length ? await prisma.user.findMany({ where: { id: { in: targetIds } }, select: { id: true, fullName: true } }) : [];
  const nameOf = new Map(targets.map((u) => [u.id, u.fullName]));
  return rows.map((r) => ({
    id: r.id,
    at: r.createdAt,
    action: r.action,
    admin: { id: r.user.id, name: r.user.fullName },
    target: { type: r.entityType, id: r.entityId, name: nameOf.get(r.entityId) ?? null },
    details: r.details,
  }));
}

async function list({ page, ...filters } = {}) {
  const current = Math.max(1, Number.parseInt(page, 10) || 1);
  const where = whereFor(filters);
  const [rows, total] = await Promise.all([
    prisma.activityLog.findMany({ where, orderBy: { createdAt: 'desc' }, skip: (current - 1) * PAGE_SIZE, take: PAGE_SIZE, select: SELECT }),
    prisma.activityLog.count({ where }),
  ]);
  return { entries: await shape(rows), page: current, pageSize: PAGE_SIZE, total };
}

// Everything that matches the filters (newest 5000) as CSV text
const csvCell = (v) => {
  let t = v == null ? '' : String(v);
  if (/^[=+\-@\t\r]/.test(t)) t = `'${t}`;
  return /[",\n\r]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
};
async function exportCsv(filters = {}) {
  const rows = await prisma.activityLog.findMany({ where: whereFor(filters), orderBy: { createdAt: 'desc' }, take: 5000, select: SELECT });
  const lines = [['when', 'admin', 'action', 'target_type', 'target_id', 'target_name', 'details'].join(',')];
  for (const e of await shape(rows)) {
    lines.push([e.at.toISOString(), e.admin.name, e.action, e.target.type, e.target.id, e.target.name, e.details].map(csvCell).join(','));
  }
  return `${lines.join('\r\n')}\r\n`;
}

// The distinct actions on record, for the filter dropdown
const actions = async () =>
  (await prisma.activityLog.findMany({ where: { action: { startsWith: PREFIX } }, distinct: ['action'], select: { action: true } })).map((r) => r.action).sort();

module.exports = { log, list, exportCsv, actions, whereFor, PAGE_SIZE };
