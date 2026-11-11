const express = require('express');
const { randomUUID } = require('node:crypto');
const router = express.Router();
const requireAuth = require('../middleware/authMiddleware');

const prisma = require('../config/prisma');
const { assertTripAccess } = require('../services/tripAccessService');
const validate = require('../middleware/validate');
const { createDocumentSchema } = require('../schemas/trips');
const { accessibleTrips } = require('../utils/tripFormat');

// The trip document vault: booking confirmations, tickets and receipts.
//
// Uploads arrive as base64 in a JSON body rather than multipart. express.json()
// already parses JSON, so there's no file-upload dependency to add, and the
// frontend reads the file with FileReader anyway. Base64 costs ~33% in transit,
// which the 1 MB cap below keeps well inside Vercel's ~4.5 MB body limit.
//
// Table added by prisma/live-sql/001_trip_document.sql (already applied to the
// live DB). server.js gives this path a 2 MB JSON body limit.

const MAX_BYTES = 1024 * 1024; // 1 MB per file, same ceiling as the OCR upload path
const MAX_DOCS_PER_TRIP = 20;

// Only the formats a travel document actually arrives in. Anything executable
// or unrecognised is refused outright rather than stored and served back later.
const ALLOWED_MIME_TYPES = new Set(['application/pdf', 'image/png', 'image/jpeg', 'image/webp']);

// First bytes of each accepted format. The browser-supplied mime type is a
// hint, not evidence, so the real bytes get checked too.
const MAGIC_NUMBERS = {
  'application/pdf': [0x25, 0x50, 0x44, 0x46], // %PDF
  'image/png': [0x89, 0x50, 0x4e, 0x47], // \x89PNG
  'image/jpeg': [0xff, 0xd8, 0xff],
  'image/webp': [0x52, 0x49, 0x46, 0x46], // RIFF....WEBP
};

const matchesMagicNumber = (buffer, mimeType) => {
  const expected = MAGIC_NUMBERS[mimeType];
  if (!expected || buffer.length < expected.length) return false;
  return expected.every((byte, index) => buffer[index] === byte);
};

router.use(requireAuth);

const parseId = (value) => {
  const id = parseInt(value, 10);
  return Number.isNaN(id) ? null : id;
};

// Resolves the trip only if this user can reach it, so a document id from one
// trip can never be read through another trip's URL.
async function authorisedTrip(req, res) {
  const tripId = parseId(req.params.tripId);
  if (tripId === null) {
    res.status(400).json({ message: 'Invalid trip ID.' });
    return null;
  }

  const trip = await prisma.trip.findFirst({ where: accessibleTrips(req.user.userId, { id: tripId }) });
  if (!trip) {
    res.status(404).json({ message: 'Trip not found or unauthorized.' });
    return null;
  }
  return trip;
}

const listFields = {
  id: true,
  filename: true,
  mimeType: true,
  sizeBytes: true,
  kind: true,
  createdAt: true,
  uploadedBy: { select: { id: true, fullName: true } },
};

// List the documents attached to a trip (metadata only)
router.get('/:tripId/documents', async (req, res) => {
  try {
    const trip = await authorisedTrip(req, res);
    if (!trip) return undefined;

    const documents = await prisma.tripDocument.findMany({
      where: { tripId: trip.id },
      select: listFields,
      orderBy: { createdAt: 'desc' },
    });

    return res.json({ documents });
  } catch (error) {
    console.error('Error listing trip documents:', error);
    return res.status(500).json({ message: 'Internal server error.' });
  }
});

// Attach a document (PDF or image) to a trip
router.post('/:tripId/documents', validate(createDocumentSchema), async (req, res) => {
  try {
    const trip = await authorisedTrip(req, res);
    if (!trip) return undefined;
    await assertTripAccess(trip.id, req.user.userId, { write: true, denied: 'Viewers cannot change trip documents' });

    const { filename, mimeType, kind, dataBase64 } = req.body;

    if (!ALLOWED_MIME_TYPES.has(mimeType)) {
      return res.status(415).json({ message: 'Attach a PDF or an image (PNG, JPEG or WebP).' });
    }

    const data = Buffer.from(dataBase64, 'base64');
    if (data.length === 0) {
      return res.status(400).json({ message: 'That file appears to be empty.' });
    }
    if (data.length > MAX_BYTES) {
      return res.status(413).json({ message: 'That file is too large (1 MB max).' });
    }
    if (!matchesMagicNumber(data, mimeType)) {
      return res.status(415).json({ message: `That file does not look like a valid ${mimeType}.` });
    }

    const existing = await prisma.tripDocument.count({ where: { tripId: trip.id } });
    if (existing >= MAX_DOCS_PER_TRIP) {
      return res
        .status(413)
        .json({ message: `This trip already has ${MAX_DOCS_PER_TRIP} documents. Remove one first.` });
    }

    const document = await prisma.tripDocument.create({
      data: {
        id: randomUUID(),
        tripId: trip.id,
        uploadedById: req.user.userId,
        filename,
        mimeType,
        sizeBytes: data.length,
        kind: kind || 'OTHER',
        data,
      },
      select: listFields,
    });

    return res.status(201).json({ message: 'Document attached.', document });
  } catch (error) {
    if (error.statusCode && error.statusCode < 500) return res.status(error.statusCode).json({ message: error.message });
    console.error('Error attaching trip document:', error);
    return res.status(500).json({ message: 'Internal server error.' });
  }
});

// Download one document
router.get('/:tripId/documents/:documentId', async (req, res) => {
  try {
    const trip = await authorisedTrip(req, res);
    if (!trip) return undefined;

    const document = await prisma.tripDocument.findFirst({
      where: { id: req.params.documentId, tripId: trip.id },
    });
    if (!document) {
      return res.status(404).json({ message: 'Document not found.' });
    }

    res.setHeader('Content-Type', document.mimeType);
    res.setHeader('Content-Length', document.sizeBytes);
    // inline so the browser previews a PDF instead of forcing a download;
    // the filename is quoted and stripped of quotes/newlines so it can't
    // inject extra header directives
    const safeName = document.filename.replace(/["\r\n]/g, '');
    res.setHeader('Content-Disposition', `inline; filename="${safeName}"`);
    // uploaded by users and served from our own origin - stop the browser
    // sniffing it into something executable
    res.setHeader('X-Content-Type-Options', 'nosniff');
    return res.send(document.data);
  } catch (error) {
    console.error('Error downloading trip document:', error);
    return res.status(500).json({ message: 'Internal server error.' });
  }
});

// Remove a document from a trip
router.delete('/:tripId/documents/:documentId', async (req, res) => {
  try {
    const trip = await authorisedTrip(req, res);
    if (!trip) return undefined;
    await assertTripAccess(trip.id, req.user.userId, { write: true, denied: 'Viewers cannot change trip documents' });

    // scoped to this trip so one trip's id can't delete another trip's document
    const { count } = await prisma.tripDocument.deleteMany({
      where: { id: req.params.documentId, tripId: trip.id },
    });
    if (count === 0) {
      return res.status(404).json({ message: 'Document not found.' });
    }

    return res.json({ message: 'Document removed.' });
  } catch (error) {
    if (error.statusCode && error.statusCode < 500) return res.status(error.statusCode).json({ message: error.message });
    console.error('Error deleting trip document:', error);
    return res.status(500).json({ message: 'Internal server error.' });
  }
});

module.exports = { router, MAX_BYTES, MAX_DOCS_PER_TRIP, ALLOWED_MIME_TYPES, matchesMagicNumber };
