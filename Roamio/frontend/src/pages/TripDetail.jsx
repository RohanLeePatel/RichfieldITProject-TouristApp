import { showToast } from "../store/toastStore.js";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowDown, ArrowUp, CalendarDays, CloudSun, FileText, Languages, ListOrdered, LoaderCircle, MapPin, Pencil, Printer, ShieldCheck, Sparkles, Trash2, Users, Wallet, X,
} from "lucide-react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";

import ClimateInsights from "../components/insights/ClimateInsights.jsx";
import AskButton from "../components/chat/AskButton.jsx";
import ItineraryMap from "../components/recommendations/ItineraryMap.jsx";
import Hint from "../components/onboarding/Hint.jsx";
import PageShell from "../components/recommendations/PageShell.jsx";
import PlaceFeedback from "../components/trips/PlaceFeedback.jsx";
import TripDocuments from "../components/trips/TripDocuments.jsx";
import TripEditForm from "../components/trips/TripEditForm.jsx";
import TripBudget from "./TripBudget.jsx";
import { AddLandmark, TripPeople, TripSnapshot } from "../components/trips/TripHub.jsx";
import useActiveTrip from "../hooks/useActiveTrip.js";

import { fetchTrip, addItineraryItem, deleteTrip, restoreTrip, removeItineraryItem, reorderItinerary } from "../api/trips.js";
import { groupItineraryByDay } from "../utils/itineraryPlanner.js";
import { formatDate } from "../utils/format.js";
import { useTripStore } from "../store/tripStore.js";
import "../styles/trips.css";

const DAY_MS = 24 * 60 * 60 * 1000;

// one section of the trip at a time; ?tab= keeps it across refreshes and links
const TABS = [
  { id: "plan", label: "Itinerary", icon: ListOrdered },
  { id: "safety", label: "Safety & weather", icon: ShieldCheck },
  { id: "money", label: "Budget", icon: Wallet },
  { id: "people", label: "People", icon: Users },
  { id: "documents", label: "Documents", icon: FileText },
];


// the month most of the trip falls in (its middle day), so a trip that starts
// on 31 Oct and runs into November reads as November
function tripMonth(trip) {
  if (!trip.startDate) return undefined;
  const start = new Date(trip.startDate).getTime();
  const end = trip.endDate ? new Date(trip.endDate).getTime() : start;
  return new Date((start + end) / 2).getUTCMonth() + 1;
}

