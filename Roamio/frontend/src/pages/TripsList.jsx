import { useEffect, useState } from "react";
import { ArrowRight, CalendarDays, MapPin, Plus, Sparkles } from "lucide-react";
import { Link } from "react-router-dom";

import PageShell from "../components/recommendations/PageShell.jsx";
import { fetchTrips } from "../api/trips.js";
import "../styles/trips.css";

function tripDateLabel(trip) {
  if (!trip.startDate) return "Dates not set";
  const format = (iso) => new Date(iso).toLocaleDateString("en", { day: "2-digit", month: "short", year: "numeric" });
  return trip.endDate ? `${format(trip.startDate)} → ${format(trip.endDate)}` : format(trip.startDate);
}

export default function TripsList() {
  const [trips, setTrips] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    fetchTrips()
      .then((data) => active && setTrips(data || []))
      .catch((requestError) => {
        if (active) {
          setError(requestError instanceof Error ? requestError.message : "Could not load your trips.");
        }
      })
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, []);

  const hero = (
    <>
      <p className="recommendations-eyebrow"><Sparkles size={15} /> Your journeys</p>
      <h1>All your trips.</h1>
      <p>Every trip you&apos;ve planned, in one place.</p>
    </>
  );

  return (
    <PageShell hero={hero}>
        <section className="recommendations-results">
          {loading ? (
            <p className="wizard-help">Loading your trips...</p>
          ) : error ? (
            <p className="recommendations-error">{error}</p>
          ) : trips.length === 0 ? (
            <div className="results-empty">
              <h3>No trips yet.</h3>
              <p>Plan your first one and it&apos;ll show up here.</p>
              <Link to="/recommendations" className="recommendations-submit">
                <Plus size={16} /> Create a new trip
              </Link>
            </div>
          ) : (
            <div className="trips-grid">
              {trips.map((trip) => (
                <Link to={`/trips/${trip.id}`} className="trips-grid-card" key={trip.id}>
                  <h3>{trip.title}</h3>
                  <p className="trips-grid-destination">
                    <MapPin size={14} /> {trip.destination || "Destination not set"}
                  </p>
                  <p className="trips-grid-dates">
                    <CalendarDays size={14} /> {tripDateLabel(trip)}
                  </p>
                  <span className="trips-grid-link">
                    View itinerary <ArrowRight size={14} />
                  </span>
                </Link>
              ))}
            </div>
          )}
        </section>
    </PageShell>
  );
}
