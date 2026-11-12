// Trip dates are stored in UTC. Compare them to the traveller's local
// calendar day so the trip stays in progress for its entire final day.
export function localTripDay(now = new Date()) {
  return Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
}

function storedTripDay(value) {
  if (!value) return NaN;
  const date = new Date(value);
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
}

export function getTripStatus(trip, today = localTripDay()) {
  const status = String(trip.status ?? "").toUpperCase();
  if (status === "CANCELLED") return "Cancelled";
  if (status === "COMPLETED" || storedTripDay(trip.endDate) < today) return "Completed";
  if (status === "ONGOING" || storedTripDay(trip.startDate) <= today) return "Ongoing";
  return "Planning";
}
