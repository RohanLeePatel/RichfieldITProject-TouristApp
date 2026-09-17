const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const createExpense = async (data) => {
  return await prisma.expense.create({ data });
};

const findExpensesByTripId = async (tripId) => {
  return await prisma.expense.findMany({
    where: { tripId: parseInt(tripId, 10) },
    orderBy: { date: 'desc' }
  });
};

const findExpenseById = async (id) => {
  return await prisma.expense.findUnique({
    where: { id },
    include: {
      trip: {
        include: {
          members: true // Fetches members to verify access
        }
      }
    }
  });
};

const updateExpense = async (id, data) => {
  return await prisma.expense.update({
    where: { id },
    data
  });
};

const deleteExpense = async (id) => {
  return await prisma.expense.delete({
    where: { id }
  });
};

const getExpenseSummaryByTripId = async (tripId) => {
  const numericTripId = parseInt(tripId, 10);
  const total = await prisma.expense.aggregate({
    where: { tripId: numericTripId },
    _sum: { amount: true },
    _count: { id: true }
  });
  const categoryBreakdown = await prisma.expense.groupBy({
    by: ['category'],
    where: { tripId: numericTripId },
    _sum: { amount: true },
    _count: { id: true }
  });
  return {
    totalSpent: total._sum.amount || 0,
    transactionCount: total._count.id || 0,
    byCategory: categoryBreakdown.map((item) => ({
      category: item.category,
      amount: item._sum.amount || 0,
      count: item._count.id
    }))
  };
};

module.exports = {
  createExpense, findExpensesByTripId, findExpenseById, updateExpense, deleteExpense, getExpenseSummaryByTripId
};