export default function TripDetail() {
  const { tripId } = useParams();
  const navigate = useNavigate();
  const [trip, setTrip] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(false);
  const { setActiveTrip } = useActiveTrip();
  const [params, setParams] = useSearchParams();
  const tab = TABS.some((t) => t.id === params.get("tab")) ? params.get("tab") : "plan";

  useEffect(() => {
    setActiveTrip(tripId);
  }, [tripId, setActiveTrip]);

  // Full load: shows the loading state. Use refresh() to update in place instead.
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

  // Quiet reload after a small change, such as a reordered stop. The page stays on
  // screen, and a failed reload keeps the data already shown.
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
    const stop = trip.itinerary.find((item) => item.id === itemId);
    setBusy(true);
    try {
      await removeItineraryItem(tripId, itemId);
      if (stop) {
        const { location, dayNumber, startTime, lat, lon } = stop;
        showToast(`Removed ${title}.`, {
          label: "Undo",
          run: () =>
            addItineraryItem(tripId, { title, location, dayNumber, startTime, lat, lon })
              .then(refresh)
              .catch((e) => showToast(e.message || "Could not restore that stop.")),
        });
      }
      load();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Could not remove that stop.");
      setBusy(false);
    }
  };

  // Day numbers a stop can move to: the trip's length, else up to the last day in use
  const dayCount = useMemo(() => {
    const used = Math.max(1, ...dayGroups.map((group) => group.dayNumber || 0));
    if (!trip?.startDate || !trip?.endDate) return Math.min(30, used);
    const length = Math.round((new Date(trip.endDate) - new Date(trip.startDate)) / DAY_MS) + 1;
    return Math.min(30, Math.max(length, used));
  }, [trip, dayGroups]);

  // Moves a stop up or down within its day, or to another day (it joins the end
  // of that day). The server hands each day's time slots out in the new order.
  const moveStop = async (itemId, fromDay, { direction, toDay }) => {
    const ids = (day) => dayGroups.find((group) => group.dayNumber === day)?.items.map((item) => item.id) || [];
    const days = [];
    if (toDay && toDay !== fromDay) {
      days.push({ dayNumber: fromDay, itemIds: ids(fromDay).filter((id) => id !== itemId) });
      days.push({ dayNumber: toDay, itemIds: [...ids(toDay), itemId] });
    } else {
      const list = ids(fromDay);
      const from = list.indexOf(itemId);
      const to = from + direction;
      if (to < 0 || to >= list.length) return;
      [list[from], list[to]] = [list[to], list[from]];
      days.push({ dayNumber: fromDay, itemIds: list });
    }
    setBusy(true);
    setError("");
    try {
      await reorderItinerary(tripId, days);
      await refresh();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Could not move that stop.");
    }
    setBusy(false);
  };

  const handleDeleteTrip = async () => {
    setBusy(true);
    try {
      await deleteTrip(tripId);
      useTripStore.getState().load(true);
      // deleted trips stay restorable for 30 days, so undo beats a confirm dialog
      const { title, id } = trip;
      showToast(`Deleted ${title}.`, {
        label: "Undo",
        run: () =>
          restoreTrip(id)
            .then(() => useTripStore.getState().load(true))
            .then(() => showToast(`Restored ${title}.`))
            .catch((e) => showToast(e.message || "Could not restore that trip.")),
      });
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

  // The calendar date of day N, when the trip has dates: "Mon 16 Dec". It is formatted
  // in UTC to match how the start date was stored, so a viewer's timezone can't shift it by a day.
  // Days in the trip's dates, so a day numbered past them can be called out
  const tripLength =
    trip?.startDate && trip?.endDate
      ? Math.round((new Date(trip.endDate) - new Date(trip.startDate)) / DAY_MS) + 1
      : null;

  const dayDate = (dayNumber) =>
    trip?.startDate && dayNumber
      ? new Date(new Date(trip.startDate).getTime() + (dayNumber - 1) * DAY_MS)
          .toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" })
      : null;

  return (
    <PageShell backTo="/trips" backLabel="Back to your trips" hero={hero}>
        {loading ? (
          <p className="wizard-help"><LoaderCircle className="recommendations-spinner" size={16} /> Loading trip...</p>
        ) : error && !trip ? (
          <p className="recommendations-error">{error}</p>
        ) : trip ? (
          <>
            <nav className="trip-tabs print-hide" role="tablist" aria-label="Trip sections">
              {TABS.map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  type="button"
                  role="tab"
                  aria-selected={tab === id}
                  className={tab === id ? "active" : ""}
                  onClick={() => setParams({ tab: id }, { replace: true })}
                >
                  <Icon size={15} /> {label}
                </button>
              ))}
            </nav>

            <div className="trip-panel" role="tabpanel">

            {tab === "plan" && (
            <>
            <Hint id="trip-tabs">
              Everything for this trip is in the tabs above: the plan, safety and weather, budget, the people on it and your booking documents.
            </Hint>
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
                    <Printer size={15} /> Print or save as PDF
                  </button>
                  <button type="button" className="secondary-button" onClick={() => setEditing((open) => !open)} disabled={busy}>
                    <Pencil size={15} /> Edit trip
                  </button>
                  <button type="button" className="secondary-button" onClick={handleDeleteTrip} disabled={busy}>
                    <Trash2 size={15} /> Delete trip
                  </button>
                </div>
              </div>

              {error && <p className="recommendations-error">{error}</p>}

              {editing && (
                <TripEditForm
                  trip={trip}
                  onCancel={() => setEditing(false)}
                  onSaved={() => {
                    setEditing(false);
                    load();
                    // the sidebar switcher and other pages read the name and dates from the store
                    useTripStore.getState().load(true);
                  }}
                />
              )}

              {dayGroups.length === 0 ? (
                <div className="results-empty">
                  <h3>No stops yet.</h3>
                  <p>Search for places near your destination and add them to a day, or ask the trip assistant (the chat button at the bottom right) to add one for you. They will show up here, grouped by day.</p>
                </div>
              ) : (
                <div className="trip-days">
                  {dayGroups.map((group, index) => (
                    <section
                      key={group.dayNumber ?? "unscheduled"}
                      className="trip-day"
                      style={{ "--day-color": `var(--day-${(index % 6) + 1})` }}
                    >
                      <header>
                        <h3>{group.dayNumber ? `Day ${group.dayNumber}` : "Unscheduled"}</h3>
                        {dayDate(group.dayNumber) && <span>{dayDate(group.dayNumber)}</span>}
                      </header>
                      {tripLength && group.dayNumber > tripLength && (
                        <p className="trip-day-late">
                          After the trip ends. Move these stops to an earlier day, or change the trip dates.
                        </p>
                      )}
                      <ol className="trip-stops">
                        {group.items.map((item, position) => (
                          <li key={item.id} className="trip-stop">
                            <time>{item.startTime || ""}</time>
                            <div>
                              <strong>{item.title}</strong>
                              {/* street and district are enough here; the full address is the tooltip */}
                              {item.location && <small title={item.location}>{item.location.split(",").slice(0, 2).join(",")}</small>}
                            </div>
                            <span className="trip-stop-tools print-hide">
                              <AskButton prompt={`Tell me about ${item.title}: what to expect, how long to allow and any tips.`} label={`Ask about ${item.title}`} />
                              {group.dayNumber && (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => moveStop(item.id, group.dayNumber, { direction: -1 })}
                                    disabled={busy || position === 0}
                                    aria-label={`Move ${item.title} earlier`}
                                  >
                                    <ArrowUp size={14} />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => moveStop(item.id, group.dayNumber, { direction: 1 })}
                                    disabled={busy || position === group.items.length - 1}
                                    aria-label={`Move ${item.title} later`}
                                  >
                                    <ArrowDown size={14} />
                                  </button>
                                  {dayCount > 1 && (
                                    <select
                                      value={group.dayNumber}
                                      onChange={(event) => moveStop(item.id, group.dayNumber, { toDay: Number(event.target.value) })}
                                      disabled={busy}
                                      aria-label={`Move ${item.title} to another day`}
                                    >
                                      {Array.from({ length: dayCount }, (_, index) => (
                                        <option key={index + 1} value={index + 1}>Day {index + 1}</option>
                                      ))}
                                    </select>
                                  )}
                                </>
                              )}
                              <button
                                type="button"
                                className="trip-stop-remove"
                                onClick={() => handleDeleteItem(item.id, item.title)}
                                disabled={busy}
                                aria-label={`Remove ${item.title}`}
                              >
                                <X size={14} />
                              </button>
                            </span>
                          </li>
                        ))}
                      </ol>
                    </section>
                  ))}
                </div>
              )}
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

            <AddLandmark trip={trip} onAdded={refresh} />
            {trip.destination && <PlaceFeedback key={`${trip.id}:${trip.destination}`} trip={trip} />}
            </>
            )}

            {tab === "safety" && !trip.destination && (
              <p className="wizard-help">This trip has no destination, so there's no weather or advisory to show.</p>
            )}

            {tab === "safety" && trip.destination && (
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

            {tab === "money" && (
            <TripBudget embedded />
            )}

            {tab === "people" && (
            <section className="recommendations-results">
              <div className="results-heading">
                <div>
                  <h2>Travelling together</h2>
                  <p>Everyone on this trip, and what's changed lately.</p>
                </div>
              </div>
              <TripPeople trip={trip} />
            </section>
            )}

            {tab === "documents" && <TripDocuments tripId={tripId} />}

            {tab === "safety" && trip.destination && (
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
                  month={tripMonth(trip)}
                />
              </section>
            )}
            </div>
          </>
        ) : null}
    </PageShell>
  );
}
