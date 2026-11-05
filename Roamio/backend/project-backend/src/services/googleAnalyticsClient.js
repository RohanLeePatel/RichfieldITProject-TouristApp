const { BetaAnalyticsDataClient } = require('@google-analytics/data');

let client;

// Credentials come from GOOGLE_CREDENTIALS_JSON (the service-account JSON as a
// string, for hosts like Vercel with no key file) or, failing that, from the
// file GOOGLE_APPLICATION_CREDENTIALS points at (local development).
function isConfigured() {
  return Boolean(
    process.env.GA_PROPERTY_ID &&
      (process.env.GOOGLE_CREDENTIALS_JSON || process.env.GOOGLE_APPLICATION_CREDENTIALS)
  );
}

function getClient() {
  if (!client) {
    if (process.env.GOOGLE_CREDENTIALS_JSON) {
      let credentials;
      try {
        credentials = JSON.parse(process.env.GOOGLE_CREDENTIALS_JSON);
      } catch {
        const error = new Error('GOOGLE_CREDENTIALS_JSON is not valid JSON.');
        error.statusCode = 503;
        throw error;
      }
      client = new BetaAnalyticsDataClient({ credentials });
    } else {
      client = new BetaAnalyticsDataClient();
    }
  }
  return client;
}

module.exports = { isConfigured, getClient };
