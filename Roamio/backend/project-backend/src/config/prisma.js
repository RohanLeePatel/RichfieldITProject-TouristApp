const { PrismaClient } = require('../generated/prisma/index.js');
const { Pool } = require('pg');
const { PrismaPg } = require('@prisma/adapter-pg');
const { withColumnEncryption } = require('../utils/columnEncryption');

const connectionString = `${process.env.DATABASE_URL}`;
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = withColumnEncryption(new PrismaClient({ adapter }));

// A client built without its models only shows up later as "Cannot read properties of
// undefined (reading 'findFirst')" on the first query. Fail at load with the real cause.
if (typeof prisma.user?.findFirst !== 'function') {
  throw new Error('Prisma client has no models: src/generated/prisma is missing or stale (run `prisma generate`).');
}

module.exports = prisma;
