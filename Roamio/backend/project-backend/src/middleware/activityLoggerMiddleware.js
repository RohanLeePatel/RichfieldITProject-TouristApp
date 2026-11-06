const activityRepo = require('../repositories/activityRepository');

// What a successful change under /api/trips did, in words for the trip's
// "Recent activity" feed - or null for anything not worth a line. Pure, so the
// selfcheck can cover it. `responseBody` is only needed for a new trip, whose
// id isn't in the URL yet.
function describeChange(method, path, body = {}, responseBody = {}) {
  if (method === 'POST' && path === '/api/trips') {
    const tripId = responseBody?.trip?.id;
    return tripId ? { tripId, action: 'TRIP_CREATED', entityType: 'TRIP', details: 'created the trip' } : null;
  }

  // Two shapes are matched. Groups 1-3 cover /api/trips/:id/<section>[/:itemId], and
  // groups 4-5 cover the budget category route. The trailing slash is optional.
  const match = path.match(/^\/api\/trips\/(\d+)\/(itinerary|expenses|budget|documents)(?:\/([^/]+))?\/?$|^\/api\/trips\/(\d+)\/budget\/categories\/([^/]+)\/?$/);
  if (!match) return null;
  if (match[4]) {
    if (method !== 'PUT') return null;
    return { tripId: Number(match[4]), action: 'BUDGET_LIMIT_SET', entityType: 'BUDGET', details: `set a limit for ${match[5].toLowerCase()}` };
  }

  const tripId = Number(match[1]);
  const [section, itemId] = [match[2], match[3]];
  const entry = (action, entityType, details) => ({ tripId, action, entityType, details });

  if (section === 'itinerary' && method === 'POST' && !itemId) {
    return entry('STOP_ADDED', 'ITINERARY', `added ${body.title || 'a stop'}${body.dayNumber ? ` to day ${body.dayNumber}` : ''}`);
  }
  if (section === 'itinerary' && method === 'DELETE' && itemId) return entry('STOP_REMOVED', 'ITINERARY', 'removed a stop');
  if (section === 'expenses' && method === 'POST' && !itemId) {
    // Builds "(180 ZAR)". The replace drops the stray space that appears when there is no currency.
    const amount = body.amount ? ` (${body.amount} ${String(body.currency || '').toUpperCase()})`.replace(' )', ')') : '';
    return entry('EXPENSE_ADDED', 'EXPENSE', `recorded ${body.title || 'a purchase'}${amount}`);
  }
  if (section === 'expenses' && method === 'DELETE' && itemId) return entry('EXPENSE_DELETED', 'EXPENSE', 'deleted an expense');
  if (section === 'budget' && method === 'PUT' && !itemId) return entry('BUDGET_SET', 'BUDGET', 'updated the budget');
  if (section === 'documents' && method === 'POST' && !itemId) {
    return entry('DOCUMENT_ADDED', 'DOCUMENT', `attached ${body.filename || 'a document'}`);
  }
  if (section === 'documents' && method === 'DELETE' && itemId) return entry('DOCUMENT_REMOVED', 'DOCUMENT', 'removed a document');
  return null;
}

const attachActivityLogger = (req, res, next) => {
  /**
   * Helper function attached to the request object.
   * Controllers can call `req.logActivity(...)` to safely record user actions.
   */
  req.logActivity = async ({ action, entityType, entityId, tripId, details }) => {
    // Fail gracefully if the user is not authenticated yet
    if (!req.user || !req.user.id) return;

    try {
      // Fire and forget: We don't await this in the controller so it doesn't block the API response
      activityRepo.createLog({
        userId: req.user.id,
        tripId,
        action,
        entityType,
        entityId,
        details,
      }).catch(err => console.error('Background Audit Log Error:', err));
    } catch (error) {
      console.error('Failed to initialize audit log:', error);
    }
  };

  // No controller called logActivity, so the feed was always empty. Every
  // successful trip change is logged here instead, once, for all routes (they
  // all answer with res.json). The log is written before the response goes
  // out: on Vercel the function can be frozen once it has replied, which
  // would drop a fire-and-forget write.
  if (req.method !== 'GET' && req.originalUrl.startsWith('/api/trips')) {
    const json = res.json.bind(res);
    res.json = (payload) => {
      const change = res.statusCode < 300 && req.user?.id
        ? describeChange(req.method, req.originalUrl.split('?')[0], req.body, payload)
        : null;
      if (!change) return json(payload);
      activityRepo.createLog({ userId: req.user.id, ...change })
        .catch((err) => console.error('Activity log error:', err))
        .finally(() => json(payload));
      return res;
    };
  }

  next();
};

module.exports = attachActivityLogger;
module.exports.describeChange = describeChange;
