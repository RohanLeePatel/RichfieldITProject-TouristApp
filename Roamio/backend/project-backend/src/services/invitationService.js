const crypto = require('crypto');
const invitationRepo = require('../repositories/invitationRepository');
const { httpError } = require('./tripAccessService');

const INVITE_ROLES = ['ADMIN', 'MEMBER', 'VIEWER'];
const INVITE_VALID_DAYS = 7;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

class InvitationService {
  async createInvite(groupId, inviterId, { email, role = 'MEMBER' }) {
    if (typeof email !== 'string' || !email.trim()) {
      throw httpError(400, 'Email is required to send an invitation.');
    }
    const normalizedEmail = email.trim().toLowerCase();
    if (!EMAIL_PATTERN.test(normalizedEmail)) throw httpError(400, 'A valid email is required.');

    const normalizedRole = typeof role === 'string' ? role.toUpperCase() : role;
    if (!INVITE_ROLES.includes(normalizedRole)) {
      throw httpError(400, `Role must be one of ${INVITE_ROLES.join(', ')}.`);
    }

    const group = await invitationRepo.findActiveGroup(groupId);
    if (!group) throw httpError(404, 'Travel group not found.');

    const membership = await invitationRepo.checkGroupMembership(groupId, inviterId);
    if (!membership || !['OWNER', 'ADMIN'].includes(membership.role)) {
      throw httpError(403, 'Only group owners and admins can invite members.');
    }

    const inviter = await invitationRepo.findUserById(inviterId);
    if (inviter.email.toLowerCase() === normalizedEmail) {
      throw httpError(400, 'You cannot invite yourself.');
    }
    if (await invitationRepo.isEmailGroupMember(groupId, normalizedEmail)) {
      throw httpError(400, 'This person is already a member of the group.');
    }

    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + INVITE_VALID_DAYS * 24 * 60 * 60 * 1000);

    await invitationRepo.createInvitation({
      travelGroupId: groupId,
      inviterId: parseInt(inviterId, 10),
      email: normalizedEmail,
      role: normalizedRole,
      token,
      expiresAt,
    });

    // A mailer would send the token here; it is returned directly for now.
    return { invitationToken: token, role: normalizedRole, expiresAt };
  }

  // Public, read-only: never consumes the token and never exposes the invitee's email
  async previewInvite(token) {
    const invitation = await invitationRepo.findInvitationByToken(token);
    if (!invitation || invitation.travelGroup.deletedAt) throw httpError(404, 'Invalid invitation token.');

    if (invitation.status !== 'PENDING') {
      throw httpError(410, `This invitation is already ${invitation.status.toLowerCase()}.`);
    }
    if (new Date() > invitation.expiresAt) throw httpError(410, 'This invitation has expired.');

    return {
      groupName: invitation.travelGroup.name,
      inviterName: invitation.inviter.fullName,
      role: invitation.role,
      expiresAt: invitation.expiresAt,
    };
  }

  async acceptInvite(userId, token) {
    if (typeof token !== 'string' || !token) throw httpError(400, 'Invitation token is required.');

    const invitation = await invitationRepo.findInvitationByToken(token);
    if (!invitation) throw httpError(404, 'Invalid invitation token.');

    const user = await invitationRepo.findUserById(userId);
    if (user.email.toLowerCase() !== invitation.email.toLowerCase()) {
      throw httpError(403, 'This invitation was sent to a different email address.');
    }

    if (invitation.status !== 'PENDING') {
      throw httpError(400, `This invitation is already ${invitation.status.toLowerCase()}.`);
    }
    if (new Date() > invitation.expiresAt) {
      await invitationRepo.updateInvitationStatus(invitation.id, 'EXPIRED');
      throw httpError(400, 'This invitation has expired.');
    }
    if (invitation.travelGroup.deletedAt) throw httpError(404, 'Travel group not found.');

    if (await invitationRepo.checkGroupMembership(invitation.travelGroupId, userId)) {
      throw httpError(400, 'You are already a member of this travel group.');
    }

    const membership = await invitationRepo.acceptInvitation(invitation, userId);
    if (!membership) throw httpError(400, 'This invitation is no longer pending.');

    return { groupName: invitation.travelGroup.name, groupId: invitation.travelGroupId, role: membership.role };
  }
}

module.exports = new InvitationService();
