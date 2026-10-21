// node src/routes/tripDocuments.selfcheck.js
const assert = require('node:assert/strict');
const { MAX_BYTES, MAX_DOCS_PER_TRIP, ALLOWED_MIME_TYPES, matchesMagicNumber } = require('./tripDocuments');
const { createDocumentSchema } = require('../schemas/trips');

// real headers are accepted
assert.ok(matchesMagicNumber(Buffer.from('%PDF-1.7\n'), 'application/pdf'));
assert.ok(matchesMagicNumber(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a]), 'image/png'));
assert.ok(matchesMagicNumber(Buffer.from([0xff, 0xd8, 0xff, 0xe0]), 'image/jpeg'));
assert.ok(matchesMagicNumber(Buffer.from('RIFF....WEBP'), 'image/webp'));

// a mime type that doesn't match the bytes is the whole point of the check
assert.ok(!matchesMagicNumber(Buffer.from('%PDF-1.7\n'), 'image/png'));
assert.ok(!matchesMagicNumber(Buffer.from('<?php echo 1; ?>'), 'application/pdf'));
assert.ok(!matchesMagicNumber(Buffer.from('MZ\x90\x00'), 'application/pdf')); // a Windows .exe
assert.ok(!matchesMagicNumber(Buffer.alloc(0), 'application/pdf')); // empty
assert.ok(!matchesMagicNumber(Buffer.from([0x25]), 'application/pdf')); // truncated
assert.ok(!matchesMagicNumber(Buffer.from('%PDF'), 'application/x-msdownload')); // unknown type

// only travel-document formats are allowed through
assert.ok(ALLOWED_MIME_TYPES.has('application/pdf'));
assert.ok(!ALLOWED_MIME_TYPES.has('text/html'));
assert.ok(!ALLOWED_MIME_TYPES.has('image/svg+xml')); // SVG can carry script

// the Zod layer rejects the obvious bad bodies before any decoding happens
assert.ok(!createDocumentSchema.safeParse({}).success);
assert.ok(!createDocumentSchema.safeParse({ filename: '', mimeType: 'application/pdf', dataBase64: 'x' }).success);
assert.ok(!createDocumentSchema.safeParse({ filename: 'a.pdf', mimeType: 'application/pdf', dataBase64: '' }).success);
assert.ok(
  !createDocumentSchema.safeParse({
    filename: 'a.pdf',
    mimeType: 'application/pdf',
    kind: 'NOT_A_KIND',
    dataBase64: 'x',
  }).success,
);
assert.ok(
  createDocumentSchema.safeParse({
    filename: 'boarding-pass.pdf',
    mimeType: 'application/pdf',
    kind: 'TICKET',
    dataBase64: Buffer.from('%PDF-1.7\n').toString('base64'),
  }).success,
);
// kind is optional - the route defaults it to OTHER
assert.ok(
  createDocumentSchema.safeParse({ filename: 'a.pdf', mimeType: 'application/pdf', dataBase64: 'eA==' }).success,
);

// base64 inflates by ~33%, so the encoded-string cap must leave a 1 MB file room
assert.ok(MAX_BYTES * 1.37 < 2_000_000);
assert.equal(MAX_DOCS_PER_TRIP, 20);

console.log('tripDocuments selfcheck: all assertions passed');
