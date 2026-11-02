// What the trip assistant may DO, as opposed to say (FR-37). The model only
// asks (a tool call from ai-features); everything is checked and carried out
// here, with the same permissions as the itinerary screen, and the reply the
// traveller reads is written here from what actually happened - the model never
// gets to claim a change.
//
// Two actions exist: add a stop to the itinerary and log an expense. Both are
// additive (nothing here edits or deletes) and both run in two steps: a dry run
// that validates and describes the change (the traveller sees it and confirms),
// then the real run when they do.
const { randomUUID } = require('node:crypto');
const prisma = require('../config/prisma');
const { assertTripAccess } = require('./tripAccessService');
const { itemStartDate, packItemMeta, unpackItemMeta, formatItem } = require('../utils/tripFormat');
const { text } = require('./chatContext');
const expenseService = require('./expenseService');
const { toCents } = require('../utils/money');

const MAX_ITEMS_PER_TRIP = 100;
const MAX_ITEMS_PER_DAY = 12;
const MAX_DAY_WITHOUT_DATES = 30;
const DAY_MS = 86_400_000;

const ymd = (d) => new Date(d).toISOString().slice(0, 10);
const dayCount = (trip) =>
  trip.startDate && trip.endDate ? Math.round((Date.parse(ymd(trip.endDate)) - Date.parse(ymd(trip.startDate))) / DAY_MS) + 1 : null;

// -> { day } or { error } in words the traveller can act on
function resolveDay(trip, { day, date }) {
  const total = dayCount(trip);
  if (date != null && date !== '') {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(date)) || Number.isNaN(Date.parse(date))) return { error: `I couldn't read the date "${text(date, 20)}". Use a day number or a date like 2026-12-02.` };
    if (!trip.startDate) return { error: 'This trip has no dates yet, so tell me a day number instead (Day 1, Day 2...).' };
    const n = Math.round((Date.parse(date) - Date.parse(ymd(trip.startDate))) / DAY_MS) + 1;
    if (n < 1 || (total && n > total)) return { error: `${date} is outside your trip (${ymd(trip.startDate)} to ${trip.endDate ? ymd(trip.endDate) : 'no end date'}).` };
    return { day: n };
  }
  if (day == null || day === '') return { error: 'Which day should I add it to? For example "Day 2".' };
  const n = Number(day);
  if (!Number.isInteger(n) || n < 1) return { error: `"${text(day, 20)}" isn't a day number. Use Day 1, Day 2...` };
  if (total ? n > total : n > MAX_DAY_WITHOUT_DATES) {
    return { error: total ? `Your trip is ${total} day${total === 1 ? '' : 's'} long, so there is no Day ${n}.` : `Day ${n} is too far out. Use a day up to ${MAX_DAY_WITHOUT_DATES}.` };
  }
  return { day: n };
}

// -> { time: "HH:MM" | null } or { error }
function resolveTime(value) {
  if (value == null || value === '') return { time: null };
  const m = /^([01]?\d|2[0-3]):([0-5]\d)$/.exec(String(value).trim());
  return m ? { time: `${m[1].padStart(2, '0')}:${m[2]}` } : { error: `I couldn't read the time "${text(value, 20)}". Use a time like 14:00.` };
}

