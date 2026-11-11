const axios = require('axios');
const safetyRepository = require('../repositories/safetyRepository');
const { notifyUser } = require('./pushService');
const { EMERGENCY_NUMBERS, DEFAULT_EMERGENCY_NUMBER, MOCK_ADVISORIES } = require('../data/safetyData');

const ALERT_MIN_LEVEL = 3; // "Reconsider travel" and above raise a trip alert
const LEVEL_LABELS = {
  1: 'Exercise normal precautions',
  2: 'Exercise increased caution',
  3: 'Reconsider travel',
  4: 'Do not travel'
};

// Live advisories: the US State Department's public feed (no key). Every
// country's entry, refreshed a few times a week.
const STATE_DEPT_URL = 'https://cadataapi.state.gov/api/TravelAdvisories';
// The State Department feed is one large file, so we keep a single copy per warm
// serverless instance. Each instance fetches it again after the TTL. If cold starts
// make the 1-2 second fetch noticeable, move the cache into the database.
const FEED_TTL_MS = 6 * 60 * 60 * 1000;
let feed = { at: 0, list: null };
const advisoryCache = new Map(); // alpha-3 -> { at, advisory }

// A country's entry: matched on the alpha-3 code in its link
// (".../destination.zaf.html"), else on the name in its title - a few entries
// ("namibia-travel-advisory.html") have no code.
function pickStateDeptEntry(list, iso, name) {
  const code = String(iso || '').toLowerCase();
  const byCode = list.find((entry) => String(entry.Link || '').toLowerCase().endsWith(`destination.${code}.html`));
  if (byCode || !name) return byCode || null;
  const wanted = name.trim().toLowerCase();
  return list.find((entry) => String(entry.Title || '').split(/ - | Travel Advisory/)[0].trim().toLowerCase() === wanted) || null;
}

// TravelRiskAPI sends UTC without a zone ("2026-07-07T00:00:00"), which
// Date would read as server-local time
const utcDate = (value) => (value ? new Date(/Z|[+-]\d\d:?\d\d$/.test(value) ? value : `${value}Z`) : new Date());

const clampLevel = (n) => Math.min(4, Math.max(1, Math.round(Number(n) || 1)));

const stripHtml = (html) => String(html || '')
  .replace(/<[^>]*>/g, ' ')
  .replace(/&nbsp;|&#8239;/g, ' ')
  .replace(/&quot;/g, '"')
  .replace(/&amp;/g, '&')
  .replace(/\s+/g, ' ')
  .replace(/ ([,.;:!?])/g, '$1') // "<b>disasters</b>, unrest" left "disasters , unrest"
  .trim();

class SafetySyncService {
  useMock() {
    return process.env.SAFETY_SYNC_MODE === 'mock' || !process.env.TRAVEL_RISK_API_KEY_1;
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
    if (!/^[A-Za-z]{2,3}$/.test(String(iso))) throw new Error('Invalid country code');
    if (this.useMock()) {
      const mock = MOCK_ADVISORIES[iso] || { level: 1, score: 1, alerts: 0, text: 'Exercise normal precautions.' };
      return this.buildAdvisoryData(iso, mock, 'MOCK');
    }

    const { data } = await axios.get(`${process.env.TRAVEL_RISK_API_URL_1}/countries/${iso}`, {
      headers: { 'X-API-Key': process.env.TRAVEL_RISK_API_KEY_1, 'Content-Type': 'application/json' }
    });
    return {
      ...this.buildAdvisoryData(iso, {
        level: data.advisory_level,
        score: data.risk_score,
        alerts: data.active_alerts,
        text: data.advisory_description
      }, 'TRAVEL_RISK_API'),
      lastUpdated: utcDate(data.advisory_date || data.last_updated)
    };
  }

  // What the trip page shows, fetched on request. The scheduled sync
  // (syncCountryAdvisories) doesn't run on Vercel, so the page can't rely on it:
  // TravelRiskAPI when its key is set, else the free State
  // Department feed. Cached per country - TravelRiskAPI's free plan allows
  // 100 calls a day. null when neither source knows the country.
  async liveAdvisory(iso, name) {
    const code = String(iso).toUpperCase();
    const hit = advisoryCache.get(code);
    if (hit && Date.now() - hit.at < FEED_TTL_MS) return hit.advisory;

    let advisory = null;
    if (!this.useMock()) {
      advisory = await this.fetchAdvisory(code)
        .then((data) => {
          const numbers = EMERGENCY_NUMBERS[code];
          // known numbers only, not the 112 guess the stored rows fall back to
          return { ...data, countryIso: code, policeNumber: numbers?.police || null, medicalNumber: numbers?.medical || null };
        })
        .catch((error) => {
          console.error(`TravelRiskAPI failed for ${code}:`, error.message);
          return null;
        });
    }
    advisory = advisory || await this.fetchStateDeptAdvisory(code, name);
    if (advisory) advisoryCache.set(code, { at: Date.now(), advisory });
    return advisory;
  }

  // null when the feed has no entry for the country. Emergency numbers we
  // don't know stay empty rather than a guessed default.
  async fetchStateDeptAdvisory(iso, name) {
    if (!feed.list || Date.now() - feed.at > FEED_TTL_MS) {
      const { data } = await axios.get(STATE_DEPT_URL, { timeout: 8000 });
      feed = { at: Date.now(), list: Array.isArray(data) ? data : [] };
    }
    const code = String(iso).toUpperCase();
    const entry = pickStateDeptEntry(feed.list, code, name);
    const level = Number(entry?.Title.match(/Level (\d)/)?.[1]);
    if (!level) return null;
    const numbers = EMERGENCY_NUMBERS[code];
    return {
      countryIso: code,
      ...this.buildAdvisoryData(code, { level, score: level, alerts: 0, text: entry.Summary }, 'US_STATE_DEPT'),
      policeNumber: numbers?.police || null,
      medicalNumber: numbers?.medical || null,
      lastUpdated: new Date(entry.Updated || entry.Published),
      link: entry.Link
    };
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
            const day = new Date().toISOString().slice(0, 10); // a re-run today stays quiet; a reopened alert tomorrow speaks again
            await Promise.all(trip.members.map((m) => notifyUser(m.userId, {
              type: 'ALERT',
              topic: 'safetyAlerts',
              title: `Safety alert for "${trip.title}"`,
              body: message,
              url: `/trips/${trip.id}`,
              tripId: trip.id,
              dedupeKey: `safety:${trip.id}:${destination.id}:${advisory.riskLevel}:${day}`
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
module.exports.pickStateDeptEntry = pickStateDeptEntry;
