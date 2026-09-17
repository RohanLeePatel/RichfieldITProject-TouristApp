const crypto = require('crypto');
const invitationRepo = require('../repositories/invitation.repository');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

exports.createInvite = async (req, res, next) => {
  try {
    const { groupId } = req.params;
    const inviterId = req.user.id;
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email is required to send an invitation.' });
    }

    // Verify the inviter has the rights to invite (must be in the group)
    const isMember = await invitationRepo.checkGroupMembership(groupId, inviterId);
    if (!isMember) {
      return res.status(403).json({ error: 'You are not authorized to invite members to this group.' });
    }

    // Generate secure token and expiry (7 days from now)
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    const invitation = await invitationRepo.createInvitation({
      travelGroupId: parseInt(groupId, 10),
      inviterId: parseInt(inviterId, 10),
      email: email.toLowerCase(),
      token,
      expiresAt,
    });

    // In a production environment, you would trigger a mailer service here:
    // e.g., emailService.sendGroupInvite(email, token, groupName);

    return res.status(201).json({
      message: 'Invitation generated successfully.',
      invitationToken: token, // Sent back for testing purposes
      expiresAt,
    });
  } catch (error) {
    next(error);
  }
};

exports.acceptInvite = async (req, res, next) => {
  try {
    const { token } = req.body;
    const userId = req.user.id;

    if (!token) {
      return res.status(400).json({ error: 'Invitation token is required.' });
    }

    // 1. Fetch the invitation
    const invitation = await invitationRepo.findInvitationByToken(token);
    if (!invitation) {
      return res.status(404).json({ error: 'Invalid invitation token.' });
    }

    // 2. Fetch the current user to verify their email matches the invite
    const currentUser = await prisma.user.findUnique({ where: { id: userId } });
    if (currentUser.email.toLowerCase() !== invitation.email.toLowerCase()) {
      return res.status(403).json({ error: 'This invitation was sent to a different email address.' });
    }

    // 3. Check token state
    if (invitation.status !== 'PENDING') {
      return res.status(400).json({ error: `This invitation is already ${invitation.status.toLowerCase()}.` });
    }

    if (new Date() > invitation.expiresAt) {
      await invitationRepo.updateInvitationStatus(invitation.id, 'EXPIRED');
      return res.status(400).json({ error: 'This invitation has expired.' });
    }

    // 4. Verify they aren't already in the group
    const existingMembership = await invitationRepo.checkGroupMembership(invitation.travelGroupId, userId);
    if (existingMembership) {
      return res.status(400).json({ error: 'You are already a member of this travel group.' });
    }

    // 5. Accept invite and add member (Transaction-like execution)
    await invitationRepo.updateInvitationStatus(invitation.id, 'ACCEPTED');
    await invitationRepo.addUserToGroup(invitation.travelGroupId, userId, 'MEMBER');

    return res.status(200).json({
      message: `Successfully joined ${invitation.travelGroup.name}.`,
      groupId: invitation.travelGroupId,
    });
  } catch (error) {
    next(error);
  }
};