const express = require('express');
const router = express.Router({ mergeParams: true }); // mounted at /api/trips/:tripId/budget
const budgetController = require('../controllers/budgetController');
const requireAuth = require('../middleware/authMiddleware');

router.use(requireAuth);

router.get('/', budgetController.getBudget);
router.put('/', budgetController.setBudget);
router.get('/summary', budgetController.getSummary);
router.put('/split', budgetController.setSplit);
router.get('/balances', budgetController.getBalances);
router.put('/categories/:category', budgetController.setCategoryLimit);
router.delete('/categories/:category', budgetController.removeCategoryLimit);

module.exports = router;
