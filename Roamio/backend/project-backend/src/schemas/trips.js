const { z } = require('zod');

// Trip Schemas
const tripFields = z.object({
  title: z.string().min(1, 'Title is required').max(100, 'Title is too long'),
  destination: z.string().min(1, 'Destination is required'),
  startDate: z.string().datetime({ offset: true }).optional().nullable().or(z.string().optional()),
  endDate: z.string().datetime({ offset: true }).optional().nullable().or(z.string().optional()),
  budget: z.number().nonnegative('Budget must be a positive number').optional().nullable(),
  notes: z.string().optional().nullable(),
  // what the wizard collected, kept on the trip (Trip.description JSON)
  currency: z.string().regex(/^[A-Z]{3}$/, 'Currency must be a 3-letter code').optional().nullable(),
  travellers: z
    .object({
      adults: z.number().int().min(1).max(50),
      childAges: z.array(z.number().int().min(0).max(17)).max(20).default([]),
    })
    .optional()
    .nullable(),
  interests: z.array(z.string().min(1).max(40)).max(30).optional().nullable(),
  // plan it in a shared travel group instead of the personal one
  travelGroupId: z.number().int().positive().optional().nullable(),
});

// A new trip: dates must be real and the end can't come before the start.
const createTripSchema = tripFields.superRefine((trip, ctx) => {
  const start = trip.startDate ? new Date(trip.startDate) : null;
  const end = trip.endDate ? new Date(trip.endDate) : null;
  for (const [field, date] of [['startDate', start], ['endDate', end]]) {
    if (date && Number.isNaN(date.getTime())) ctx.addIssue({ code: 'custom', path: [field], message: 'That date is not valid.' });
  }
  if (start && end && !Number.isNaN(start.getTime()) && !Number.isNaN(end.getTime()) && end < start) {
    ctx.addIssue({ code: 'custom', path: ['endDate'], message: "The trip can't end before it starts." });
  }
});

// Edit a saved trip: any of the fields above, each optional. The dates come
// together or not at all (checked in the route, which knows the itinerary).
const updateTripSchema = tripFields.omit({ travelGroupId: true }).partial();

// New order of a saved itinerary: each day lists its item ids top to bottom.
const reorderItinerarySchema = z.object({
  days: z
    .array(z.object({ dayNumber: z.number().int().min(1).max(30), itemIds: z.array(z.string().min(1)).max(200) }))
    .min(1)
    .max(30),
});

// Itinerary Item Schema
const createItinerarySchema = z.object({
  title: z.string().min(1, 'Activity title is required'),
  location: z.string().optional().nullable(),
  dayNumber: z.number().int().positive('Day number must be a positive integer').optional().nullable(),
  startTime: z.string().optional().nullable(),
  cost: z.number().nonnegative('Cost cannot be negative').optional().nullable(),
  notes: z.string().optional().nullable(),
  // stored in the item's description (see utils/tripFormat.packItemMeta) so the
  // saved trip can be drawn on a map
  lat: z.number().min(-90).max(90).optional().nullable(),
  lon: z.number().min(-180).max(180).optional().nullable(),
});

// Trip Document Schema - the file itself arrives base64-encoded in JSON (see
// routes/tripDocuments.js). The decoded byte length is what gets capped, so the
// limit here is only a cheap early reject on the encoded string.
const createDocumentSchema = z.object({
  filename: z.string().min(1, 'Filename is required').max(255, 'Filename is too long'),
  mimeType: z.string().min(1, 'File type is required'),
  kind: z.enum(['TICKET', 'BOOKING', 'RECEIPT', 'VISA', 'INSURANCE', 'OTHER']).optional(),
  dataBase64: z
    .string()
    .min(1, 'File data is required')
    .max(2_000_000, 'That file is too large (1 MB max)'),
});

module.exports = {
  createTripSchema,
  updateTripSchema,
  reorderItinerarySchema,
  createItinerarySchema,
  createDocumentSchema,
};
