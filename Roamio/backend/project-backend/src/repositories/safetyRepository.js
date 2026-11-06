const prisma = require('../config/prisma');

// Trips that are still ahead of or in progress, starting within the look-ahead window
const upcomingTripWhere = (horizonDays) => {
  const now = new Date();
  const horizon = new Date(now.getTime() + horizonDays * 24 * 60 * 60 * 1000);
  return {
    deletedAt: null,
    status: { notIn: ['COMPLETED', 'CANCELLED'] },
    AND: [
      { OR: [{ endDate: null }, { endDate: { gte: now } }] },
      { OR: [{ startDate: null }, { startDate: { lte: horizon } }] }
    ]
  };
};

const destinationInclude = {
  city: { include: { country: { include: { safetyAdvisory: true } } } }
};

class SafetyRepository {
  async findDestinationWithAdvisory(destinationId) {
    return await prisma.destination.findUnique({
      where: { id: destinationId },
      include: destinationInclude
    });
  }

  async getByCountryIso(countryIso) {
    return await prisma.safetyAdvisory.findUnique({
      where: { countryIso: countryIso.toUpperCase() }
    });
  }

  async upsertAdvisory(countryIso, data) {
    return await prisma.safetyAdvisory.upsert({
      where: { countryIso },
      create: { countryIso, ...data },
      update: { ...data, lastUpdated: new Date() }
    });
  }

  // Distinct countries that have at least one destination (what the sync needs to fetch)
  async findCountriesWithDestinations() {
    return await prisma.country.findMany({
      where: { cities: { some: { destinations: { some: {} } } } },
      select: { code: true }
    });
  }

  // Trips (with their destinations' advisories) to evaluate; pass tripId to scope to one trip
  async findTripsForEvaluation({ tripId, horizonDays = 90 } = {}) {
    return await prisma.trip.findMany({
      where: tripId ? { id: tripId, deletedAt: null } : upcomingTripWhere(horizonDays),
      select: {
        id: true,
        title: true,
        members: { select: { userId: true } },
        destinations: {
          orderBy: { orderIndex: 'asc' },
          select: { destination: { include: destinationInclude } }
        }
      }
    });
  }

  async findAlert(tripId, destinationId, riskLevel) {
    return await prisma.safetyAlert.findUnique({
      where: { tripId_destinationId_riskLevel: { tripId, destinationId, riskLevel } }
    });
  }

  async createAlert(data) {
    return await prisma.safetyAlert.create({ data });
  }

  // Marks active alerts that no longer apply as resolved. An alert no longer applies
  // when its destination was removed or its risk level dropped. The keepers are the
  // (destination, level) pairs still at or above the alert threshold. An empty list
  // means nothing still applies, so every active alert on the trip is resolved.
  async resolveAlertsExcept(tripId, activeKeepers) {
    const result = await prisma.safetyAlert.updateMany({
      where: {
        tripId,
        resolvedAt: null,
        NOT: activeKeepers.map(({ destinationId, riskLevel }) => ({ destinationId, riskLevel }))
      },
      data: { resolvedAt: new Date() }
    });
    return result.count;
  }

  // Reopens a previously resolved alert if the same risk returns
  async reopenAlert(id, message) {
    return await prisma.safetyAlert.update({ where: { id }, data: { resolvedAt: null, message } });
  }

  async findActiveAlertsByTrip(tripId) {
    return await prisma.safetyAlert.findMany({
      where: { tripId, resolvedAt: null },
      include: {
        destination: {
          select: {
            id: true,
            name: true,
            city: { select: { name: true, country: { select: { code: true, name: true } } } }
          }
        }
      },
      orderBy: [{ riskLevel: 'desc' }, { createdAt: 'desc' }]
    });
  }
}

module.exports = new SafetyRepository();
