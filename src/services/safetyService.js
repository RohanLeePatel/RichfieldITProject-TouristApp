const safetyRepository = require('../repositories/safetyRepository');
const safetySyncService = require('./safetySyncService');
const { httpError, assertTripAccess } = require('./tripAccessService');

const serializeAdvisory = (advisory) => advisory && {
  countryIso: advisory.countryIso,
  riskLevel: advisory.riskLevel,
  advisoryLevel: advisory.advisoryLevel,
  summary: advisory.summary,
  activeAlertsCount: advisory.activeAlertsCount,
  emergencyNumbers: { police: advisory.policeNumber, medical: advisory.medicalNumber },
  source: advisory.source,
  lastUpdated: advisory.lastUpdated
};

class SafetyService {
  async getDestinationSafety(destinationId) {
    const destination = await safetyRepository.findDestinationWithAdvisory(destinationId);
    if (!destination) throw httpError(404, 'Destination not found');

    const country = destination.city.country;
    const advisory = country.safetyAdvisory;
    if (!advisory) throw httpError(404, 'Safety advisory data is not yet available for this destination.');

    return {
      destination: { id: destination.id, name: destination.name, city: destination.city.name, country: country.name },
      ...serializeAdvisory(advisory),
      alertsTriggered: advisory.riskLevel >= safetySyncService.ALERT_MIN_LEVEL
    };
  }

  async getCountrySafety(countryIso) {
    const advisory = await safetyRepository.getByCountryIso(countryIso);
    if (!advisory) throw httpError(404, `No safety data found for country code: ${countryIso}`);
    return serializeAdvisory(advisory);
  }

  // Re-evaluates the trip against current advisories (no notifications) and returns active alerts
  async getTripSafetyAlerts(tripId, userId) {
    await assertTripAccess(tripId, userId);
    await safetySyncService.evaluateTrips({ tripId, notify: false });
    const alerts = await safetyRepository.findActiveAlertsByTrip(tripId);

    return alerts.map((a) => ({
      id: a.id,
      riskLevel: a.riskLevel,
      message: a.message,
      createdAt: a.createdAt,
      destination: {
        id: a.destination.id,
        name: a.destination.name,
        city: a.destination.city.name,
        country: a.destination.city.country.name,
        countryIso: a.destination.city.country.code
      }
    }));
  }
}

module.exports = new SafetyService();
