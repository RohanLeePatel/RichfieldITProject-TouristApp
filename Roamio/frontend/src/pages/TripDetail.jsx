import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, CalendarDays, LoaderCircle, MapPin, Plane, Sparkles, Trash2, X } from "lucide-react";
import { Link, useNavigate, useParams } from "react-router-dom";

import { fetchTrip, deleteTrip, removeItineraryItem } from "../api/trips.js";
import { groupItineraryByDay } from "../utils/itineraryPlanner.js";
import "../styles/recommendations.css";
import "../styles/trips.css";

function formatDate(iso) {
  return new Date(iso).toLocaleDateString("en", { day: "2-digit", month: "long", year: "numeric" });
}

export default function TripDetail() {
  const { tripId } = useParams();
  const navigate = useNavigate();
  const [trip, setTrip] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const load = () => {
    setLoading(true);
    setError("");
    fetchTrip(tripId)
      .then(setTrip)
      .catch((requestError) => {
        setError(requestError instanceof Error ? requestError.message : "Could not load this trip.");
      })
      .finally(() => setLoading(false));
  };

  useEffect(load, [tripId]);

  const dayGroups = useMemo(() => groupItineraryByDay(trip?.itinerary), [trip]);

  const handleDeleteItem = async (itemId) => {
    setBusy(true);
    try {
      await removeItineraryItem(tripId, itemId);
      load();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Could not remove that stop.");
      setBusy(false);
    }
  };

  const handleDeleteTrip = async () => {
    setBusy(true);
    try {
      await deleteTrip(tripId);
      navigate("/trips");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Could not delete this trip.");
      setBusy(false);
    }
  };

  return (
    <main className="recommendations-page">
      <header className="recommendations-header">
        <Link to="/trips" className="recommendations-back-link">
          <ArrowLeft size={17} /> Back to your trips
        </Link>
        <div className="recommendations-brand">
          <span><Plane size={18} /></span> Roamio
        </div>
      </header>

      <div className="recommendations-content">
        {loading ? (
          <p className="wizard-help"><LoaderCircle className="recommendations-spinner" size={16} /> Loading trip...</p>
        ) : error && !trip ? (
          <p className="recommendations-error">{error}</p>
        ) : trip ? (
          <>
            <section className="recommendations-intro">
              <p className="recommendations-eyebrow">
                <Sparkles size={15} /> Trip itinerary
              </p>
              <h1>{trip.title}</h1>
              <p>
                <MapPin size={14} /> {trip.destination || "Destination not set"}
                {trip.startDate && (
                  <>
                    {" "}· <CalendarDays size={14} /> {formatDate(trip.startDate)}
                    {trip.endDate ? ` → ${formatDate(trip.endDate)}` : ""}
                  </>
                )}
              </p>
            </section>

            <section className="recommendations-results">
              <div className="results-heading">
                <div>
                  <h2>Day-by-day plan</h2>
                  <p>{trip.itinerary?.length || 0} stop{trip.itinerary?.length === 1 ? "" : "s"} saved to this trip.</p>
                </div>
                <button type="button" className="secondary-button" onClick={handleDeleteTrip} disabled={busy}>
                  <Trash2 size={15} /> Delete trip
                </button>
              </div>

              {error && <p className="recommendations-error">{error}</p>}

              {dayGroups.length === 0 ? (
                <div className="results-empty">
                  <h3>No stops yet.</h3>
                  <p>Landmarks you add to this trip&apos;s itinerary will show up here, grouped by day.</p>
                </div>
              ) : (
                <div className="itinerary-days">
                  {dayGroups.map((group) => (
                    <div key={group.dayNumber ?? "unscheduled"} className="itinerary-day">
                      <h4 className="interest-group-label">
                        {group.dayNumber ? `Day ${group.dayNumber}` : "Unscheduled"}
                      </h4>
                      {group.items.map((item) => (
                        <div key={item.id} className="itinerary-stop">
                          {item.startTime && <span className="itinerary-stop-time">{item.startTime}</span>}
                          <span className="itinerary-stop-name">
                            {item.title}
                            {item.location && <small className="itinerary-stop-location">{item.location}</small>}
                          </span>
                          <button
                            type="button"
                            className="itinerary-stop-remove"
                            onClick={() => handleDeleteItem(item.id)}
                            disabled={busy}
                            aria-label={`Remove ${item.title}`}
                          >
                            <X size={14} />
                          </button>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              )}
            </section>
          </>
        ) : null}
      </div>
    </main>
  );
}
