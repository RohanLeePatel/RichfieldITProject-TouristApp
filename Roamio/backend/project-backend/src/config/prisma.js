const { PrismaClient } = require('../generated/prisma/index.js');
const { Pool } = require('pg');
const { PrismaPg } = require('@prisma/adapter-pg');
const { withColumnEncryption } = require('../utils/columnEncryption');

// Built on first use, not at load. Vercel's bundler wraps every file in a "run once"
// cache that is filled before the body runs: if the body throws (a bad APP_ENCRYPTION_KEY,
// say) the retry gets an empty module, and every query then fails with the unhelpful
// "Cannot read properties of undefined (reading 'findFirst')". Built lazily, a failure
// is thrown, and logged, with its real message on each request until it is fixed.
let client;

function createClient() {
  const pool = new Pool({ connectionString: `${process.env.DATABASE_URL}` });
  const created = withColumnEncryption(new PrismaClient({ adapter: new PrismaPg(pool) }));
  if (typeof created.user?.findFirst !== 'function') {
    throw new Error('Prisma client has no models: src/generated/prisma is missing or stale (run `prisma generate`).');
  }
  return created;
}

function getClient() {
  if (!client) {
    try {
      client = createClient();
    } catch (error) {
      console.error('Prisma client failed to start:', error);
      throw error;
    }
  }
  return client;
}

module.exports = new Proxy({}, {
  get(_target, key) {
    const real = getClient();
    const value = real[key];
    return typeof value === 'function' ? value.bind(real) : value;
  },
});
