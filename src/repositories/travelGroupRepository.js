const prisma = require('../prismaClient');
const crypto = require('crypto');

const travelGroupRepository = {
  // Create a group and automatically assign the creator as "OWNER"
  createGroup: async (userId, data) => {
    const inviteCode = crypto.randomBytes(4).toString('hex').toUpperCase(); // e.g. "9F2A1B8C"

    return await prisma.travelGroup.create({
      data: {
        name: data.name,
        description: data.description,
        inviteCode,
        members: {
          create: {
            userId: parseInt(userId, 10),
            role: 'OWNER',
          },
        },
      },
      include: {
        members: {
          include: {
            user: {
              select: { id: true, fullName: true, email: true, avatarUrl: true },
            },
          },
        },
      },
    });
  },

  // Fetch all groups where the user is an active member
  getUserGroups: async (userId) => {
    return await prisma.travelGroup.findMany({
      where: {
        deletedAt: null,
        members: {
          some: { userId: parseInt(userId, 10) },
        },
      },
      include: {
        members: {
          include: {
            user: { select: { id: true, fullName: true, email: true } },
          },
        },
        trips: {
          where: { deletedAt: null },
          select: { id: true, title: true, status: true, startDate: true, endDate: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  },

  // Join a group via invite code
  joinGroupByCode: async (userId, inviteCode) => {
    const group = await prisma.travelGroup.findUnique({
      where: { inviteCode: inviteCode.trim().toUpperCase() },
    });

    if (!group) {
      const error = new Error('Invalid invite code');
      error.statusCode = 404;
      throw error;
    }

    // Add membership using upsert or create
    return await prisma.travelGroupMember.create({
      data: {
        travelGroupId: group.id,
        userId: parseInt(userId, 10),
        role: 'MEMBER',
      },
      include: {
        travelGroup: true,
      },
    });
  },
};

module.exports = travelGroupRepository;