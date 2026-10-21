import { useEffect, useMemo, useState } from "react";
import { CalendarDays, CloudSun, Languages, LoaderCircle, MapPin, Printer, Sparkles, Trash2, Wallet, X } from "lucide-react";
import { Link, useNavigate, useParams } from "react-router-dom";

import ClimateInsights from "../components/insights/ClimateInsights.jsx";
import ItineraryMap from "../components/recommendations/ItineraryMap.jsx";
import PageShell from "../components/recommendations/PageShell.jsx";
import TripDocuments from "../components/trips/TripDocuments.jsx";
import { AddLandmark, TripBudgetCard, TripPeople, TripSnapshot } from "../components/trips/TripHub.jsx";
import useActiveTrip from "../hooks/useActiveTrip.js";

import { fetchTrip, deleteTrip, removeItineraryItem } from "../api/trips.js";
import { groupItineraryByDay } from "../utils/itineraryPlanner.js";
import { useTripStore } from "../store/tripStore.js";
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
  const { setActiveTrip } = useActiveTrip();

  useEffect(() => {
    setActiveTrip(tripId);
  }, [tripId, setActiveTrip]);

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

  const refresh = () => fetchTrip(tripId).then(setTrip).catch(() => {});

  const dayGroups = useMemo(() => groupItineraryByDay(trip?.itinerary), [trip]);

  // ItineraryMap was built for the wizard, where a stop carries its whole
  // landmark object. A saved stop only has the coordinates that came back from
  // the API, so reshape rather than duplicate the map component.
  const mapDays = useMemo(
    () =>
      dayGroups
        .filter((group) => group.dayNumber)
        .map((group) => ({
          dayNumber: group.dayNumber,
          stops: group.items
            .filter((item) => Number.isFinite(item.lat) && Number.isFinite(item.lon))
            .map((item) => ({
              startTime: item.startTime,
              landmark: { name: item.title, lat: item.lat, lon: item.lon },
            })),
        }))
        .filter((group) => group.stops.length > 0),
    [dayGroups]
  );

  const handleDeleteItem = async (itemId, title) => {
    if (!window.confirm(`Remove ${title} from this trip?`)) return;
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
    if (!window.confirm(`Delete ${trip.title}? Its itinerary and documents go with it.`)) return;
    setBusy(true);
    try {
      await deleteTrip(tripId);
      useTripStore.getState().load(true);
      navigate("/trips");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Could not delete this trip.");
      setBusy(false);
    }
  };

  const hero = trip ? (
    <>
      <p className="recommendations-eyebrow"><Sparkles size={15} /> Trip itinerary</p>
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
      {/* the same trip, carried into each tool - no retyping */}
      <p className="trip-hub-tools print-hide">
        <Link to={`/weather?trip=${trip.id}`}><CloudSun size={14} /> Weather</Link>
        <Link to={`/translator?trip=${trip.id}`}><Languages size={14} /> Translator</Link>
        <Link to="/calendar"><CalendarDays size={14} /> Calendar</Link>
        <Link to={`/trips/${trip.id}/budget`}><Wallet size={14} /> Budget</Link>
      </p>
    </>
  ) : null;

  return (
    <PageShell backTo="/trips" backLabel="Back to your trips" hero={hero}>
        {loading ? (
          <p className="wizard-help"><LoaderCircle className="recommendations-spinner" size={16} /> Loading trip...</p>
        ) : error && !trip ? (
          <p className="recommendations-error">{error}</p>
        ) : trip ? (
          <>
            <section className="recommendations-results">
              <div className="results-heading">
                <div>
                  <h2>Day-by-day plan</h2>
                  <p>{trip.itinerary?.length || 0} stop{trip.itinerary?.length === 1 ? "" : "s"} saved to this trip.</p>
                </div>
                <div className="print-hide trip-detail-actions">
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={() => window.print()}
                    title="Opens your browser's print dialog - choose 'Save as PDF' as the destination to download it"
                  >
                    <Printer size={15} /> Download as PDF
                  </button>
                  <button type="button" className="secondary-button" onClick={handleDeleteTrip} disabled={busy}>
                    <Trash2 size={15} /> Delete trip
                  </button>
                </div>
              </div>
              <p className="print-hide wizard-help">
                Pick &quot;Save as PDF&quot; as the destination in the print dialog that opens.
              </p>

              {error && <p className="recommendations-error">{error}</p>}

              {dayGroups.length === 0 ? (
                <div className="results-empty">
                  <h3>No stops yet.</h3>
                  <p>Landmarks you add to this trip&apos;s itinerary will show up here, grouped by day.</p>
                </div>
              ) : (
                <div className="itinerary-days itinerary-days-stacked">
                  {dayGroups.map((group) => (
                    <div key={group.dayNumber ?? "unscheduled"} className="itinerary-day">
                      <div className="itinerary-day-header">
                        <h4>{group.dayNumber ? `Day ${group.dayNumber}` : "Unscheduled"}</h4>
                      </div>
                      {group.items.map((item) => (
                        <div key={item.id} className="itinerary-stop">
                          {item.startTime && <span className="itinerary-stop-time">{item.startTime}</span>}
                          <span className="itinerary-stop-name">
                            {item.title}
                            {item.location && <small className="itinerary-stop-location">{item.location}</small>}
                          </span>
                          <button
                            type="button"
                            className="itinerary-stop-remove print-hide"
                            onClick={() => handleDeleteItem(item.id, item.title)}
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

            <AddLandmark trip={trip} onAdded={refresh} />

            {trip.destination && (
              <section className="recommendations-results">
                <div className="results-heading">
                  <div>
                    <h2>Right now</h2>
                    <p>Live weather and the current travel advisory for {trip.destination}.</p>
                  </div>
                </div>
                <TripSnapshot trip={trip} />
              </section>
            )}

            <section className="recommendations-results">
              <div className="results-heading">
                <div>
                  <h2>Money</h2>
                  <p>What's been spent, in the trip's currency.</p>
                </div>
              </div>
              <div className="insights trip-hub-grid">
                <TripBudgetCard trip={trip} />
              </div>
            </section>

            <section className="recommendations-results">
              <div className="results-heading">
                <div>
                  <h2>Travelling together</h2>
                  <p>Everyone on this trip, and what's changed lately.</p>
                </div>
              </div>
              <TripPeople trip={trip} />
            </section>

            {mapDays.length > 0 && (
              <section className="recommendations-results trip-map-section">
                <div className="results-heading">
                  <div>
                    <h2>On the map</h2>
                    <p>Every stop with a known location, numbered in visiting order.</p>
                  </div>
                </div>
                <ItineraryMap itineraryDays={mapDays} />
              </section>
            )}

            <TripDocuments tripId={tripId} />

            {trip.destination && (
              <section className="recommendations-results trip-insights">
                <div className="results-heading">
                  <div>
                    <h2>Know before you go</h2>
                    <p>Typical weather, packing advice and the best time to visit {trip.destination.split(",")[0]}.</p>
                  </div>
                </div>
                <ClimateInsights
                  name={trip.destination.split(",")[0].trim()}
                  country={trip.destination.split(",").slice(1).join(",").trim() || undefined}
                  month={trip.startDate ? new Date(trip.startDate).getUTCMonth() + 1 : undefined}
                />
              </section>
            )}
          </>
        ) : null}
    </PageShell>
  );
}
