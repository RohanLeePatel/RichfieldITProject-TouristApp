const prisma = require('../config/prisma');

const budgetRepository = {
  findByTripId: async (tripId) => {
    return await prisma.budget.findUnique({
      where: { tripId },
      include: { categoryLimits: { orderBy: { category: 'asc' } } }
    });
  },

  upsert: async (tripId, { totalAmount, currency }) => {
    return await prisma.budget.upsert({
      where: { tripId },
      create: { tripId, totalAmount, ...(currency && { currency }) },
      update: { totalAmount, ...(currency && { currency }) },
      include: { categoryLimits: { orderBy: { category: 'asc' } } }
    });
  },

  upsertCategoryLimit: async (budgetId, category, limitAmount) => {
    return await prisma.budgetCategoryLimit.upsert({
      where: { budgetId_category: { budgetId, category } },
      create: { budgetId, category, limitAmount },
      update: { limitAmount }
    });
  },

  deleteCategoryLimit: async (budgetId, category) => {
    const result = await prisma.budgetCategoryLimit.deleteMany({
      where: { budgetId, category }
    });
    return result.count;
  }
};

module.exports = budgetRepository;
