// The trip facts the assistant may see, as plain text for ai-features (this API
// builds them because ai-features never reads the database). Titles, dates,
// stops, budget and the safety advisory only - never email, documents or
// other travellers' details.
const { formatTrip } = require('../utils/tripFormat');

const day = (d) => (d ? new Date(d).toISOString().slice(0, 10) : 'not set');

function buildContext(rawTrip, safety) {
  const trip = formatTrip(rawTrip);
  const lines = [
    `Trip: ${trip.title}`,
    `Destination: ${trip.destination || 'not set'}`,
    `Dates: ${day(rawTrip.startDate)} to ${day(rawTrip.endDate)}`,
    `Status: ${rawTrip.status}`,
  ];
  if (trip.budget != null) lines.push(`Budget: ${trip.budget} ${trip.currency || ''}`.trim());
  if (trip.travellers != null) lines.push(`Travellers: ${trip.travellers}`);
  if (trip.interests.length) lines.push(`Interests: ${trip.interests.join(', ')}`);

  const stops = trip.itinerary || [];
  lines.push(stops.length ? 'Itinerary:' : 'Itinerary: no stops added yet');
  for (const s of stops) {
    lines.push(`- Day ${s.dayNumber}${s.startTime ? ` ${s.startTime}` : ''}: ${s.title}${s.location ? ` (${s.location})` : ''}`);
  }

  if (safety) {
    lines.push(`Safety advisory (${safety.source}, updated ${day(safety.lastUpdated)}): level ${safety.advisoryLevel}/4. ${safety.summary || ''}`.trim());
  } else {
    lines.push('Safety advisory: not available');
  }
  return lines.join('\n').slice(0, 8000);
}

module.exports = { buildContext };
