const express = require('express');
const router = express.Router({ mergeParams: true }); // mounted at /api/trips/:tripId/expenses
const expenseController = require('../controllers/expenseController');
const requireAuth = require('../middleware/authMiddleware');

router.use(requireAuth);

router.get('/', expenseController.getTripExpenses);
router.post('/', expenseController.createExpense);
router.get('/:expenseId', expenseController.getExpenseById);
router.patch('/:expenseId', expenseController.updateExpense);
router.put('/:expenseId', expenseController.updateExpense);
router.delete('/:expenseId', expenseController.deleteExpense);

module.exports = router;
