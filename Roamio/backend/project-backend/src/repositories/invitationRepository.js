const prisma = require('../config/prisma');

const invitationRepository = {
  createInvitation: async (data) => {
    return await prisma.invitation.create({
      data,
    });
  },

  findInvitationByToken: async (token) => {
    return await prisma.invitation.findUnique({
      where: { token },
      include: {
        travelGroup: true,
        inviter: { select: { fullName: true } },
      },
    });
  },

  // Active (not soft-deleted) group
  findActiveGroup: async (travelGroupId) => {
    return await prisma.travelGroup.findFirst({
      where: { id: travelGroupId, deletedAt: null },
    });
  },

  findUserById: async (id) => {
    return await prisma.user.findUnique({ where: { id: parseInt(id, 10) } });
  },

  // True if a user with this email (case-insensitive) already belongs to the group
  isEmailGroupMember: async (travelGroupId, email) => {
    const member = await prisma.travelGroupMember.findFirst({
      where: {
        travelGroupId,
        user: { email: { equals: email, mode: 'insensitive' } },
      },
      select: { id: true },
    });
    return Boolean(member);
  },

  // Marks the invite ACCEPTED and creates the membership atomically. The status guard in the
  // updateMany makes a concurrent double-accept fail instead of creating two memberships.
  acceptInvitation: async (invitation, userId) => {
    return await prisma.$transaction(async (tx) => {
      const claimed = await tx.invitation.updateMany({
        where: { id: invitation.id, status: 'PENDING' },
        data: { status: 'ACCEPTED' },
      });
      if (claimed.count === 0) return null;

      return await tx.travelGroupMember.create({
        data: {
          travelGroupId: invitation.travelGroupId,
          userId: parseInt(userId, 10),
          role: invitation.role,
        },
      });
    });
  },

  updateInvitationStatus: async (id, status) => {
    return await prisma.invitation.update({
      where: { id },
      data: { status },
    });
  },

  // Active trip ids in a group (so an invite can open "the trip" when there's one)
  findGroupTripIds: async (travelGroupId, tripId) => {
    const trips = await prisma.trip.findMany({
      where: { travelGroupId: parseInt(travelGroupId, 10), deletedAt: null, ...(tripId && { id: tripId }) },
      select: { id: true },
      take: 2,
    });
    return trips.map((trip) => trip.id);
  },

  checkGroupMembership: async (travelGroupId, userId) => {
    return await prisma.travelGroupMember.findUnique({
      where: {
        travelGroupId_userId: {
          travelGroupId: parseInt(travelGroupId, 10),
          userId: parseInt(userId, 10),
        },
      },
    });
  },

  addUserToGroup: async (travelGroupId, userId, role = 'MEMBER') => {
    return await prisma.travelGroupMember.create({
      data: {
        travelGroupId: parseInt(travelGroupId, 10),
        userId: parseInt(userId, 10),
        role,
      },
    });
  },

  getPendingInvitationsByGroup: async (travelGroupId) => {
    return await prisma.invitation.findMany({
      where: {
        travelGroupId: parseInt(travelGroupId, 10),
        status: 'PENDING',
      },
    });
  }
};

module.exports = invitationRepository;
