const { z } = require('zod');

// A travel group's companions: people on its trips who don't have a Roamio
// account (a child, a parent without the app), with the interests the trip
// wizard plans around. TravelGroup has no column for them, so they ride in
// TravelGroup.description as JSON - the same trick trips use for their
// destination and budget (tripFormat.packMeta). No schema change.

const companionSchema = z.object({
  id: z.string().min(1).max(64),
  name: z.string().trim().min(1, 'Every companion needs a name.').max(60),
  type: z.enum(['Adult', 'Child']),
  age: z.number().int().min(0).max(17).nullable().optional(),
  relationship: z.string().max(40).optional(),
  interests: z.array(z.string().min(1).max(40)).max(30).default([]),
  color: z.string().max(20).optional(),
});

const companionsSchema = z.object({
  companions: z.array(companionSchema).max(30, 'A group can have up to 30 companions.'),
});

// { description, companions } - a plain-text description (written before
// companions existed) stays the description, with no companions
function unpackGroupMeta(description) {
  try {
    const meta = JSON.parse(description);
    if (meta && typeof meta === 'object' && Array.isArray(meta.companions)) {
      return { description: meta.description ?? null, companions: meta.companions };
    }
  } catch {
    // not JSON
  }
  return { description: description || null, companions: [] };
}

function packGroupMeta(description, companions) {
  return JSON.stringify({ description: description ?? null, companions });
}

// a group as the API returns it: description unpacked, companions alongside
const formatGroup = (group, userId) => {
  const { inviteCode, ...visible } = group;
  const role = group.members?.find((member) => member.userId === userId)?.role;
  return {
    ...visible,
    ...unpackGroupMeta(group.description),
    ...(['OWNER', 'ADMIN'].includes(role) && { inviteCode }),
  };
};

module.exports = { companionsSchema, unpackGroupMeta, packGroupMeta, formatGroup };
