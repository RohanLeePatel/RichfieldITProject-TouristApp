const activityRepo = require('../repositories/activity.repository');

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

  next();
};

module.exports = attachActivityLogger;