// trip: the Prisma trip chat.js loaded (itineraries included)
// near: "Durban, South Africa", where to look for the place
// searchPlace({ text, near, lat, lon }) -> ai-features' answer ({ found, ... }) or null when it could not be asked
// dryRun: validate only -> { proposal: { name, args, summary } }, or { reply } saying why not
// -> { reply, item }  (item is null when nothing was added)
async function addItineraryItem({ userId, trip, near, args, searchPlace, dryRun = false }) {
  const title = text(args.title, 80);
  if (!title) return { reply: 'What should I add? Tell me the place or activity.', item: null };

  const { day, error: dayError } = resolveDay(trip, args);
  if (dayError) return { reply: dayError, item: null };
  const { time, error: timeError } = resolveTime(args.time);
  if (timeError) return { reply: timeError, item: null };

  try {
    await assertTripAccess(trip.id, userId, { write: true });
  } catch (error) {
    if (error.statusCode === 403) return { reply: "You have view-only access to this trip, so I can't change its itinerary.", item: null };
    throw error;
  }

  const stops = trip.itineraries;
  if (stops.length >= MAX_ITEMS_PER_TRIP) return { reply: `This trip already has ${MAX_ITEMS_PER_TRIP} stops, which is the most I can add to.`, item: null };
  const sameDay = stops.filter((s) => s.dayNumber === day);
  if (sameDay.length >= MAX_ITEMS_PER_DAY) return { reply: `Day ${day} already has ${MAX_ITEMS_PER_DAY} stops. Try another day.`, item: null };
  if (sameDay.some((s) => s.title.trim().toLowerCase() === title.toLowerCase())) {
    return { reply: `"${title}" is already on Day ${day}.`, item: null };
  }

  if (dryRun) {
    const notes = args.notes ? text(args.notes, 200) : undefined;
    return {
      proposal: { name: 'add_itinerary_item', args: { title, day, time, notes }, summary: `Add "${title}" to Day ${day}${time ? ` at ${time}` : ''}` },
    };
  }

  // look near the trip's existing stops when there are any, else near the city
  const anchor = stops.map((s) => unpackItemMeta(s.description)).find((m) => m.lat != null && m.lon != null);
  const place = await searchPlace({ text: title, near, lat: anchor?.lat, lon: anchor?.lon });
  const found = place?.found === true;

  const created = await prisma.itineraryItem.create({
    data: {
      id: randomUUID(),
      tripId: trip.id,
      title,
      location: found ? place.address || place.name : null,
      description: packItemMeta({ notes: args.notes ? text(args.notes, 200) : null, lat: found ? place.lat : null, lon: found ? place.lon : null }),
      dayNumber: day,
      startTime: itemStartDate(trip.startDate, day, time),
    },
  });

  const when = `Day ${day}${time ? ` at ${time}` : ''}`;
  let reply;
  if (found) reply = `Added "${title}" to ${when}. Location: ${place.address || place.name}.`;
  else if (place) reply = `Added "${title}" to ${when}, but I couldn't find that place near ${near}, so it has no location or map pin.`;
  else reply = `Added "${title}" to ${when}, but I couldn't check its location right now, so it has no map pin.`;
  return { reply, item: formatItem(created) };
}

const money = (cents, currency) =>
  `${(cents / 100).toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}${currency ? ` ${currency}` : ''}`;

// Logs an expense the traveller paid, split equally, through the same service as the budget screen.
// -> { reply, expense } or, for a dry run, { proposal } / { reply }
async function logExpense({ userId, trip, args, dryRun = false }) {
  const title = text(args.title, 80);
  if (!title) return { reply: 'What was the expense for? Tell me what you paid for.', expense: null };
  const cents = toCents(args.amount);
  if (!cents) return { reply: `I couldn't read the amount "${text(args.amount, 20)}". Use a number like 180 or 180.50.`, expense: null };
  const category = String(args.category || '').toUpperCase();
  if (!expenseService.CATEGORIES.includes(category)) {
    return { reply: `Which category is it? Pick one of: ${expenseService.CATEGORIES.map((c) => c.toLowerCase()).join(', ')}.`, expense: null };
  }
  let currency;
  if (args.currency) {
    try {
      currency = expenseService.parseCurrency(args.currency);
    } catch {
      return { reply: `"${text(args.currency, 10)}" isn't a currency code. Use something like ZAR or USD.`, expense: null };
    }
  }

  try {
    await assertTripAccess(trip.id, userId, { write: true });
  } catch (error) {
    if (error.statusCode === 403) return { reply: "You have view-only access to this trip, so I can't log expenses.", expense: null };
    throw error;
  }
  if (dryRun) {
    return {
      proposal: {
        name: 'log_expense',
        args: { title, amount: (cents / 100).toFixed(2), category, currency },
        summary: `Log ${money(cents, currency || trip.budget?.currency)} for "${title}" (${category.toLowerCase()}), paid by you and split equally`,
      },
    };
  }

  let result;
  try {
    result = await expenseService.createExpense(trip.id, userId, { title, amount: (cents / 100).toFixed(2), category, currency });
  } catch (error) {
    if (error.statusCode >= 400 && error.statusCode < 500) return { reply: `I couldn't log that: ${error.message}.`, expense: null };
    throw error;
  }
  const warning = (result.warnings || []).find((w) => typeof w === 'string');
  return {
    reply: `Logged ${money(cents, result.expense.currency)} for "${title}" (${category.toLowerCase()}).${warning ? ` Heads up: ${warning}.` : ''}`,
    expense: result.expense,
  };
}

module.exports = { addItineraryItem, logExpense, resolveDay, resolveTime };
