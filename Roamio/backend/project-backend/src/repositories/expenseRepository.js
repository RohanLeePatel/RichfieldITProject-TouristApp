const prisma = require('../config/prisma');

const expenseInclude = {
  paidBy: { select: { id: true, fullName: true, email: true } },
  splits: {
    include: { user: { select: { id: true, fullName: true } } },
    orderBy: { userId: 'asc' }
  }
};

const expenseRepository = {
  // Expense and its splits are written in one nested (atomic) create
  createWithSplits: async (data, splits) => {
    return await prisma.expense.create({
      data: { ...data, splits: { createMany: { data: splits } } },
      include: expenseInclude
    });
  },

  findByTripId: async (tripId, { category } = {}) => {
    return await prisma.expense.findMany({
      where: { tripId, ...(category && { category }) },
      include: expenseInclude,
      orderBy: { date: 'desc' }
    });
  },

  findByIdInTrip: async (id, tripId) => {
    return await prisma.expense.findFirst({
      where: { id, tripId },
      include: expenseInclude
    });
  },

  // When splits are provided, existing splits are replaced atomically
  updateWithSplits: async (id, data, splits) => {
    return await prisma.expense.update({
      where: { id },
      data: {
        ...data,
        ...(splits && { splits: { deleteMany: {}, createMany: { data: splits } } })
      },
      include: expenseInclude
    });
  },

  delete: async (id) => {
    return await prisma.expense.delete({ where: { id } });
  },

  // --- Spend rollups ---

  // What utils/expenseTotals needs: amounts with their rates, in one query
  findForTotals: async (tripId) => {
    return await prisma.expense.findMany({
      where: { tripId },
      select: {
        amount: true, exchangeRate: true, category: true, paidById: true,
        splits: { select: { userId: true, shareAmount: true } }
      }
    });
  },

  sumByTrip: async (tripId) => {
    const result = await prisma.expense.aggregate({
      where: { tripId },
      _sum: { amount: true },
      _count: { id: true }
    });
    return { total: result._sum.amount, count: result._count.id };
  }
};

module.exports = expenseRepository;
