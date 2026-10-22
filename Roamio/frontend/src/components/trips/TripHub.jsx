import { useEffect, useState } from "react";
import { Activity, AlertTriangle, CloudSun, LoaderCircle, MapPinPlus, ShieldAlert, Users, Wallet } from "lucide-react";
import { Link } from "react-router-dom";

import { fetchBudgetSummary } from "../../api/budget.js";
import { fetchLandmarks } from "../../api/recommendations.js";
import { fetchCountrySafety, fetchTripActivity } from "../../api/tripHub.js";
import { addItineraryItem } from "../../api/trips.js";
import { fetchWeather } from "../../api/weather.js";
import { INTEREST_TAGS } from "../../pages/recommendations/constants.js";
import { splitDestination } from "../../utils/countries.js";
import { wholeSentences } from "../../utils/travelAdvice.js";
import "../../styles/insights.css";

// The trip page's hub sections. Each one loads on its own and says plainly
// when its data is missing - nothing here is ever filled with a guess.

export function timeAgo(iso) {
  const minutes = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (!Number.isFinite(minutes)) return "";
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 48) return `${hours} h ago`;
  return `${Math.round(hours / 24)} days ago`;
}

// one fetch per section: { status: "loading" | "ready" | "error", data, message }
function useLoad(load, deps) {
  const [state, setState] = useState({ status: "loading" });
  useEffect(() => {
    let active = true;
    setState({ status: "loading" });
    load()
      .then((data) => active && setState({ status: "ready", data }))
      .catch((error) => active && setState({ status: "error", message: error instanceof Error ? error.message : "" }));
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return state;
}

function Loading({ label }) {
  return (
    <p className="wizard-help">
      <LoaderCircle className="recommendations-spinner" size={15} /> {label}
    </p>
  );
}

const SAFETY_SOURCES = { US_STATE_DEPT: "US State Department travel advisory", TRAVEL_RISK_API: "TravelRiskAPI" };

// Live weather now + the country advisory, side by side.
export function TripSnapshot({ trip }) {
  const { city, country, info } = splitDestination(trip.destination);
  const weather = useLoad(() => fetchWeather(city), [city]);
  const safety = useLoad(
    () => (info ? fetchCountrySafety(info.iso3, country) : Promise.reject(new Error("no-country"))),
    [info?.iso3]
  );

  return (
    <div className="insights trip-hub-grid">
      <section className="insights-card">
        <h3><CloudSun size={15} /> Weather in {city} now</h3>
        {weather.status === "loading" && <Loading label="Checking the weather..." />}
        {weather.status === "error" && <p className="wizard-help">Weather unavailable right now.</p>}
        {weather.status === "ready" && (
          <>
            <p className="trip-hub-big">
              {Math.round(weather.data.current.temp)}°C <span>{weather.data.current.description}</span>
            </p>
            <p className="insights-fine">
              Updated {timeAgo(weather.data.fetched_at)}
              {weather.data.stale && " - the weather service is down, this is the last reading we have"}
            </p>
          </>
        )}
        <Link className="trip-hub-link" to={`/weather?trip=${trip.id}`}>5-day forecast</Link>
      </section>

      <section className="insights-card">
        <h3><ShieldAlert size={15} /> Safety{country ? ` in ${country}` : ""}</h3>
        {safety.status === "loading" && <Loading label="Checking advisories..." />}
        {safety.status === "error" && <p className="wizard-help">Safety data unavailable for this destination.</p>}
        {safety.status === "ready" && (
          <>
            <p className={`trip-hub-big trip-risk-${safety.data.riskLevel}`}>
              Level {safety.data.riskLevel}/4 <span>{safety.data.advisoryLevel}</span>
            </p>
            {safety.data.summary && <p className="wizard-help">{wholeSentences(safety.data.summary, 2)}</p>}
            {(safety.data.emergencyNumbers?.police || safety.data.emergencyNumbers?.medical) && (
              <p className="insights-fine">
                Emergency: police {safety.data.emergencyNumbers.police || "-"}, medical {safety.data.emergencyNumbers.medical || "-"}.
              </p>
            )}
            <p className="insights-fine">
              {safety.data.source === "MOCK"
                ? "Sample advisory - no live advisory feed is configured."
                : `${SAFETY_SOURCES[safety.data.source] || safety.data.source}, last revised ${timeAgo(safety.data.lastUpdated)}.`}
            </p>
            {safety.data.link && (
              <a className="trip-hub-link" href={safety.data.link} target="_blank" rel="noreferrer">Full advisory</a>
            )}
          </>
        )}
      </section>
    </div>
  );
}

// Budget at a glance; the full page is /trips/:id/budget.
export function TripBudgetCard({ trip }) {
  const budget = useLoad(() => fetchBudgetSummary(trip.id), [trip.id]);
  const money = (amount, currency) =>
    `${Number(amount).toLocaleString("en-ZA", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currency}`;

  return (
    <section className="insights-card">
      <h3><Wallet size={15} /> Budget</h3>
      {budget.status === "loading" && <Loading label="Loading budget..." />}
      {budget.status === "error" && <p className="wizard-help">Budget unavailable right now.</p>}
      {budget.status === "ready" && budget.data.totalBudget === null && (
        <p className="wizard-help">
          No budget set. {budget.data.expenseCount > 0 && `${budget.data.expenseCount} expenses recorded.`}
        </p>
      )}
      {budget.status === "ready" && budget.data.totalBudget !== null && (
        <>
          <p className="trip-hub-big">
            {money(budget.data.remaining, budget.data.currency)} <span>left of {money(budget.data.totalBudget, budget.data.currency)}</span>
          </p>
          {budget.data.warnings.map((text) => (
            <p key={text} className="wizard-help trip-risk-3"><AlertTriangle size={13} /> {text}</p>
          ))}
        </>
      )}
      <Link className="trip-hub-link" to={`/trips/${trip.id}/budget`}>Record a purchase</Link>
    </section>
  );
}

// Who's on the trip, and what they've changed.
export function TripPeople({ trip }) {
  const activity = useLoad(() => fetchTripActivity(trip.id), [trip.id]);
  const members = trip.members || [];

  return (
    <div className="insights trip-hub-grid">
      <section className="insights-card">
        <h3><Users size={15} /> Who&apos;s going</h3>
        {members.length === 0 ? (
          <p className="wizard-help">Only you so far.</p>
        ) : (
          <ul className="trip-hub-list">
            {members.map((member) => (
              <li key={member.userId ?? member.id}>
                <strong>{member.user?.fullName || "Traveller"}</strong>
                <span>{String(member.role || "").toLowerCase()}</span>
              </li>
            ))}
          </ul>
        )}
        <Link className="trip-hub-link" to="/family">Invite your travel group</Link>
      </section>

      <section className="insights-card">
        <h3><Activity size={15} /> Recent activity</h3>
        {activity.status === "loading" && <Loading label="Loading activity..." />}
        {activity.status === "error" && <p className="wizard-help">Activity unavailable right now.</p>}
        {activity.status === "ready" && activity.data.length === 0 && <p className="wizard-help">Nothing yet.</p>}
        {activity.status === "ready" && activity.data.length > 0 && (
          <ul className="trip-hub-list">
            {activity.data.slice(0, 6).map((entry) => (
              <li key={entry.id}>
                <strong>{entry.user?.fullName || "Someone"}</strong>
                <span>{entry.details || entry.action} · {timeAgo(entry.createdAt)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

// FR-18: find a nearby place and drop it into a day, without leaving the trip.
export function AddLandmark({ trip, onAdded }) {
  const dayCount = Math.max(1, ...(trip.itinerary || []).map((item) => item.dayNumber || 1));
  const [interest, setInterest] = useState(INTEREST_TAGS[0].id);
  const [results, setResults] = useState(null);
  const [day, setDay] = useState(1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const search = async () => {
    setBusy(true);
    setError("");
    try {
      const data = await fetchLandmarks(trip.destination, [interest]);
      setResults(data.groups?.[0]?.landmarks || []);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Could not search nearby places.");
    } finally {
      setBusy(false);
    }
  };

  const add = async (landmark) => {
    const name = landmark.name.trim().toLowerCase();
    const repeat = (trip.itinerary || []).some((item) => item.dayNumber === day && item.title.trim().toLowerCase() === name);
    if (repeat && !window.confirm(`${landmark.name} is already on day ${day}. Add it again?`)) return;
    setBusy(true);
    setError("");
    try {
      await addItineraryItem(trip.id, {
        title: landmark.name,
        location: landmark.address || undefined,
        dayNumber: day,
        startTime: "10:00",
        lat: landmark.lat,
        lon: landmark.lon,
      });
      setResults((current) => current.filter((item) => item !== landmark));
      onAdded();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Could not add that place.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="recommendations-results print-hide">
      <div className="results-heading">
        <div>
          <h2><MapPinPlus size={18} /> Add a place</h2>
          <p>Search near {splitDestination(trip.destination).city} and add it to a day.</p>
        </div>
      </div>
      <div className="trip-hub-search">
        <select value={interest} onChange={(event) => setInterest(event.target.value)} aria-label="Kind of place">
          {INTEREST_TAGS.map((item) => (
            <option key={item.id} value={item.id}>{item.label}</option>
          ))}
        </select>
        <select value={day} onChange={(event) => setDay(Number(event.target.value))} aria-label="Day">
          {Array.from({ length: dayCount + 1 }, (_, index) => (
            <option key={index + 1} value={index + 1}>
              Day {index + 1}{index + 1 > dayCount ? " (new)" : ""}
            </option>
          ))}
        </select>
        <button type="button" className="secondary-button" onClick={search} disabled={busy}>
          Search
        </button>
      </div>
      {error && <p className="recommendations-error">{error}</p>}
      {results && results.length === 0 && <p className="wizard-help">No matches nearby.</p>}
      {results && results.length > 0 && (
        <ul className="trip-hub-list">
          {results.map((landmark) => (
            <li key={`${landmark.name}-${landmark.lat}`}>
              <strong>{landmark.name}</strong>
              <span>{landmark.address}</span>
              <button type="button" className="secondary-button" onClick={() => add(landmark)} disabled={busy}>
                Add to day {day}
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
