import { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  CalendarDays,
  MapPin,
  Plus,
  Sparkles,
  CheckCircle2,
} from "lucide-react";
import { Link, useSearchParams } from "react-router-dom";

import PageShell from "../components/recommendations/PageShell.jsx";
import { fetchTrips } from "../api/trips.js";
import "../styles/trips.css";

function tripDateLabel(trip) {
  if (!trip.startDate) return "Dates not set";

  const format = (iso) =>
    new Date(iso).toLocaleDateString("en", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });

  return trip.endDate
    ? `${format(trip.startDate)} → ${format(trip.endDate)}`
    : format(trip.startDate);
}

function isTripCompleted(trip) {
  if (String(trip.status || "").toLowerCase() === "completed") {
    return true;
  }

  if (!trip.endDate) {
    return false;
  }

  const endDate = new Date(trip.endDate);

  if (Number.isNaN(endDate.getTime())) {
    return false;
  }

  return new Date() > endDate;
}

export default function TripsList() {
  const [trips, setTrips] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [searchParams] = useSearchParams();
  const statusFilter = searchParams.get("status");

  useEffect(() => {
    let active = true;

    fetchTrips()
      .then((data) => {
        if (active) {
          setTrips(Array.isArray(data) ? data : []);
        }
      })
      .catch((requestError) => {
        if (active) {
          setError(
            requestError instanceof Error
              ? requestError.message
              : "Could not load your trips."
          );
        }
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, []);

  const filteredTrips = useMemo(() => {
    if (statusFilter !== "completed") {
      return trips;
    }

    return trips.filter(isTripCompleted);
  }, [trips, statusFilter]);

  const showingCompleted = statusFilter === "completed";

  const hero = (
    <>
      <p className="recommendations-eyebrow">
        {showingCompleted ? (
          <CheckCircle2 size={15} />
        ) : (
          <Sparkles size={15} />
        )}
        {showingCompleted ? "Completed journeys" : "Your journeys"}
      </p>

      <h1>
        {showingCompleted ? "Trips you&apos;ve completed." : "All your trips."}
      </h1>

      <p>
        {showingCompleted
          ? "Every trip you've finished, all in one place."
          : "Every trip you've planned, in one place."}
      </p>
    </>
  );

  return (
    <PageShell hero={hero}>
      <section className="recommendations-results">
        {loading ? (
          <p className="wizard-help">Loading your trips...</p>
        ) : error ? (
          <p className="recommendations-error">{error}</p>
        ) : filteredTrips.length === 0 ? (
          <div className="results-empty">
            <h3>
              {showingCompleted
                ? "No completed trips yet."
                : "No trips yet."}
            </h3>

            <p>
              {showingCompleted
                ? "Once you finish a trip, it will appear here."
                : "Plan your first one and it'll show up here."}
            </p>

            {!showingCompleted && (
              <Link
                to="/recommendations"
                className="recommendations-submit"
              >
                <Plus size={16} /> Create a new trip
              </Link>
            )}

            {showingCompleted && (
              <Link to="/trips" className="recommendations-submit">
                View all trips
              </Link>
            )}
          </div>
        ) : (
          <div className="trips-grid">
            {filteredTrips.map((trip) => (
              <Link
                to={`/trips/${trip.id}`}
                className="trips-grid-card"
                key={trip.id}
              >
                <div className="trips-grid-card-header">
                  <h3>{trip.title}</h3>

                  {isTripCompleted(trip) && (
                    <span className="trips-completed-badge">
                      <CheckCircle2 size={14} />
                      Completed
                    </span>
                  )}
                </div>

                <p className="trips-grid-destination">
                  <MapPin size={14} />
                  {trip.destination || "Destination not set"}
                </p>

                <p className="trips-grid-dates">
                  <CalendarDays size={14} />
                  {tripDateLabel(trip)}
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