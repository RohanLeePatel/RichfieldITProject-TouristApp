const { PrismaClient } = require('@prisma/client');
const { Pool } = require('pg');
const { PrismaPg } = require('@prisma/adapter-pg');
const { withColumnEncryption } = require('../utils/columnEncryption');

const connectionString = `${process.env.DATABASE_URL}`;
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = withColumnEncryption(new PrismaClient({ adapter }));

module.exports = prisma;
