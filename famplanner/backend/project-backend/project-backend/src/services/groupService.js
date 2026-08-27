const crypto = require('crypto');
const groupRepository = require('../repositories/groupRepository');

class GroupService {
  generateInviteCode() {
    return crypto.randomBytes(4).toString('hex').toUpperCase(); 
  }

  async createGroup(userId, { name, description }) {
    if (!name || name.trim().length === 0) {
      const error = new Error('Group name is required');
      error.statusCode = 400;
      throw error;
    }

    const inviteCode = this.generateInviteCode();
    return await groupRepository.createGroupWithAdmin(userId, {
      name: name.trim(),
      description: description?.trim(),
      inviteCode,
    });
  }

  async getUserGroups(userId) {
    return await groupRepository.findUserGroups(userId);
  }

  async getGroupDetails(groupId) {
    const group = await groupRepository.findById(groupId);
    if (!group) {
      const error = new Error('Travel group not found');
      error.statusCode = 404;
      throw error;
    }
    return group;
  }

  async joinGroupByCode(userId, inviteCode) {
    const group = await groupRepository.findByInviteCode(inviteCode.trim().toUpperCase());
    if (!group) {
      const error = new Error('Invalid invite code');
      error.statusCode = 404;
      throw error;
    }

    const existingMembership = await groupRepository.getMembership(userId, group.id);
    if (existingMembership) {
      const error = new Error('You are already a member of this group');
      error.statusCode = 409;
      throw error;
    }

    return await groupRepository.addMember(userId, group.id, 'MEMBER');
  }

  async generateInviteToken(inviterId, groupId, { email, role = 'MEMBER', hoursValid = 48 }) {
    const token = crypto.randomBytes(24).toString('hex');
    const expiresAt = new Date(Date.now() + hoursValid * 60 * 60 * 1000);

    const invitation = await groupRepository.createInvitation({
      travelGroupId: groupId,
      inviterId,
      email,
      role,
      token,
      expiresAt,
    });

    return {
      token: invitation.token,
      expiresAt: invitation.expiresAt,
      inviteUrl: `/api/groups/invites/accept/${token}`,
    };
  }

  async acceptInviteToken(userId, token) {
    const invitation = await groupRepository.findInvitationByToken(token);
    if (!invitation) {
      const error = new Error('Invitation is invalid or has already been used');
      error.statusCode = 404;
      throw error;
    }

    if (new Date() > new Date(invitation.expiresAt)) {
      const error = new Error('Invitation token has expired');
      error.statusCode = 410;
      throw error;
    }

    const existingMembership = await groupRepository.getMembership(userId, invitation.travelGroupId);
    if (existingMembership) {
      await groupRepository.markInvitationAccepted(invitation.id);
      const error = new Error('You are already a member of this group');
      error.statusCode = 409;
      throw error;
    }

    const membership = await groupRepository.addMember(userId, invitation.travelGroupId, invitation.role);
    await groupRepository.markInvitationAccepted(invitation.id);

    return { message: 'Successfully joined group', membership };
  }

  async updateMemberRole(groupId, targetUserId, newRole) {
    const validRoles = ['ADMIN', 'MEMBER', 'VIEWER'];
    if (!validRoles.includes(newRole)) {
      const error = new Error('Invalid role specified');
      error.statusCode = 400;
      throw error;
    }

    return await groupRepository.updateMemberRole(targetUserId, groupId, newRole);
  }

  async removeMember(groupId, targetUserId) {
    return await groupRepository.removeMember(targetUserId, groupId);
  }
}

module.exports = new GroupService();