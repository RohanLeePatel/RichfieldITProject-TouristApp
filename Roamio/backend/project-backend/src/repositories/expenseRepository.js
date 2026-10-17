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

  sumByTrip: async (tripId) => {
    const result = await prisma.expense.aggregate({
      where: { tripId },
      _sum: { amount: true },
      _count: { id: true }
    });
    return { total: result._sum.amount, count: result._count.id };
  },

  sumByCategory: async (tripId, category) => {
    const result = await prisma.expense.aggregate({
      where: { tripId, category },
      _sum: { amount: true }
    });
    return result._sum.amount;
  },

  sumGroupedByCategory: async (tripId) => {
    return await prisma.expense.groupBy({
      by: ['category'],
      where: { tripId },
      _sum: { amount: true },
      _count: { id: true }
    });
  },

  sumPaidGroupedByMember: async (tripId) => {
    return await prisma.expense.groupBy({
      by: ['paidById'],
      where: { tripId },
      _sum: { amount: true }
    });
  },

  sumOwedGroupedByMember: async (tripId) => {
    return await prisma.expenseSplit.groupBy({
      by: ['userId'],
      where: { expense: { tripId } },
      _sum: { shareAmount: true }
    });
  }
};

module.exports = expenseRepository;
