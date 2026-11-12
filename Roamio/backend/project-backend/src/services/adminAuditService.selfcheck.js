const assert = require('node:assert/strict');
const { whereFor } = require('./adminAuditService');

// no filters: every admin action
assert.deepEqual(whereFor(), { action: { startsWith: 'ADMIN_' } });
// an action must be an ADMIN_ code, so the filter can't read traveller activity
assert.deepEqual(whereFor({ action: 'TRIP_CREATED' }).action, { startsWith: 'ADMIN_' });
assert.equal(whereFor({ action: 'ADMIN_SUSPEND_USER' }).action, 'ADMIN_SUSPEND_USER');
// Invalid IDs are ignored. Date filters can have either bound.
const w = whereFor({ targetId: '12', adminId: 'x', from: '2026-01-01' });
assert.equal(w.entityId, 12);
assert.equal(w.userId, undefined);
assert.equal(w.createdAt.gte.toISOString(), '2026-01-01T00:00:00.000Z');
assert.equal(w.createdAt.lte, undefined);
assert.equal(whereFor({ to: '2026-01-01' }).createdAt.lte.toISOString(), '2026-01-01T23:59:59.999Z');
const sameDay = whereFor({ from: '2024-02-29', to: '2024-02-29' }).createdAt;
assert.equal(sameDay.gte.toISOString(), '2024-02-29T00:00:00.000Z');
assert.equal(sameDay.lte.toISOString(), '2024-02-29T23:59:59.999Z');
assert.throws(() => whereFor({ from: '2026-02-29' }), { statusCode: 400, message: /valid start date/ });
assert.throws(() => whereFor({ to: 'nope' }), { statusCode: 400, message: /valid end date/ });
assert.throws(() => whereFor({ to: ['2026-01-01'] }), { statusCode: 400 });
assert.throws(() => whereFor({ from: '2026-01-02', to: '2026-01-01' }), { statusCode: 400, message: /on or before/ });
console.log('admin audit selfcheck passed');
