const prisma = require('../prismaClient');

class UserRepository {
  async findByEmail(email) {
    return await prisma.user.findFirst({
      where: { email, deletedAt: null },
      include: { preferences: true },
    });
  }

  async findById(id) {
    return await prisma.user.findFirst({
      where: { id, deletedAt: null },
      select: {
        id: true,
        email: true,
        fullName: true,
        avatarUrl: true,
        isActive: true,
        preferences: true,
        createdAt: true,
      },
    });
  }

  async create(data) {
    return await prisma.user.create({
      data: {
        email: data.email,
        passwordHash: data.passwordHash,
        fullName: data.fullName,
        preferences: {
          create: {}, // Auto-generates default ZAR currency / english / push alerts
        },
      },
      select: {
        id: true,
        email: true,
        fullName: true,
        createdAt: true,
      },
    });
  }

  async update(id, updateData) {
    return await prisma.user.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        email: true,
        fullName: true,
        avatarUrl: true,
        preferences: true,
      },
    });
  }
}

module.exports = new UserRepository();