const expenseService = require('../services/expenseService');
const { parseId } = require('../services/tripAccessService');

const expenseController = {
  async createExpense(req, res, next) {
    try {
      const tripId = parseId(req.params.tripId, 'tripId');
      const result = await expenseService.createExpense(tripId, req.user.id, req.body || {});
      res.status(201).json(result);
    } catch (error) {
      next(error);
    }
  },

  async getTripExpenses(req, res, next) {
    try {
      const tripId = parseId(req.params.tripId, 'tripId');
      const expenses = await expenseService.listExpenses(tripId, req.user.id, { category: req.query.category });
      res.status(200).json({ expenses });
    } catch (error) {
      next(error);
    }
  },

  async getExpenseById(req, res, next) {
    try {
      const tripId = parseId(req.params.tripId, 'tripId');
      const expense = await expenseService.getExpense(tripId, req.user.id, req.params.expenseId);
      res.status(200).json({ expense });
    } catch (error) {
      next(error);
    }
  },

  async updateExpense(req, res, next) {
    try {
      const tripId = parseId(req.params.tripId, 'tripId');
      const result = await expenseService.updateExpense(tripId, req.user.id, req.params.expenseId, req.body || {});
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  },

  async deleteExpense(req, res, next) {
    try {
      const tripId = parseId(req.params.tripId, 'tripId');
      await expenseService.deleteExpense(tripId, req.user.id, req.params.expenseId);
      res.status(200).json({ message: 'Expense deleted' });
    } catch (error) {
      next(error);
    }
  }
};

module.exports = expenseController;
