const { httpError } = require('./tripAccessService');

// People a traveller books for (Settings > Saved travellers). Another person's
// details, so: only with their permission (a parent or guardian's, for a minor),
// and never their passport or ID number - only its last four characters.

const MAX_TRAVELLERS = 20;
const RELATIONSHIPS = ['Partner or spouse', 'Child', 'Parent', 'Sibling', 'Relative', 'Friend', 'Colleague', 'Other'];
const DOCUMENT_TYPES = ['passport', 'id'];
const NAME = /^[\p{L}\p{M}][\p{L}\p{M} .'’-]*$/u;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE = /^\+?[\d\s()-]{7,20}$/;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

const text = (value) => (typeof value === 'string' ? value.trim() : '');

// 'YYYY-MM-DD' -> Date at UTC midnight, or null for anything that isn't a real day
function parseDay(value) {
  if (typeof value !== 'string' || !ISO_DATE.test(value)) return null;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value ? null : date;
}

const isoDay = (date) => (date ? date.toISOString().slice(0, 10) : null);

function ageOn(dateOfBirth, now) {
  let age = now.getUTCFullYear() - dateOfBirth.getUTCFullYear();
  const beforeBirthday =
    now.getUTCMonth() < dateOfBirth.getUTCMonth() ||
    (now.getUTCMonth() === dateOfBirth.getUTCMonth() && now.getUTCDate() < dateOfBirth.getUTCDate());
  if (beforeBirthday) age -= 1;
  return age;
}

function name(value, label) {
  const result = text(value);
  if (!result || result.length > 40 || !NAME.test(result)) {
    throw httpError(400, `Enter ${label} using letters, spaces, hyphens and apostrophes only (up to 40 characters).`);
  }
  return result;
}

// Turns a request body into the columns to save. `existing` (a stored row) is
// there on an update: it keeps the saved document digits and the original
// consent date when the request leaves them out.
function toRow(body, existing, now = new Date()) {
  if (!body || typeof body !== 'object') throw httpError(400, 'Send the traveller as JSON.');

  const firstName = name(body.firstName, 'the first name');
  const lastName = name(body.lastName, 'the last name');
  if (!RELATIONSHIPS.includes(body.relationship)) throw httpError(400, "Choose how you know them.");

  const dateOfBirth = parseDay(body.dateOfBirth);
  if (!dateOfBirth || dateOfBirth < new Date('1900-01-01T00:00:00Z') || dateOfBirth > now) {
    throw httpError(400, 'Enter a date of birth from 1900 up to today.');
  }

  const nationality = text(body.nationality);
  if (nationality && (nationality.length > 40 || !NAME.test(nationality))) throw httpError(400, 'Enter a valid nationality.');

  const email = text(body.email);
  if (email && (email.length > 254 || !EMAIL.test(email))) throw httpError(400, 'Enter a valid email address.');

  const phone = text(body.phone);
  if (phone && !PHONE.test(phone)) throw httpError(400, 'Enter a valid phone number: 7-20 digits, optionally starting with +.');

  const documentType = body.documentType === undefined ? existing?.documentType || 'passport' : body.documentType;
  if (!DOCUMENT_TYPES.includes(documentType)) throw httpError(400, 'The document must be a passport or an ID card.');

  // Only the last four characters survive this function; the number itself is
  // never stored or logged.
  let documentLast4 = existing?.documentLast4 ?? null;
  if (typeof body.documentNumber === 'string' && body.documentNumber.trim()) {
    const number = body.documentNumber.replace(/[\s-]+/g, '').toUpperCase();
    if (!/^[A-Z0-9]{5,20}$/.test(number)) throw httpError(400, 'A document number uses 5-20 letters and numbers only.');
    documentLast4 = number.slice(-4);
  }

  let documentExpiry = existing?.documentExpiry ?? null;
  if (body.documentExpiry !== undefined) {
    if (body.documentExpiry === null || body.documentExpiry === '') {
      documentExpiry = null;
    } else {
      documentExpiry = parseDay(body.documentExpiry);
      if (!documentExpiry || documentExpiry > new Date('2100-12-31T00:00:00Z') || documentExpiry <= dateOfBirth) {
        throw httpError(400, 'Enter an expiry date after the date of birth and before 2100.');
      }
    }
  }

  if (body.consent?.given !== true) throw httpError(400, 'You need their permission to save their details.');
  const minor = ageOn(dateOfBirth, now) < 18;
  if (minor && body.consent.guardian !== true) throw httpError(400, "Confirm you're their parent or legal guardian.");

  return {
    firstName,
    lastName,
    relationship: body.relationship,
    dateOfBirth,
    nationality,
    email,
    phone,
    documentType,
    documentLast4,
    documentExpiry,
    consentGiven: true,
    consentGuardian: minor,
    // the first time they were agreed to; the browser's clock isn't asked
    consentAt: existing?.consentAt ?? now,
  };
}

// What the browser gets back: never a document number, only its last four
function toTraveller(row) {
  return {
    id: row.id,
    firstName: row.firstName,
    lastName: row.lastName,
    relationship: row.relationship,
    dateOfBirth: isoDay(row.dateOfBirth),
    nationality: row.nationality,
    email: row.email,
    phone: row.phone,
    documentType: row.documentType,
    documentLast4: row.documentLast4,
    documentExpiry: isoDay(row.documentExpiry),
    consent: { given: row.consentGiven, guardian: row.consentGuardian, at: row.consentAt.toISOString() },
  };
}

module.exports = { toRow, toTraveller, MAX_TRAVELLERS };
