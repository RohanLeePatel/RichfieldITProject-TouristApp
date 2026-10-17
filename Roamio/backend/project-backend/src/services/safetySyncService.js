const axios = require('axios');
const safetyRepository = require('../repositories/safetyRepository');
const notificationRepository = require('../repositories/notificationRepository');
const { EMERGENCY_NUMBERS, DEFAULT_EMERGENCY_NUMBER, MOCK_ADVISORIES } = require('../data/safetyData');

const ALERT_MIN_LEVEL = 3; // "Reconsider travel" and above raise a trip alert
const LEVEL_LABELS = {
  1: 'Exercise normal precautions',
  2: 'Exercise increased caution',
  3: 'Reconsider travel',
  4: 'Do not travel'
};

const clampLevel = (n) => Math.min(4, Math.max(1, Math.round(Number(n) || 1)));

const stripHtml = (html) => String(html || '')
  .replace(/<[^>]*>/g, ' ')
  .replace(/&nbsp;|&#8239;/g, ' ')
  .replace(/&quot;/g, '"')
  .replace(/&amp;/g, '&')
  .replace(/\s+/g, ' ')
  .trim();

class SafetySyncService {
  useMock() {
    return process.env.SAFETY_SYNC_MODE === 'mock' || !process.env.TRAVEL_RISK_API_KEY;
  }

  // Normalises a provider (or mock) payload into the SafetyAdvisory columns
  buildAdvisoryData(iso, { level, score, alerts, text }, source) {
    const riskLevel = clampLevel(level ?? score);
    const numbers = EMERGENCY_NUMBERS[iso];
    return {
      riskLevel,
      compositeScore: Math.round(Number(score ?? riskLevel)),
      advisoryLevel: LEVEL_LABELS[riskLevel],
      summary: stripHtml(text) || null,
      activeAlertsCount: alerts || 0,
      policeNumber: numbers?.police || DEFAULT_EMERGENCY_NUMBER,
      medicalNumber: numbers?.medical || DEFAULT_EMERGENCY_NUMBER,
      source
    };
  }

  async fetchAdvisory(iso) {
    if (this.useMock()) {
      const mock = MOCK_ADVISORIES[iso] || { level: 1, score: 1, alerts: 0, text: 'Exercise normal precautions.' };
      return this.buildAdvisoryData(iso, mock, 'MOCK');
    }

    const { data } = await axios.get(`${process.env.TRAVEL_RISK_API_URL}/countries/${iso}`, {
      headers: { 'X-API-Key': process.env.TRAVEL_RISK_API_KEY, 'Content-Type': 'application/json' }
    });
    return this.buildAdvisoryData(iso, {
      level: data.advisory_level,
      score: data.risk_score,
      alerts: data.active_alerts,
      text: data.advisory_description
    }, 'TRAVEL_RISK_API');
  }

  async syncCountryAdvisories() {
    console.log(`Starting safety advisory sync (${this.useMock() ? 'mock' : 'TravelRiskAPI'})...`);
    try {
      const countries = await safetyRepository.findCountriesWithDestinations();
      for (const { code } of countries) {
        try {
          await safetyRepository.upsertAdvisory(code, await this.fetchAdvisory(code));
          console.log(`Synced safety data for ${code}`);
        } catch (apiError) {
          // Keep the last good advisory rather than overwriting it with a failure
          console.error(`Failed to sync ${code}:`, apiError.message);
        }
      }
      const summary = await this.evaluateUpcomingTrips();
      console.log(`Safety sync complete. Trips evaluated: ${summary.tripsEvaluated}, new alerts: ${summary.newAlerts}`);
    } catch (error) {
      console.error('Critical error during safety sync:', error.message);
    }
  }

  // Evaluates trips (one, or all upcoming) against stored advisories; notifies members of NEW alerts only
  async evaluateTrips({ tripId, notify = false } = {}) {
    const trips = await safetyRepository.findTripsForEvaluation({ tripId });
    let newAlerts = 0;

    for (const trip of trips) {
      const keepers = [];
      const seen = new Set();

      for (const { destination } of trip.destinations) {
        const advisory = destination.city?.country?.safetyAdvisory;
        if (!advisory || advisory.riskLevel < ALERT_MIN_LEVEL || seen.has(destination.id)) continue;
        seen.add(destination.id);

        const message = `${destination.name}, ${destination.city.country.name}: ${advisory.advisoryLevel} (level ${advisory.riskLevel}/4)`;
        keepers.push({ destinationId: destination.id, riskLevel: advisory.riskLevel });

        const existing = await safetyRepository.findAlert(trip.id, destination.id, advisory.riskLevel);
        let isNew = false;
        if (!existing) {
          await safetyRepository.createAlert({
            tripId: trip.id, destinationId: destination.id, riskLevel: advisory.riskLevel, message
          });
          isNew = true;
        } else if (existing.resolvedAt) {
          await safetyRepository.reopenAlert(existing.id, message);
          isNew = true;
        }

        if (isNew) {
          newAlerts += 1;
          if (notify) {
            await Promise.all(trip.members.map((m) => notificationRepository.createNotification({
              userId: m.userId,
              title: `Safety alert for "${trip.title}"`,
              message,
              type: 'ALERT'
            })));
          }
        }
      }

      await safetyRepository.resolveAlertsExcept(trip.id, keepers);
    }

    return { tripsEvaluated: trips.length, newAlerts };
  }

  async evaluateUpcomingTrips() {
    return await this.evaluateTrips({ notify: true });
  }
}

module.exports = new SafetySyncService();
module.exports.ALERT_MIN_LEVEL = ALERT_MIN_LEVEL;
