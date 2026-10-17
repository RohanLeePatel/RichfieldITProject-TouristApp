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