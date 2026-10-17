const travelGroupRepository = require('../repositories/travelGroupRepository');

exports.createGroup = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { name, description } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Group name is required.' });
    }

    const group = await travelGroupRepository.createGroup(userId, { name, description });
    return res.status(201).json({ message: 'Travel group created successfully.', group });
  } catch (error) {
    next(error);
  }
};

exports.getMyGroups = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const groups = await travelGroupRepository.getUserGroups(userId);
    return res.status(200).json({ groups });
  } catch (error) {
    next(error);
  }
};

exports.joinGroup = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { inviteCode } = req.body;

    if (!inviteCode || typeof inviteCode !== 'string') {
      return res.status(400).json({ error: 'Invite code is required.' });
    }

    const membership = await travelGroupRepository.joinGroupByCode(userId, inviteCode);
    return res.status(200).json({ message: 'Successfully joined group.', membership });
  } catch (error) {
    if (error.code === 'P2002') {
      return res.status(400).json({ error: 'You are already a member of this group.' });
    }
    if (error.statusCode) return res.status(error.statusCode).json({ error: error.message });
    next(error);
  }
};

// --- Group details & member management (errors use the { error } shape) ---
const travelGroupService = require('../services/travelGroupService');
const { parseId } = require('../services/tripAccessService');

const sendError = (res, next, error) => {
  if (error.statusCode) return res.status(error.statusCode).json({ error: error.message });
  return next(error);
};

exports.getGroupDetails = async (req, res, next) => {
  try {
    const groupId = parseId(req.params.groupId, 'groupId');
    const group = await travelGroupService.getGroupDetails(groupId, req.user.id);
    return res.status(200).json({ group });
  } catch (error) {
    return sendError(res, next, error);
  }
};

exports.updateMemberRole = async (req, res, next) => {
  try {
    const groupId = parseId(req.params.groupId, 'groupId');
    const memberId = parseId(req.params.memberId, 'memberId');
    const member = await travelGroupService.updateMemberRole(groupId, req.user.id, memberId, (req.body || {}).role);
    return res.status(200).json({ message: 'Member role updated.', member });
  } catch (error) {
    return sendError(res, next, error);
  }
};

exports.removeMember = async (req, res, next) => {
  try {
    const groupId = parseId(req.params.groupId, 'groupId');
    const memberId = parseId(req.params.memberId, 'memberId');
    const { left } = await travelGroupService.removeMember(groupId, req.user.id, memberId);
    return res.status(200).json({ message: left ? 'You have left the group.' : 'Member removed from the group.' });
  } catch (error) {
    return sendError(res, next, error);
  }
};
