// The trip facts the assistant may see, as plain text for ai-features (this API
// builds them because ai-features never reads the database).
//
// What is deliberately NOT here: e-mail addresses, other travellers' and
// companions' names, who paid for what, document names or contents, tokens.
// Other people appear only as counts, roles and (for companions) age and
// interests. Free text a traveller typed (titles, notes) is flattened to one
// line and length-capped so it cannot pose as a new section of facts.
// ai-features scrubs the whole block again before it leaves for the model.
const { formatTrip } = require('../utils/tripFormat');
const { unpackGroupMeta } = require('../utils/groupMeta');
const { decimalToCents } = require('../utils/money');
const { expenseTotals } = require('../utils/expenseTotals');

const MAX_CONTEXT = 8000;
const RECENT_EXPENSES = 10;

const day = (d) => (d ? new Date(d).toISOString().slice(0, 10) : 'not set');

// one line, no angle brackets, capped
const text = (value, max = 120) =>
  String(value ?? '').replace(/[<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, max);

const money = (cents, currency) =>
  `${(cents / 100).toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currency}`;

function budgetLines(trip) {
  const budget = trip.budget;
  if (!budget) return ['Budget: none set'];
  const currency = budget.currency;
  const totals = expenseTotals(trip.expenses || []);
  const limit = decimalToCents(budget.totalAmount);
  const lines = [
    `Budget: ${money(limit, currency)}; spent ${money(totals.totalCents, currency)} on ${totals.count} expense(s)` +
      (limit > 0 ? `; ${money(limit - totals.totalCents, currency)} left (${Math.round((totals.totalCents / limit) * 100)}% used)` : ''),
  ];
  for (const { category, limitAmount } of budget.categoryLimits || []) {
    const spent = totals.byCategory.get(category)?.cents || 0;
    lines.push(`- ${category} limit ${money(decimalToCents(limitAmount), currency)}, spent ${money(spent, currency)}`);
  }
  const recent = [...(trip.expenses || [])]
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .slice(0, RECENT_EXPENSES);
  if (recent.length) {
    lines.push('Recent expenses:');
    for (const e of recent) {
      lines.push(`- ${day(e.date)} ${text(e.title, 60)} (${e.category}): ${e.amount.toString()} ${e.currency}`);
    }
  }
  return lines;
}

function peopleLines(trip, userId) {
  const mine = (trip.members || []).find((m) => m.userId === userId);
  const { companions } = unpackGroupMeta(trip.travelGroup?.description);
  const lines = [`Your role on this trip: ${mine?.role || 'group member'}`];
  lines.push(`Travellers with an account: ${(trip.members || []).length}`);
  if (companions.length) {
    lines.push(`Companions without an account: ${companions.length}`);
    companions.forEach((c, i) => {
      const interests = (c.interests || []).slice(0, 10).map((t) => text(t, 30)).join(', ');
      lines.push(`- Companion ${i + 1}: ${c.type === 'Child' ? `child${c.age != null ? ` aged ${c.age}` : ''}` : 'adult'}${interests ? `, interests: ${interests}` : ''}`);
    });
  }
  return lines;
}

function documentLines(trip) {
  const docs = trip.documents || [];
  if (!docs.length) return ['Documents: none uploaded'];
  const kinds = {};
  for (const d of docs) kinds[d.kind] = (kinds[d.kind] || 0) + 1;
  return [`Documents uploaded: ${docs.length} (${Object.entries(kinds).map(([k, n]) => `${k} ${n}`).join(', ')}); contents are not available to you`];
}

const num = (n, unit = '') => (n == null ? null : `${Math.round(n * 10) / 10}${unit}`);

// weather: ai-features' /weather answer (current + a few forecast days), or null.
// The model is given the numbers and writes any advice from them.
function weatherLines(weather) {
  if (!weather?.current && !weather?.forecast?.length) return ['Weather: not available right now'];
  const c = weather.current || {};
  const parts = [c.description && text(c.description, 60), num(c.temp, '°C'), num(c.feels_like, '°C') && `feels like ${num(c.feels_like, '°C')}`,
    c.humidity != null && `humidity ${c.humidity}%`, num(c.wind_speed, ' m/s') && `wind ${num(c.wind_speed, ' m/s')}`].filter(Boolean);
  const lines = [`Weather in ${text(weather.city, 60)} now (updated ${day(weather.fetched_at)}${weather.stale ? ', may be out of date' : ''}): ${parts.join(', ')}`];
  if (weather.forecast?.length) {
    lines.push('Forecast (only the next few days; a trip further away has no forecast yet):');
    for (const f of weather.forecast.slice(0, 6)) {
      const bits = [f.description && text(f.description, 60), num(f.temp, '°C'),
        f.precipitation_chance != null && `rain chance ${f.precipitation_chance}%`, num(f.precipitation_mm, ' mm rain'), num(f.wind_speed, ' m/s wind')].filter(Boolean);
      lines.push(`- ${text(f.date, 10)}: ${bits.join(', ')}`);
    }
  }
  return lines;
}

function safetyLines(advisories, alerts) {
  const lines = [];
  for (const { country, safety } of advisories) {
    lines.push(
      safety
        ? `Safety advisory for ${text(country, 60)} (${safety.source}, updated ${day(safety.lastUpdated)}): level ${safety.advisoryLevel}/4. ${text(safety.summary, 300)}`.trim()
        : `Safety advisory for ${text(country, 60)}: not available`,
    );
  }
  if (!lines.length) lines.push('Safety advisory: not available');
  for (const a of alerts || []) lines.push(`Active alert (level ${a.riskLevel}): ${text(a.message, 200)}`);
  return lines;
}

// trip: the Prisma trip with the relations chat.js includes
// advisories: [{ country, safety }] - one per destination country
function buildContext(trip, { advisories = [], weather = null, userId, today = new Date() } = {}) {
  const formatted = formatTrip(trip);
  const countries = [...new Set(advisories.map((a) => a.country))];
  const lines = [
    `Today: ${day(today)}`,
    `Trip: ${text(formatted.title, 80)}`,
    `Destination: ${text(formatted.destination || 'not set', 80)}${countries.length ? ` (${countries.map((c) => text(c, 60)).join(', ')})` : ''}`,
    `Dates: ${day(trip.startDate)} to ${day(trip.endDate)}`,
    `Status: ${trip.status}`,
    ...peopleLines(trip, userId),
  ];
  if (formatted.travellers != null) lines.push(`Planned travellers: ${formatted.travellers}`);
  if (formatted.interests.length) lines.push(`Trip interests: ${formatted.interests.slice(0, 15).map((t) => text(t, 30)).join(', ')}`);
  if (formatted.notes) lines.push(`Trip notes: ${text(formatted.notes, 300)}`);

  lines.push(...budgetLines(trip));
  lines.push(...documentLines(trip));
  lines.push(...weatherLines(weather));
  lines.push(...safetyLines(advisories, trip.safetyAlerts)); // before the itinerary: it is the long part that gets cut

  const stops = formatted.itinerary || [];
  lines.push(stops.length ? 'Itinerary:' : 'Itinerary: no stops added yet');
  for (const s of stops) {
    lines.push(
      `- Day ${s.dayNumber}${s.startTime ? ` ${s.startTime}` : ''}: ${text(s.title, 80)}` +
        `${s.location ? ` (${text(s.location, 80)})` : ''}${s.notes ? ` - ${text(s.notes, 120)}` : ''}`,
    );
  }

  return lines.join('\n').slice(0, MAX_CONTEXT);
}

module.exports = { buildContext, text };
