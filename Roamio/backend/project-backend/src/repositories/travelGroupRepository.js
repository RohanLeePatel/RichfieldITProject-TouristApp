const prisma = require('../config/prisma');
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

  // A group by its join code, with who's in it (for the /join link's preview)
  findByInviteCode: async (inviteCode) => {
    return await prisma.travelGroup.findFirst({
      where: { inviteCode: String(inviteCode).trim().toUpperCase(), deletedAt: null },
      include: { members: { select: { userId: true } } },
    });
  },

  updateDescription: async (groupId, description) => {
    return await prisma.travelGroup.update({ where: { id: groupId }, data: { description } });
  },

  // Join a group via invite code
  joinGroupByCode: async (userId, inviteCode) => {
    const group = await prisma.travelGroup.findFirst({
      where: { inviteCode: inviteCode.trim().toUpperCase(), deletedAt: null },
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

  // Group with its member list (membership id, role, user info); null if missing or soft-deleted
  findActiveGroupDetails: async (groupId) => {
    return await prisma.travelGroup.findFirst({
      where: { id: groupId, deletedAt: null },
      include: {
        members: {
          orderBy: { joinedAt: 'asc' },
          select: {
            id: true,
            userId: true,
            role: true,
            joinedAt: true,
            user: { select: { id: true, fullName: true, email: true, avatarUrl: true } },
          },
        },
      },
    });
  },

  findMembership: async (groupId, userId) => {
    return await prisma.travelGroupMember.findUnique({
      where: { travelGroupId_userId: { travelGroupId: groupId, userId } },
    });
  },

  // Caller's membership, only if the group still exists (not soft-deleted)
  findActiveMembership: async (groupId, userId) => {
    return await prisma.travelGroupMember.findFirst({
      where: { travelGroupId: groupId, userId, travelGroup: { deletedAt: null } },
    });
  },

  // Membership by its own id, scoped to the group so ids from other groups can't be targeted
  findMembershipById: async (groupId, memberId) => {
    return await prisma.travelGroupMember.findFirst({
      where: { id: memberId, travelGroupId: groupId },
    });
  },

  updateMemberRole: async (memberId, role) => {
    return await prisma.travelGroupMember.update({
      where: { id: memberId },
      data: { role },
      select: {
        id: true,
        userId: true,
        role: true,
        joinedAt: true,
        user: { select: { id: true, fullName: true, email: true, avatarUrl: true } },
      },
    });
  },

  countOwners: async (groupId) => {
    return await prisma.travelGroupMember.count({
      where: { travelGroupId: groupId, role: 'OWNER' },
    });
  },

  // Removes the membership and the user's access to the group's trips in one transaction
  removeMember: async (membership) => {
    return await prisma.$transaction([
      prisma.tripMember.deleteMany({
        where: { userId: membership.userId, trip: { travelGroupId: membership.travelGroupId } },
      }),
      prisma.travelGroupMember.delete({ where: { id: membership.id } }),
    ]);
  },
};

module.exports = travelGroupRepository;