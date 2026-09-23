require('dotenv').config();
const safetySyncService = require('./src/services/safetySyncService');
const { PrismaClient } = require('@prisma/client');
const { Pool } = require('pg');
const { PrismaPg } = require('@prisma/adapter-pg');

const connectionString = `${process.env.DATABASE_URL}`;
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function runTest() {
  console.log(' Starting manual test of TravelRiskAPI sync...');
  
  try {
    const destCount = await prisma.destination.count();
    if (destCount === 0) {
      console.log(' Database is empty. Seeding South Africa (ZAF) for testing...');
      await prisma.destination.create({
        data: {
          name: 'Table Mountain',
          // REMOVED countryIso here - your database handles it perfectly via relations!
          latitude: -33.9249,
          longitude: 18.4241,
          city: {
            create: {
              name: 'Cape Town',
              country: {
                connectOrCreate: {
                  where: { code: 'ZAF' },
                  create: {
                    name: 'South Africa',
                    code: 'ZAF'
                  }
                }
              }
            }
          }
        }
      });
    }

    await safetySyncService.syncCountryAdvisories();
    
    const savedData = await prisma.safetyAdvisory.findMany();
    
    console.dir(savedData, { depth: null });
    console.log('\n Test complete. If you see risk data above, the integration works!');
    
  } catch (error) {
    console.error(' Test failed:', error);
  } finally {
    await prisma.$disconnect();
    process.exit(0);
  }
}

runTest();