const expenseRepo = require('../repositories/expense.repository');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const verifyTripAccess = async (tripId, userId) => {
  return await prisma.trip.findFirst({
    where: {
      id: parseInt(tripId, 10),
      members: {
        some: { userId: userId }
      }
    }
  });
};

const addExpense = async (req, res) => {
  try {
    const { tripId } = req.params;
    const userId = req.user.id;

    const trip = await verifyTripAccess(tripId, userId);
    if (!trip) return res.status(403).json({ error: 'Access denied.' });

    const newExpense = await expenseRepo.createExpense({
      ...req.body,
      tripId: parseInt(tripId, 10),
      amount: parseFloat(req.body.amount),
      date: req.body.date ? new Date(req.body.date) : new Date()
    });

    return res.status(201).json({ expense: newExpense });
  } catch (error) {
    return res.status(500).json({ error: 'Server error' });
  }
};

const getTripExpenses = async (req, res) => {
  try {
    const { tripId } = req.params;
    const userId = req.user.id;

    const trip = await verifyTripAccess(tripId, userId);
    if (!trip) return res.status(403).json({ error: 'Access denied.' });

    const expenses = await expenseRepo.findExpensesByTripId(tripId);
    return res.status(200).json({ expenses });
  } catch (error) {
    return res.status(500).json({ error: 'Server error' });
  }
};

const getTripBudgetSummary = async (req, res) => {
  try {
    const { tripId } = req.params;
    const userId = req.user.id;

    const trip = await verifyTripAccess(tripId, userId);
    if (!trip) return res.status(403).json({ error: 'Access denied.' });

    const summary = await expenseRepo.getExpenseSummaryByTripId(tripId);
    const totalBudget = trip.totalBudget || 0;

    return res.status(200).json({
      totalBudget,
      totalSpent: summary.totalSpent,
      remainingBudget: totalBudget - summary.totalSpent,
      categoryBreakdown: summary.byCategory
    });
  } catch (error) {
    return res.status(500).json({ error: 'Server error' });
  }
};

const updateExpense = async (req, res) => {
  try {
    const { expenseId } = req.params;
    const userId = req.user.id;

    const existingExpense = await expenseRepo.findExpenseById(expenseId);
    if (!existingExpense) return res.status(404).json({ error: 'Not found.' });

    const isMember = existingExpense.trip.members.some(member => member.userId === userId);
    if (!isMember) return res.status(403).json({ error: 'Access denied.' });

    const updateData = { ...req.body };
    if (updateData.amount) updateData.amount = parseFloat(updateData.amount);
    if (updateData.date) updateData.date = new Date(updateData.date);

    const updated = await expenseRepo.updateExpense(expenseId, updateData);
    return res.status(200).json({ expense: updated });
  } catch (error) {
    return res.status(500).json({ error: 'Server error' });
  }
};

const deleteExpense = async (req, res) => {
  try {
    const { expenseId } = req.params;
    const userId = req.user.id;

    const existingExpense = await expenseRepo.findExpenseById(expenseId);
    if (!existingExpense) return res.status(404).json({ error: 'Not found.' });

    const isMember = existingExpense.trip.members.some(member => member.userId === userId);
    if (!isMember) return res.status(403).json({ error: 'Access denied.' });

    await expenseRepo.deleteExpense(expenseId);
    return res.status(200).json({ message: 'Expense deleted.' });
  } catch (error) {
    return res.status(500).json({ error: 'Server error' });
  }
};

module.exports = { addExpense, getTripExpenses, getTripBudgetSummary, updateExpense, deleteExpense };