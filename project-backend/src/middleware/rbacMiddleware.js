const groupRepository = require('../repositories/groupRepository');

const ROLE_HIERARCHY = {
  OWNER: 4,
  ADMIN: 3,
  MEMBER: 2,
  VIEWER: 1,
};

const requireGroupRole = (minimumRole = 'MEMBER') => {
  return async (req, res, next) => {
    try {
      const groupId = req.params.groupId || req.body.groupId || req.params.id;
      if (!groupId) {
        return res.status(400).json({ message: 'Group ID is required for access verification.' });
      }

      const membership = await groupRepository.getMembership(req.user.userId, groupId);
      if (!membership) {
        return res.status(403).json({ message: 'Access denied: You are not a member of this travel group.' });
      }

      const userLevel = ROLE_HIERARCHY[membership.role] || 0;
      const requiredLevel = ROLE_HIERARCHY[minimumRole] || 0;

      if (userLevel < requiredLevel) {
        return res.status(403).json({
          message: `Access denied: Requires ${minimumRole} permissions (Current: ${membership.role}).`,
        });
      }

      req.membership = membership;
      next();
    } catch (err) {
      next(err);
    }
  };
};

module.exports = { requireGroupRole };