const groupService = require('../services/groupService');

class GroupController {
  async createGroup(req, res, next) {
    try {
      const group = await groupService.createGroup(req.user.userId, req.body);
      res.status(201).json(group);
    } catch (err) {
      next(err);
    }
  }

  async getMyGroups(req, res, next) {
    try {
      const groups = await groupService.getUserGroups(req.user.userId);
      res.json(groups);
    } catch (err) {
      next(err);
    }
  }

  async getGroupById(req, res, next) {
    try {
      const group = await groupService.getGroupDetails(req.params.groupId);
      res.json(group);
    } catch (err) {
      next(err);
    }
  }

  async joinByCode(req, res, next) {
    try {
      const { inviteCode } = req.body;
      if (!inviteCode) return res.status(400).json({ message: 'inviteCode is required' });

      const member = await groupService.joinGroupByCode(req.user.userId, inviteCode);
      res.status(201).json({ message: 'Successfully joined group', member });
    } catch (err) {
      next(err);
    }
  }

  async createInvite(req, res, next) {
    try {
      const invite = await groupService.generateInviteToken(
        req.user.userId,
        req.params.groupId,
        req.body
      );
      res.status(201).json(invite);
    } catch (err) {
      next(err);
    }
  }

  async acceptInvite(req, res, next) {
    try {
      const result = await groupService.acceptInviteToken(req.user.userId, req.params.token);
      res.json(result);
    } catch (err) {
      next(err);
    }
  }

  async updateRole(req, res, next) {
    try {
      const { role } = req.body;
      const updated = await groupService.updateMemberRole(req.params.groupId, req.params.userId, role);
      res.json({ message: 'Role updated successfully', updated });
    } catch (err) {
      next(err);
    }
  }

  async removeMember(req, res, next) {
    try {
      await groupService.removeMember(req.params.groupId, req.params.userId);
      res.json({ message: 'Member removed from group' });
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new GroupController();