const budgetService = require('../services/budgetService');
const { parseId } = require('../services/tripAccessService');

const budgetController = {
  async getBudget(req, res, next) {
    try {
      const tripId = parseId(req.params.tripId, 'tripId');
      const budget = await budgetService.getBudget(tripId, req.user.id);
      res.status(200).json({ budget });
    } catch (error) {
      next(error);
    }
  },

  async setBudget(req, res, next) {
    try {
      const tripId = parseId(req.params.tripId, 'tripId');
      const budget = await budgetService.setBudget(tripId, req.user.id, req.body || {});
      res.status(200).json({ budget });
    } catch (error) {
      next(error);
    }
  },

  async getSummary(req, res, next) {
    try {
      const tripId = parseId(req.params.tripId, 'tripId');
      const summary = await budgetService.getSummary(tripId, req.user.id);
      res.status(200).json({ summary });
    } catch (error) {
      next(error);
    }
  },

  async setSplit(req, res, next) {
    try {
      const tripId = parseId(req.params.tripId, 'tripId');
      const splitShares = await budgetService.setSplit(tripId, req.user.id, req.body || {});
      res.status(200).json({ splitShares });
    } catch (error) {
      next(error);
    }
  },

  async getBalances(req, res, next) {
    try {
      const tripId = parseId(req.params.tripId, 'tripId');
      const balances = await budgetService.getBalances(tripId, req.user.id);
      res.status(200).json({ balances });
    } catch (error) {
      next(error);
    }
  },

  async setCategoryLimit(req, res, next) {
    try {
      const tripId = parseId(req.params.tripId, 'tripId');
      const budget = await budgetService.setCategoryLimit(tripId, req.user.id, req.params.category, req.body || {});
      res.status(200).json({ budget });
    } catch (error) {
      next(error);
    }
  },

  async removeCategoryLimit(req, res, next) {
    try {
      const tripId = parseId(req.params.tripId, 'tripId');
      await budgetService.removeCategoryLimit(tripId, req.user.id, req.params.category);
      res.status(200).json({ message: 'Category limit removed' });
    } catch (error) {
      next(error);
    }
  }
};

module.exports = budgetController;
