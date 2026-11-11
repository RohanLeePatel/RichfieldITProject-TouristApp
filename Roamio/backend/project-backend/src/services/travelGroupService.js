const travelGroupRepository = require('../repositories/travelGroupRepository');
const { httpError } = require('./tripAccessService');
const { companionsSchema, unpackGroupMeta, packGroupMeta } = require('../utils/groupMeta');

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
      ...unpackGroupMeta(group.description),
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

  // Replaces the group's companion list (people without an account). Any
  // member but a VIEWER may edit it; the whole list is sent each time.
  async saveCompanions(groupId, userId, body) {
    const { membership, group } = await requireMembership(groupId, userId);
    if (membership.role === 'VIEWER') throw httpError(403, "Viewers can't change the group's companions.");

    const parsed = companionsSchema.safeParse(body);
    if (!parsed.success) throw httpError(400, parsed.error.issues[0].message);

    const { description } = unpackGroupMeta(group.description);
    await travelGroupRepository.updateDescription(groupId, packGroupMeta(description, parsed.data.companions));
    return parsed.data.companions;
  }

  // What a /join/:code link shows before joining
  async previewByCode(code, userId) {
    const group = await travelGroupRepository.findByInviteCode(code);
    if (!group) throw httpError(404, "This invite link isn't valid. Check you copied the whole link, or ask the trip owner for a new invite.");
    return {
      id: group.id,
      name: group.name,
      memberCount: group.members.length,
      alreadyMember: group.members.some((member) => member.userId === userId),
    };
  }
}

module.exports = new TravelGroupService();
