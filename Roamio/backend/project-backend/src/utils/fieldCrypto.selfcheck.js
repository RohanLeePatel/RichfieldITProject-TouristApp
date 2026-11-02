// AES-GCM field encryption and the Prisma extension's handler, against a fake query.
// node src/utils/fieldCrypto.selfcheck.js
const assert = require('node:assert/strict');
const crypto = require('node:crypto');

process.env.APP_ENCRYPTION_KEY = crypto.randomBytes(32).toString('base64');
const { encryptText, decryptText, encryptBytes, decryptBytes, isEncryptedText, isEncryptedBytes } = require('./fieldCrypto');
const { handler, encryptData } = require('./columnEncryption');

(async () => {
  /* ---------- primitives ---------- */
  const sealed = encryptText('197.12.4.9', 'LoginEvent.ipAddress');
  assert.ok(isEncryptedText(sealed) && !sealed.includes('197.12'));
  assert.equal(decryptText(sealed, 'LoginEvent.ipAddress'), '197.12.4.9');
  assert.notEqual(encryptText('x', 'A.b'), encryptText('x', 'A.b'), 'a fresh IV each time');
  assert.equal(encryptText('', 'A.b'), '');
  assert.equal(encryptText(null, 'A.b'), null);
  assert.equal(decryptText('plain legacy value', 'A.b'), 'plain legacy value');
  assert.throws(() => decryptText(sealed, 'UserSession.ipAddress'), 'a ciphertext moved to another column is rejected');
  const tampered = sealed.slice(0, -4) + (sealed.endsWith('AAAA') ? 'BBBB' : 'AAAA');
  assert.throws(() => decryptText(tampered, 'LoginEvent.ipAddress'));

  const pdf = Buffer.from('%PDF-1.4 secret ticket');
  const sealedBytes = encryptBytes(pdf, 'TripDocument.data');
  assert.ok(isEncryptedBytes(sealedBytes) && !sealedBytes.includes('secret'));
  assert.deepEqual(decryptBytes(new Uint8Array(sealedBytes), 'TripDocument.data'), pdf, 'a Uint8Array from Prisma works too');
  assert.deepEqual(decryptBytes(pdf, 'TripDocument.data'), pdf, 'legacy plaintext bytes pass through');

  /* ---------- the extension ---------- */
  const seen = [];
  const store = (rows) => async (args) => (seen.push(args), rows);

  // writes are encrypted before they reach the database, and the result is decrypted
  let written;
  const created = await handler({
    model: 'SavedTraveller',
    args: { data: { id: 't1', userId: 1, firstName: 'Ada', dateOfBirth: new Date('1990-05-17T00:00:00Z'), documentExpiry: null, nationality: '' } },
    query: async (args) => ((written = args.data), { ...args.data }),
  });
  assert.ok(isEncryptedText(written.firstName) && isEncryptedText(written.dateOfBirth));
  assert.equal(written.userId, 1);
  assert.equal(written.nationality, '', 'empty strings are left alone');
  assert.equal(written.documentExpiry, null);
  assert.equal(created.firstName, 'Ada');
  assert.equal(created.dateOfBirth.toISOString(), '1990-05-17T00:00:00.000Z');

  // legacy plaintext date text (between migration and backfill) still reads as a Date
  const [legacy] = await handler({ model: 'SavedTraveller', args: {}, query: store([{ id: 't2', dateOfBirth: '2001-02-03', firstName: 'Bob' }]) });
  assert.equal(legacy.dateOfBirth.toISOString(), '2001-02-03T00:00:00.000Z');
  assert.equal(legacy.firstName, 'Bob');

  // createMany / update { set } / upsert create+update
  let batch;
  await handler({ model: 'LoginEvent', args: { data: [{ userId: 1, ipAddress: '1.1.1.1', success: true }, { userId: 1, ipAddress: '2.2.2.2', success: false }] }, query: async (a) => ((batch = a.data), { count: 2 }) });
  assert.ok(batch.every((row) => isEncryptedText(row.ipAddress)));
  let updated;
  await handler({ model: 'UserSession', args: { where: { id: 's' }, data: { location: { set: 'Cape Town' }, lastSeenAt: new Date() } }, query: async (a) => ((updated = a.data), { id: 's' }) });
  assert.ok(isEncryptedText(updated.location.set));
  let upserted;
  await handler({ model: 'PushSubscription', args: { where: { endpoint: 'https://e' }, create: { endpoint: 'https://e', p256dh: 'k', auth: 'a' }, update: { p256dh: 'k', auth: 'a' } }, query: async (a) => ((upserted = a), {}) });
  assert.ok(isEncryptedText(upserted.create.auth) && isEncryptedText(upserted.update.p256dh));
  assert.equal(upserted.create.endpoint, 'https://e', 'endpoint stays plaintext');

  // a document round-trips as bytes
  let doc;
  const savedDoc = await handler({ model: 'TripDocument', args: { data: { id: 'd', data: pdf } }, query: async (a) => ((doc = a.data), { ...a.data }) });
  assert.ok(isEncryptedBytes(doc.data));
  assert.deepEqual(savedDoc.data, pdf);

  // nested relation (User -> loginEvents) is decrypted
  const [user] = await handler({
    model: 'User',
    args: {},
    query: async () => [{ id: 1, loginEvents: [{ id: 9, ipAddress: encryptText('9.9.9.9', 'LoginEvent.ipAddress') }] }],
  });
  assert.equal(user.loginEvents[0].ipAddress, '9.9.9.9');

  // other models and non-row results are untouched
  assert.equal(await handler({ model: 'Trip', args: { where: { id: 1 } }, query: async () => ({ id: 1, title: 't' }) }).then((r) => r.title), 't');
  assert.equal(await handler({ model: 'LoginEvent', args: { where: { userId: 1 } }, query: async () => 3 }), 3);
  assert.deepEqual(await handler({ model: 'LoginEvent', args: {}, query: async () => ({ count: 4 }) }), { count: 4 });

  // filtering or sorting on ciphertext is refused
  await assert.rejects(handler({ model: 'LoginEvent', args: { where: { ipAddress: '1.1.1.1' } }, query: store([]) }), /encrypted/);
  await assert.rejects(handler({ model: 'SavedTraveller', args: { where: { OR: [{ email: 'a@b.c' }] } }, query: store([]) }), /encrypted/);
  await assert.rejects(handler({ model: 'SavedTraveller', args: { orderBy: { lastName: 'asc' } }, query: store([]) }), /encrypted/);
  assert.throws(() => encryptData('UserSession', { ipAddress: { increment: 1 } }), /unsupported write operator/);
  assert.equal(seen.length, 1, 'only the legitimate reads reached the database');

  /* ---------- User / Invitation email: encrypted, matched through a blind index ---------- */
  const { blindIndex } = require('./fieldCrypto');
  assert.equal(blindIndex(' Ada@Example.com '), blindIndex('ada@example.com'), 'the index ignores case and spacing');
  assert.notEqual(blindIndex('ada@example.com'), blindIndex('bob@example.com'));
  assert.match(blindIndex('ada@example.com'), /^[0-9a-f]{64}$/);

  // a new account stores ciphertext plus the hash, and the caller gets plaintext back
  let newUser;
  const registered = await handler({
    model: 'User',
    args: { data: { email: 'ada@example.com', fullName: 'Ada Lovelace', passwordHash: 'x', preferences: { create: {} } }, select: { id: true, email: true, fullName: true } },
    query: async (args) => ((newUser = args.data), { id: 1, email: args.data.email, fullName: args.data.fullName }),
  });
  assert.ok(isEncryptedText(newUser.email) && isEncryptedText(newUser.fullName));
  assert.equal(newUser.emailHash, blindIndex('ada@example.com'));
  assert.equal(newUser.passwordHash, 'x');
  assert.deepEqual(registered, { id: 1, email: 'ada@example.com', fullName: 'Ada Lovelace' });

  // the lookups the app already makes are rewritten to the hash, so no caller changes
  let sent;
  const spy = async (args) => ((sent = args), null);
  await handler({ model: 'User', args: { where: { email: { equals: 'Ada@Example.com', mode: 'insensitive' }, deletedAt: null } }, query: spy });
  assert.deepEqual(sent.where, { emailHash: blindIndex('ada@example.com'), deletedAt: null });
  await handler({ model: 'User', args: { where: { email: 'ada@example.com' } }, query: spy });
  assert.deepEqual(sent.where, { emailHash: blindIndex('ada@example.com') });
  await handler({ model: 'User', args: { where: { OR: [{ email: 'a@x.co' }, { id: 4 }] } }, query: spy });
  assert.deepEqual(sent.where, { OR: [{ emailHash: blindIndex('a@x.co') }, { id: 4 }] });
  await handler({ model: 'User', args: { where: { email: { in: ['a@x.co', 'B@x.co'] } } }, query: spy });
  assert.deepEqual(sent.where, { emailHash: { in: [blindIndex('a@x.co'), blindIndex('b@x.co')] } });
  // through a relation (invitationRepository.isEmailGroupMember) on a model with no encrypted columns
  await handler({ model: 'TravelGroupMember', args: { where: { travelGroupId: 2, user: { email: { equals: 'Ada@Example.com', mode: 'insensitive' } } } }, query: spy });
  assert.deepEqual(sent.where, { travelGroupId: 2, user: { emailHash: blindIndex('ada@example.com') } });
  await handler({ model: 'Trip', args: { where: { members: { some: { user: { email: 'ada@example.com' } } } } }, query: spy });
  assert.deepEqual(sent.where, { members: { some: { user: { emailHash: blindIndex('ada@example.com') } } } });

  // an update through { set } keeps the index in step
  await handler({ model: 'User', args: { where: { id: 1 }, data: { email: { set: 'new@example.com' } } }, query: spy });
  assert.equal(sent.data.emailHash, blindIndex('new@example.com'));
  assert.ok(isEncryptedText(sent.data.email.set));
  await handler({ model: 'Invitation', args: { data: { email: 'bob@example.com', token: 't' } }, query: spy });
  assert.equal(sent.data.emailHash, blindIndex('bob@example.com'));

  // reading through nested relations several levels deep (group -> members -> user)
  const group = await handler({
    model: 'TravelGroup',
    args: {},
    query: async () => ({
      id: 1,
      members: [{ id: 1, user: { id: 7, fullName: encryptText('Ada', 'User.fullName'), email: encryptText('ada@example.com', 'User.email') } }],
      invitations: [{ id: 3, email: encryptText('bob@example.com', 'Invitation.email'), inviter: { fullName: encryptText('Ada', 'User.fullName') } }],
    }),
  });
  assert.deepEqual(group.members[0].user, { id: 7, fullName: 'Ada', email: 'ada@example.com' });
  assert.equal(group.invitations[0].email, 'bob@example.com');
  assert.equal(group.invitations[0].inviter.fullName, 'Ada');
  // users still stored in plaintext (before the backfill) read normally
  const [oldUser] = await handler({ model: 'User', args: {}, query: async () => [{ id: 2, email: 'old@example.com', fullName: 'Old' }] });
  assert.equal(oldUser.email, 'old@example.com');

  // what cannot work on ciphertext fails loudly
  await assert.rejects(handler({ model: 'User', args: { where: { email: { contains: 'ada' } } }, query: spy }), /only equality/);
  await assert.rejects(handler({ model: 'User', args: { where: { fullName: { contains: 'Ada' } } }, query: spy }), /encrypted/);
  await assert.rejects(handler({ model: 'User', args: { orderBy: [{ createdAt: 'asc' }, { fullName: 'asc' }] }, query: spy }), /orderBy/);

  // a different key cannot read it
  process.env.APP_ENCRYPTION_KEY = crypto.randomBytes(32).toString('base64');
  for (const id of Object.keys(require.cache)) if (id.endsWith('fieldCrypto.js')) delete require.cache[id];
  const other = require('./fieldCrypto');
  assert.throws(() => other.decryptText(sealed, 'LoginEvent.ipAddress'));

  console.log('fieldCrypto selfcheck passed');
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
