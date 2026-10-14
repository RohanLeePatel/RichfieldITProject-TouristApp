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
      },
    });
  },

  updateInvitationStatus: async (id, status) => {
    return await prisma.invitation.update({
      where: { id },
      data: { status },
    });
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