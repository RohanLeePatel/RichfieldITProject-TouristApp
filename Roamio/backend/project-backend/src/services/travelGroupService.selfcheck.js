// Group companions (people without an account) and the /join link preview:
// companions are validated and stored in the group's description JSON next to
// the description, viewers can't edit them, and a plain-text description from
// before survives. The repository is stubbed.
// node src/services/travelGroupService.selfcheck.js
const assert = require('node:assert/strict');
const path = require('node:path');

let role = 'MEMBER';
let description = 'Our yearly beach trip';
const group = () => ({ id: 4, name: 'Crew', description, members: [{ userId: 7 }, { userId: 8 }] });

require.cache[path.join(__dirname, '../repositories/travelGroupRepository.js')] = {
  exports: {
    findMembership: async () => ({ role }),
    findActiveGroupDetails: async () => group(),
    updateDescription: async (id, value) => { description = value; },
    findByInviteCode: async (code) => (code === 'AB12CD34' ? group() : null),
  },
};

const service = require('./travelGroupService');
const { formatGroup } = require('../utils/groupMeta');

(async () => {
  const mia = { id: 'c1', name: 'Mia', type: 'Child', age: 8, interests: ['Beaches', 'Zoos & aquariums'] };
  const saved = await service.saveCompanions(4, 7, { companions: [mia, { id: 'c2', name: ' Gran ', type: 'Adult' }] });
  assert.equal(saved[1].name, 'Gran'); // trimmed
  assert.deepEqual(saved[1].interests, []);

  // stored as JSON beside the old description, read back by formatGroup
  const read = formatGroup(group());
  assert.equal(read.description, 'Our yearly beach trip');
  assert.deepEqual(read.companions.map((c) => c.name), ['Mia', 'Gran']);

  // bad input and viewers are refused
  await assert.rejects(service.saveCompanions(4, 7, { companions: [{ id: 'x', name: '', type: 'Adult' }] }), { statusCode: 400 });
  await assert.rejects(service.saveCompanions(4, 7, { companions: [{ id: 'x', name: 'Kid', type: 'Child', age: 30 }] }), { statusCode: 400 });
  role = 'VIEWER';
  await assert.rejects(service.saveCompanions(4, 7, { companions: [] }), { statusCode: 403 });

  // a group whose description was never JSON has no companions
  assert.deepEqual(formatGroup({ description: 'plain' }).companions, []);
  assert.deepEqual(formatGroup({ description: null }).companions, []);
  // A list response must apply the same manager-only join-code rule as details.
  const shared = { ...group(), inviteCode: 'SYNTHETIC', members: [{ userId: 7, role: 'OWNER' }, { userId: 8, role: 'MEMBER' }, { userId: 9, role: 'VIEWER' }] };
  assert.equal(formatGroup(shared, 7).inviteCode, 'SYNTHETIC');
  assert.equal(formatGroup(shared, 8).inviteCode, undefined);
  assert.equal(formatGroup(shared, 9).inviteCode, undefined);
  assert.equal(formatGroup(shared).inviteCode, undefined);

  // the join link's preview
  assert.deepEqual(await service.previewByCode('AB12CD34', 9), { id: 4, name: 'Crew', memberCount: 2, alreadyMember: false });
  assert.equal((await service.previewByCode('AB12CD34', 7)).alreadyMember, true);
  await assert.rejects(service.previewByCode('NOPE', 7), { statusCode: 404 });

  console.log('travelGroupService selfcheck: all assertions passed');
})();
