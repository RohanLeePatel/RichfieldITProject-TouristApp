const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

class SafetyRepository {
  // Fetch safety data linked to a specific destination
  async getByDestinationId(destinationId) {
    return await prisma.safetyAdvisory.findUnique({
      where: { destinationId: parseInt(destinationId, 10) }
    });
  }

  // Fetch safety data directly by ISO code
  async getByCountryIso(countryIso) {
    return await prisma.safetyAdvisory.findUnique({
      where: { countryIso: countryIso.toUpperCase() }
    });
  }
}

module.exports = new SafetyRepository();