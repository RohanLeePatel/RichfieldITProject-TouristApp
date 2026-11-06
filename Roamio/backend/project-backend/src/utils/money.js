// Money is handled as integer cents in JS and stored as Decimal(12,2) in Postgres.
// Floats can't represent 0.10 + 0.20 exactly, so every sum and split is computed in
// cents and converted back to a decimal only at the edges (input parsing and output).

// Largest accepted amount, in cents (99,999,999.99). This is below what Decimal(12,2)
// can store, so it acts as a stricter application-level cap.
const MAX_CENTS = 9999999999;

// Returns integer cents, or null if the value isn't a non-negative amount with <= 2 decimals
const toCents = (value) => {
  if (typeof value !== 'number' && typeof value !== 'string') return null;
  const str = String(value).trim();
  if (!/^\d+(\.\d{1,2})?$/.test(str)) return null;
  const [whole, frac = ''] = str.split('.');
  const cents = parseInt(whole, 10) * 100 + parseInt(frac.padEnd(2, '0'), 10);
  return cents <= MAX_CENTS ? cents : null;
};

// Prisma Decimal (or null) -> integer cents
const decimalToCents = (decimal) => (decimal == null ? 0 : Math.round(Number(decimal.toString()) * 100));

// Integer cents -> string accepted by Prisma Decimal fields
const centsToDecimalInput = (cents) => (cents / 100).toFixed(2);

// Integer cents -> number for API responses
const centsToAmount = (cents) => Number((cents / 100).toFixed(2));

module.exports = { toCents, decimalToCents, centsToDecimalInput, centsToAmount };
