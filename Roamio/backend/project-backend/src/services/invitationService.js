const crypto = require('crypto');
const invitationRepo = require('../repositories/invitationRepository');
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

const validTripId = (id) => Number.isInteger(id) && id > 0 && id <= 2147483647;

async function inviteDestination(groupId, tripId) {
  const id = typeof tripId === 'string' ? Number(tripId) : tripId;
  if (validTripId(id) && (await invitationRepo.findGroupTripIds(groupId, id)).length) return id;
  const tripIds = await invitationRepo.findGroupTripIds(groupId);
  return tripIds.length === 1 ? tripIds[0] : null;
}

class InvitationService {
  async createInvite(groupId, inviterId, { email, role = 'MEMBER', tripId }) {
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

    if (tripId !== undefined && (!validTripId(tripId) || !(await invitationRepo.findGroupTripIds(groupId, tripId)).length)) {
      throw httpError(400, 'Choose an active trip in this group.');
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
      link: `${clientUrl}/invite/${token}${tripId ? `?trip=${tripId}` : ''}`,
    });
    return { invitationToken: token, role: normalizedRole, expiresAt, emailed };
  }

  async alreadyAccepted(invitation, tripId) {
    return inviteError(409, 'ALREADY_ACCEPTED', "You've already accepted this invite.", {
      groupId: invitation.travelGroupId,
      tripId: await inviteDestination(invitation.travelGroupId, tripId),
    });
  }

  // A link that's no longer pending. If this account is in the group, it's
  // theirs (or they're in anyway); otherwise the link is spent. Who redeemed
  // it is never revealed.
  async notPending(invitation, userId, tripId) {
    if (userId && (await invitationRepo.checkGroupMembership(invitation.travelGroupId, userId))) {
      return this.alreadyAccepted(invitation, tripId);
    }
    if (invitation.status === 'EXPIRED') return expired();
    return inviteError(410, 'USED', 'This invite link has already been used. Ask the trip owner to send you a new invite.');
  }

  // Public, read-only: never consumes the token and never exposes the invitee's
  // email. userId is set when the visitor happens to be signed in, so a link
  // they already accepted can say so.
  async previewInvite(token, userId = null, tripId) {
    const invitation = await invitationRepo.findInvitationByToken(token);
    if (!invitation || invitation.travelGroup.deletedAt) throw invalid();

    if (invitation.status !== 'PENDING') throw await this.notPending(invitation, userId, tripId);
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
  async acceptInvite(userId, token, tripId) {
    if (typeof token !== 'string' || !token) throw httpError(400, 'Invitation token is required.');

    const invitation = await invitationRepo.findInvitationByToken(token);
    if (!invitation || invitation.travelGroup.deletedAt) throw invalid();

    // before the email check, so a spent link says so rather than "different email"
    if (invitation.status !== 'PENDING') throw await this.notPending(invitation, userId, tripId);

    const user = await invitationRepo.findUserById(userId);
    if (user.email.toLowerCase() !== invitation.email.toLowerCase()) {
      throw inviteError(403, 'WRONG_ACCOUNT', 'This invitation was sent to a different email address. Sign in with that address, or ask the trip owner to invite this account.');
    }

    if (new Date() > invitation.expiresAt) {
      await invitationRepo.updateInvitationStatus(invitation.id, 'EXPIRED');
      throw expired();
    }

    if (await invitationRepo.checkGroupMembership(invitation.travelGroupId, userId)) {
      throw await this.alreadyAccepted(invitation, tripId);
    }

    const membership = await invitationRepo.acceptInvitation(invitation, userId);
    // lost a race with another accept of the same link
    if (!membership) throw await this.notPending({ ...invitation, status: 'ACCEPTED' }, userId, tripId);

    return {
      groupName: invitation.travelGroup.name,
      groupId: invitation.travelGroupId,
      tripId: await inviteDestination(invitation.travelGroupId, tripId),
      role: membership.role,
    };
  }
}

module.exports = new InvitationService();
