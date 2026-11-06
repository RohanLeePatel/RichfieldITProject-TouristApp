const travelGroupRepository = require('../repositories/travelGroupRepository');
const { formatGroup } = require('../utils/groupMeta');

exports.createGroup = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { name, description } = req.body;

    const groupName = typeof name === 'string' ? name.trim() : '';
    if (!groupName) {
      return res.status(400).json({ error: 'Group name is required.' });
    }
    if (groupName.length < 2 || groupName.length > 60 || /[<>\u0000-\u001f]/.test(groupName)) {
      return res.status(400).json({ error: 'Group name must be 2-60 characters, without < or >.' });
    }

    const group = await travelGroupRepository.createGroup(userId, { name: groupName, description });
    return res.status(201).json({ message: 'Travel group created successfully.', group });
  } catch (error) {
    next(error);
  }
};

exports.getMyGroups = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const groups = await travelGroupRepository.getUserGroups(userId);
    return res.status(200).json({ groups: groups.map(formatGroup) });
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
    if (!/^[A-Za-z0-9]{4,16}$/.test(inviteCode.trim())) {
      return res.status(400).json({ error: 'Invite codes are 4-16 letters and numbers.' });
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

// Group details and member management. These handlers are delegated to the
// service layer, which owns the role rules. Errors use the { error } shape.
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

exports.saveCompanions = async (req, res, next) => {
  try {
    const groupId = parseId(req.params.groupId, 'groupId');
    const companions = await travelGroupService.saveCompanions(groupId, req.user.id, req.body || {});
    return res.status(200).json({ companions });
  } catch (error) {
    return sendError(res, next, error);
  }
};

exports.previewByCode = async (req, res, next) => {
  try {
    const group = await travelGroupService.previewByCode(req.params.code, req.user.id);
    return res.status(200).json({ group });
  } catch (error) {
    return sendError(res, next, error);
  }
};
