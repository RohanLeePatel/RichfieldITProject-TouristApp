require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
const { Pool } = require('pg');

// Initialize a connection pool using your pooled Supabase URL
const pool = new Pool({ 
  connectionString: process.env.DATABASE_URL 
});

// Pass the pool to the Prisma adapter
const adapter = new PrismaPg(pool);

// Instantiate the Prisma client once with the adapter
const prisma = new PrismaClient({ adapter });

module.exports = prisma;