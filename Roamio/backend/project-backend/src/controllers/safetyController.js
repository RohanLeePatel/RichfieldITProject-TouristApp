const safetyService = require('../services/safetyService');
const { parseId } = require('../services/tripAccessService');

class SafetyController {
  async getDestinationSafety(req, res, next) {
    try {
      const destinationId = parseId(req.params.destinationId, 'destinationId');
      res.status(200).json({ safety: await safetyService.getDestinationSafety(destinationId) });
    } catch (error) {
      next(error);
    }
  }

  async getCountrySafety(req, res, next) {
    try {
      res.status(200).json({ safety: await safetyService.getCountrySafety(req.params.countryIso) });
    } catch (error) {
      next(error);
    }
  }

  async getTripSafetyAlerts(req, res, next) {
    try {
      const tripId = parseId(req.params.tripId, 'tripId');
      const alerts = await safetyService.getTripSafetyAlerts(tripId, req.user.id);
      res.status(200).json({ alerts, count: alerts.length });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new SafetyController();
