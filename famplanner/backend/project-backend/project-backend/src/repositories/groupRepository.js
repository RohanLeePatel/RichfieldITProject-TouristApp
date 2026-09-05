const prisma = require('../../db'); 

class GroupRepository {
  async createGroupWithAdmin(userId, groupData) {
    return await prisma.$transaction(async (tx) => {
      // 1. Create the TravelGroup
      const group = await tx.travelGroup.create({
        data: {
          name: groupData.name,
          description: groupData.description || null,
          inviteCode: groupData.inviteCode,
        },
      });

      // 2. Add creator as OWNER
      await tx.travelGroupMember.create({
        data: {
          userId,
          travelGroupId: group.id,
          role: 'OWNER',
        },
      });

      return group;
    });
  }

  async findById(groupId) {
    return await prisma.travelGroup.findFirst({
      where: { id: parseInt(groupId, 10), deletedAt: null },
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
  }

  async findByInviteCode(inviteCode) {
    return await prisma.travelGroup.findFirst({
      where: { inviteCode, deletedAt: null },
    });
  }

  async findUserGroups(userId) {
    return await prisma.travelGroup.findMany({
      where: {
        deletedAt: null,
        members: {
          some: { userId: parseInt(userId, 10) },
        },
      },
      include: {
        members: {
          select: {
            role: true,
            user: { select: { id: true, fullName: true, email: true } },
          },
        },
      },
    });
  }

  async getMembership(userId, groupId) {
    return await prisma.travelGroupMember.findFirst({
      where: {
        userId: parseInt(userId, 10),
        travelGroupId: parseInt(groupId, 10),
      },
    });
  }

  async addMember(userId, groupId, role = 'MEMBER') {
    return await prisma.travelGroupMember.create({
      data: {
        userId: parseInt(userId, 10),
        travelGroupId: parseInt(groupId, 10),
        role,
      },
    });
  }

  async updateMemberRole(userId, groupId, role) {
    return await prisma.travelGroupMember.update({
      where: {
        userId_travelGroupId: {
          userId: parseInt(userId, 10),
          travelGroupId: parseInt(groupId, 10),
        },
      },
      data: { role },
    });
  }

  async removeMember(userId, groupId) {
    return await prisma.travelGroupMember.delete({
      where: {
        userId_travelGroupId: {
          userId: parseInt(userId, 10),
          travelGroupId: parseInt(groupId, 10),
        },
      },
    });
  }
}

module.exports = new GroupRepository();