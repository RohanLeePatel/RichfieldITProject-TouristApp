const express = require('express');
const router = express.Router();
const expenseController = require('../controllers/expenseController');
const requireAuth = require('../middleware/authMiddleware');

// Protect all expense routes
router.use(requireAuth);

// Trip expense management
router.post('/trips/:tripId/expenses', expenseController.createExpense || expenseController.addExpense);
router.get('/trips/:tripId/expenses', expenseController.getTripExpenses || expenseController.getExpenses);

// Single expense actions
router.get('/expenses/:id', expenseController.getExpenseById || ((req, res) => res.status(501).json({ error: 'Not implemented' })));
router.put('/expenses/:id', expenseController.updateExpense || ((req, res) => res.status(501).json({ error: 'Not implemented' })));
router.delete('/expenses/:id', expenseController.deleteExpense || ((req, res) => res.status(501).json({ error: 'Not implemented' })));

module.exports = router;