import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Clock, MapPin, Navigation } from "lucide-react";

import { fetchTrip } from "../../api/trips.js";

const DAY_MS = 86_400_000;

// While a trip is under way: the next stop on today's plan, with a directions link.
// Shows nothing before the trip starts, after it ends, or when today has no stops left.
export default function NextStop({ trip }) {
  const [itinerary, setItinerary] = useState(null);

  useEffect(() => {
    setItinerary(null);
    if (!trip?.startDate) return;
    fetchTrip(trip.id)
      .then((full) => setItinerary(full.itinerary || []))
      .catch(() => {});
  }, [trip?.id, trip?.startDate]);

  if (!trip?.startDate || !itinerary) return null;
  // dates are stored as UTC midnight, so compare against today's date in UTC terms
  const now = new Date();
  const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  const start = new Date(trip.startDate).getTime();
  const dayNumber = Math.floor((today - start) / DAY_MS) + 1;
  const end = trip.endDate ? new Date(trip.endDate).getTime() : start;
  if (dayNumber < 1 || today > end) return null;

  const clock = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
  const stop = itinerary
    .filter((item) => item.dayNumber === dayNumber && (!item.startTime || item.startTime >= clock))
    .sort((a, b) => (a.startTime || "99:99").localeCompare(b.startTime || "99:99"))[0];
  if (!stop) return null;

  const hasCoords = Number.isFinite(stop.lat) && Number.isFinite(stop.lon);
  return (
    <section className="dashboard-card" aria-label="Next stop">
      <div className="card-heading">
        <h2>Next up · day {dayNumber}</h2>
        <Link to={`/trips/${trip.id}`} className="view-all">Full itinerary</Link>
      </div>
      <p style={{ margin: "0 0 4px", fontWeight: 600, fontSize: 18 }}>{stop.title}</p>
      <p style={{ margin: 0, display: "flex", flexWrap: "wrap", gap: 12, alignItems: "center" }}>
        {stop.startTime && <span><Clock size={14} /> {stop.startTime}</span>}
        {stop.location && <span><MapPin size={14} /> {stop.location}</span>}
        {hasCoords && (
          <a href={`https://www.google.com/maps/dir/?api=1&destination=${stop.lat},${stop.lon}`} target="_blank" rel="noopener noreferrer">
            <Navigation size={14} /> Directions
          </a>
        )}
      </p>
    </section>
  );
}
