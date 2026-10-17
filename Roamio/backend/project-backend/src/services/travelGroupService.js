const travelGroupRepository = require('../repositories/travelGroupRepository');
const { httpError } = require('./tripAccessService');

const ASSIGNABLE_ROLES = ['ADMIN', 'MEMBER', 'VIEWER'];
const MANAGER_ROLES = ['OWNER', 'ADMIN'];

// Non-members (and soft-deleted groups) get 404 so group existence isn't leaked
const requireMembership = async (groupId, userId) => {
  const membership = await travelGroupRepository.findMembership(groupId, userId);
  const group = membership && await travelGroupRepository.findActiveGroupDetails(groupId);
  if (!group) throw httpError(404, 'Travel group not found.');
  return { membership, group };
};

const findTarget = async (groupId, memberId) => {
  const target = await travelGroupRepository.findMembershipById(groupId, memberId);
  if (!target) throw httpError(404, 'Member not found in this group.');
  return target;
};

class TravelGroupService {
  async getGroupDetails(groupId, userId) {
    const { membership, group } = await requireMembership(groupId, userId);

    return {
      id: group.id,
      name: group.name,
      description: group.description,
      createdAt: group.createdAt,
      yourRole: membership.role,
      // The join code is a credential, so only managers see it
      ...(MANAGER_ROLES.includes(membership.role) && { inviteCode: group.inviteCode }),
      memberCount: group.members.length,
      members: group.members,
    };
  }

  async updateMemberRole(groupId, userId, memberId, rawRole) {
    const { membership: actor } = await requireMembership(groupId, userId);
    if (!MANAGER_ROLES.includes(actor.role)) {
      throw httpError(403, 'Only group owners and admins can change member roles.');
    }

    const role = typeof rawRole === 'string' ? rawRole.toUpperCase() : rawRole;
    if (role === 'OWNER') throw httpError(400, 'The OWNER role cannot be assigned.');
    if (!ASSIGNABLE_ROLES.includes(role)) {
      throw httpError(400, `Role must be one of ${ASSIGNABLE_ROLES.join(', ')}.`);
    }

    const target = await findTarget(groupId, memberId);
    if (target.role === 'OWNER') throw httpError(400, "The group owner's role cannot be changed.");

    // Admins manage regular members only; granting or altering ADMIN is reserved for the owner
    if (actor.role === 'ADMIN' && (target.role === 'ADMIN' || role === 'ADMIN')) {
      throw httpError(403, 'Only the group owner can grant or change the admin role.');
    }

    return await travelGroupRepository.updateMemberRole(target.id, role);
  }

  async removeMember(groupId, userId, memberId) {
    const { membership: actor } = await requireMembership(groupId, userId);
    const target = await findTarget(groupId, memberId);
    const isSelf = target.userId === userId;

    if (target.role === 'OWNER') {
      // An owner may leave only if another owner remains; nobody else may remove an owner
      if (!isSelf || (await travelGroupRepository.countOwners(groupId)) < 2) {
        throw httpError(400, 'The group owner cannot be removed. Transfer ownership first.');
      }
    } else if (!isSelf) {
      if (actor.role === 'MEMBER' || actor.role === 'VIEWER') {
        throw httpError(403, 'You can only remove yourself from the group.');
      }
      if (actor.role === 'ADMIN' && target.role === 'ADMIN') {
        throw httpError(403, 'Admins cannot remove other admins.');
      }
    }

    await travelGroupRepository.removeMember(target);
    return { left: isSelf };
  }
}

module.exports = new TravelGroupService();
