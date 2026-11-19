// Run the real fetch helper with synthetic browser storage and mocked HTTP.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const data = { user: JSON.stringify({ id: 1 }), 'roamio_cache:/api/trips': 'legacy' };
globalThis.localStorage = {
  ...data,
  getItem(key) { return this[key] ?? null; },
  setItem(key, value) { this[key] = value; },
  removeItem(key) { delete this[key]; },
};
const deleted = [];
globalThis.caches = { delete: async (key) => { deleted.push(key); return true; } };
globalThis.window = { caches, dispatchEvent() {}, location: { pathname: '/', search: '', assign() {} } };
let answer = () => Promise.resolve(new Response('{"synthetic":true}', { headers: { 'content-type': 'application/json' } }));
globalThis.fetch = () => answer();
const source = (await readFile(new URL('./client.js', import.meta.url), 'utf8')).replaceAll('import.meta.env', '({})');
const client = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
client.setToken('synthetic-token');
assert.equal(localStorage.getItem('roamio_cache:/api/trips'), null);
assert.ok(deleted.includes('roamio-docs'));

// Personal/admin data is excluded even if an older server omits no-store.
await client.authedFetch('/api/admin/users');
await client.authedFetch('/api/users/me/travellers');
assert.equal(Object.keys(localStorage).filter((key) => key.startsWith('roamio_cache:')).length, 0);

answer = () => Promise.resolve(new Response('{"synthetic":true}', { headers: { 'cache-control': 'no-store' } }));
await client.authedFetch('/api/trips');
assert.equal(localStorage.getItem('roamio_cache:1:/api/trips'), null);

// Older cacheable responses are scoped to the signed-in account.
answer = () => Promise.resolve(new Response('{"synthetic":true}'));
await client.authedFetch('/api/trips');
assert.ok(localStorage.getItem('roamio_cache:1:/api/trips'));
localStorage.setItem('user', JSON.stringify({ id: 2 }));
answer = () => Promise.reject(new Error('offline'));
await assert.rejects(client.authedFetch('/api/trips'), { status: 0 });

// A response finishing after sign-out must not repopulate persistent storage.
let complete;
answer = () => new Promise((resolve) => { complete = resolve; });
const pending = client.authedFetch('/api/trips');
await new Promise((resolve) => setImmediate(resolve));
client.clearApiCache();
complete(new Response('{"synthetic":true}'));
await pending;
assert.equal(Object.keys(localStorage).filter((key) => key.startsWith('roamio_cache:')).length, 0);
console.log('client privacy selfcheck: all assertions passed');
