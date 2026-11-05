const { isConfigured, getClient: getGaClient } = require('./googleAnalyticsClient');

function getClient() {
  if (!isConfigured()) {
    const error = new Error('Google Analytics is not configured (GA_PROPERTY_ID and GOOGLE_CREDENTIALS_JSON or GOOGLE_APPLICATION_CREDENTIALS).');
    error.statusCode = 503;
    throw error;
  }
  return getGaClient();
}

const metricValue = (row, i) => Number(row?.metricValues?.[i]?.value ?? 0);

// Active users, page views and average session duration (seconds) for the last
// 7 and 30 days, plus yesterday's active users as the daily-active-users figure.
async function getOverview() {
  const analytics = getClient();
  let response;
  try {
    [response] = await analytics.runReport({
      property: `properties/${process.env.GA_PROPERTY_ID}`,
      dateRanges: [
        { name: 'last7Days', startDate: '7daysAgo', endDate: 'today' },
        { name: 'last30Days', startDate: '30daysAgo', endDate: 'today' },
        { name: 'yesterday', startDate: 'yesterday', endDate: 'yesterday' },
      ],
      metrics: [{ name: 'activeUsers' }, { name: 'screenPageViews' }, { name: 'averageSessionDuration' }],
    });
  } catch (err) {
    const error = new Error(`Google Analytics request failed: ${err.details || err.message}`);
    error.statusCode = 502;
    throw error;
  }

  // With several date ranges and no dimensions, GA adds a dateRange dimension to each row
  const byRange = Object.fromEntries((response.rows || []).map((row) => [row.dimensionValues[0].value, row]));
  const summarize = (name) => ({
    activeUsers: metricValue(byRange[name], 0),
    pageViews: metricValue(byRange[name], 1),
    avgSessionDurationSeconds: Math.round(metricValue(byRange[name], 2) * 10) / 10,
  });

  return {
    propertyId: process.env.GA_PROPERTY_ID,
    dailyActiveUsers: metricValue(byRange.yesterday, 0),
    last7Days: summarize('last7Days'),
    last30Days: summarize('last30Days'),
  };
}

module.exports = { getOverview };
