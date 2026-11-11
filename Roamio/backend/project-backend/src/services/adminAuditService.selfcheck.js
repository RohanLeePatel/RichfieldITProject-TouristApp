const assert = require('node:assert/strict');
const { whereFor } = require('./adminAuditService');

// no filters: every admin action
assert.deepEqual(whereFor(), { action: { startsWith: 'ADMIN_' } });
// an action must be an ADMIN_ code, so the filter can't read traveller activity
assert.deepEqual(whereFor({ action: 'TRIP_CREATED' }).action, { startsWith: 'ADMIN_' });
assert.equal(whereFor({ action: 'ADMIN_SUSPEND_USER' }).action, 'ADMIN_SUSPEND_USER');
// ids and dates are validated; junk is ignored
const w = whereFor({ targetId: '12', adminId: 'x', from: '2026-01-01', to: 'nope' });
assert.equal(w.entityId, 12);
assert.equal(w.userId, undefined);
assert.equal(w.createdAt.gte.toISOString(), '2026-01-01T00:00:00.000Z');
assert.equal(w.createdAt.lte, undefined);
console.log('admin audit selfcheck passed');
