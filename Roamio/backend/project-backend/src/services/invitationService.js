const crypto = require('crypto');
const invitationRepo = require('../repositories/invitationRepository');
const userRepo = require('../repositories/userRepository');
const { httpError } = require('./tripAccessService');
const groupActivity = require('./groupActivityService');
const { sendGroupInvite } = require('./emailService');

const INVITE_ROLES = ['ADMIN', 'MEMBER', 'VIEWER'];
const INVITE_VALID_DAYS = 7;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Invite errors carry a machine-readable code (and, for ALREADY_ACCEPTED, where
// to go) so the page can say exactly what happened. They never say who used a link.
const inviteError = (statusCode, code, message, extra) => Object.assign(httpError(statusCode, message), { code, extra });
const invalid = () => inviteError(404, 'INVALID', "This invite link isn't valid. Check you copied the whole link, or ask the trip owner for a new one.");
const expired = () => inviteError(410, 'EXPIRED', 'This invite link has expired. Ask the trip owner to send you a new one.');

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

    if (normalizedRole === 'ADMIN' && membership.role !== 'OWNER') {
      throw httpError(403, 'Only the group owner can invite admins.');
    }

    const inviter = await invitationRepo.findUserById(inviterId);
    if (inviter.email.toLowerCase() === normalizedEmail) {
      throw httpError(400, 'You cannot invite yourself.');
    }
    if (await invitationRepo.isEmailGroupMember(groupId, normalizedEmail)) {
      throw httpError(400, 'This person is already a member of the group.');
    }

    const invitee = await userRepo.findByEmail(normalizedEmail);
    if (!invitee?.isVerified || !invitee.isActive) {
      throw httpError(400, 'Enter the email address of an active, verified Roamio account.');
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

    await groupActivity.notifyInvite({
      groupId: group.id,
      groupName: group.name,
      inviterName: inviter.fullName,
      email: normalizedEmail,
      token,
    });

    // The token is still returned so the inviter can share the link when email
    // isn't delivered. Accepting requires signing in with the invited address
    // (see acceptInvite), so a leaked link alone is not enough.
    const clientUrl = (process.env.CLIENT_URL || 'http://localhost:5173').split(',')[0].trim().replace(/\/$/, '');
    const emailed = await sendGroupInvite(normalizedEmail, {
      inviterName: inviter.fullName,
      groupName: group.name,
      link: `${clientUrl}/invite/${token}`,
    });
    return { invitationToken: token, role: normalizedRole, expiresAt, emailed };
  }

  // Where an account that's already in the invite's group should go: the trip
  // itself when the group has exactly one, else the group.
  async alreadyAccepted(invitation) {
    const tripIds = await invitationRepo.findGroupTripIds(invitation.travelGroupId);
    return inviteError(409, 'ALREADY_ACCEPTED', "You've already accepted this invite.", {
      groupId: invitation.travelGroupId,
      tripId: tripIds.length === 1 ? tripIds[0] : null,
    });
  }

  // A link that's no longer pending. If this account is in the group, it's
  // theirs (or they're in anyway); otherwise the link is spent. Who redeemed
  // it is never revealed.
  async notPending(invitation, userId) {
    if (userId && (await invitationRepo.checkGroupMembership(invitation.travelGroupId, userId))) {
      return this.alreadyAccepted(invitation);
    }
    if (invitation.status === 'EXPIRED') return expired();
    return inviteError(410, 'USED', 'This invite link has already been used. Ask the trip owner to send you a new invite.');
  }

  // Public, read-only: never consumes the token and never exposes the invitee's
  // email. userId is set when the visitor happens to be signed in, so a link
  // they already accepted can say so.
  async previewInvite(token, userId = null) {
    const invitation = await invitationRepo.findInvitationByToken(token);
    if (!invitation || invitation.travelGroup.deletedAt) throw invalid();

    if (invitation.status !== 'PENDING') throw await this.notPending(invitation, userId);
    if (new Date() > invitation.expiresAt) throw expired();

    return {
      groupName: invitation.travelGroup.name,
      inviterName: invitation.inviter.fullName,
      role: invitation.role,
      expiresAt: invitation.expiresAt,
    };
  }

  // The token alone doesn't grant membership: the signed-in account's email must
  // match the address the invitation was sent to. Expired invitations are marked
  // EXPIRED here, the first time someone tries to use them.
  async acceptInvite(userId, token) {
    if (typeof token !== 'string' || !token) throw httpError(400, 'Invitation token is required.');

    const invitation = await invitationRepo.findInvitationByToken(token);
    if (!invitation || invitation.travelGroup.deletedAt) throw invalid();

    // before the email check, so a spent link says so rather than "different email"
    if (invitation.status !== 'PENDING') throw await this.notPending(invitation, userId);

    const user = await invitationRepo.findUserById(userId);
    if (user.email.toLowerCase() !== invitation.email.toLowerCase()) {
      throw inviteError(403, 'WRONG_ACCOUNT', 'This invitation was sent to a different email address. Sign in with that address, or ask the trip owner to invite this account.');
    }

    if (new Date() > invitation.expiresAt) {
      await invitationRepo.updateInvitationStatus(invitation.id, 'EXPIRED');
      throw expired();
    }

    if (await invitationRepo.checkGroupMembership(invitation.travelGroupId, userId)) {
      throw await this.alreadyAccepted(invitation);
    }

    const membership = await invitationRepo.acceptInvitation(invitation, userId);
    // lost a race with another accept of the same link
    if (!membership) throw await this.notPending({ ...invitation, status: 'ACCEPTED' }, userId);

    const tripIds = await invitationRepo.findGroupTripIds(invitation.travelGroupId);
    return {
      groupName: invitation.travelGroup.name,
      groupId: invitation.travelGroupId,
      tripId: tripIds.length === 1 ? tripIds[0] : null,
      role: membership.role,
    };
  }
}

module.exports = new InvitationService();
