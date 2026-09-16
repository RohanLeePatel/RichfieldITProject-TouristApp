import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Ban,
  Check,
  ChevronLeft,
  ExternalLink,
  LoaderCircle,
  MapPin,
  Plane,
  Plus,
  Search,
  Sparkles,
  Star,
  Trash2,
  Undo2,
  Wand2,
  X,
} from "lucide-react";
import { Link } from "react-router-dom";

import {
  fetchRecommendationCatalog,
  fetchRecommendations,
  fetchLandmarks,
} from "../api/recommendations.js";
import { createTrip, addItineraryItem, deleteTrip } from "../api/trips.js";
import {
  buildDayPlan,
  recomputeDayStopTimes,
  isLikelyClosed,
  isDayOverloaded,
  STOPS_PER_DAY_BY_PACE,
} from "../utils/itineraryPlanner.js";
import "../styles/recommendations.css";

// Specific tags the user can pick, grouped under the 4 broad dimensions the
// scoring engine actually knows about (engine/weights.py). The broad group
// key is what gets sent as `preferences.interests`; the specific tag ids are
// what get passed straight through to /landmarks once a city is chosen.
const INTEREST_GROUPS = [
  {
    key: "nature",
    label: "Nature & outdoors",
    tags: [
      { id: "parks", label: "Parks" },
      { id: "hiking", label: "Hiking" },
      { id: "beaches", label: "Beaches" },
      { id: "waterparks", label: "Waterparks" },
    ],
  },
  {
    key: "history",
    label: "History & culture",
    tags: [
      { id: "museums", label: "Museums" },
      { id: "historic_sites", label: "Historic sites" },
    ],
  },
  {
    key: "food",
    label: "Food & drink",
    tags: [
      { id: "restaurants", label: "Restaurants" },
      { id: "cafes", label: "Cafes" },
      { id: "street_food", label: "Street food" },
    ],
  },
  {
    key: "family",
    label: "Family & kids",
    tags: [
      { id: "theme_parks", label: "Theme parks" },
      { id: "zoos_aquariums", label: "Zoos & aquariums" },
      { id: "playgrounds", label: "Playgrounds" },
    ],
  },
];

const PACE_OPTIONS = [
  { id: "relaxed", label: "Relaxed", helper: "~2 stops a day" },
  { id: "balanced", label: "Balanced", helper: "~3 stops a day" },
  { id: "packed", label: "Packed", helper: "~5 stops a day" },
];

// One-click starting points - fills interests/priority/pace so a group
// doesn't have to build every trip from a blank wizard.
const TRIP_PRESETS = [
  {
    id: "family",
    label: "Family with young kids",
    interests: ["playgrounds", "theme_parks", "zoos_aquariums", "restaurants"],
    priorityInterests: ["playgrounds"],
    pace: "relaxed",
  },
  {
    id: "weekend",
    label: "Weekend city break",
    interests: ["historic_sites", "museums", "cafes", "restaurants"],
    priorityInterests: [],
    pace: "balanced",
  },
  {
    id: "adventure",
    label: "Adventure & hiking",
    interests: ["hiking", "parks", "beaches", "street_food"],
    priorityInterests: ["hiking"],
    pace: "packed",
  },
];

const COUNTRIES = [
  "Argentina", "Australia", "Brazil", "Canada", "Egypt", "France",
  "Germany", "Italy", "Japan", "Kenya", "Mexico", "Namibia", "Netherlands",
  "Portugal", "Singapore", "South Africa", "Spain", "Thailand",
  "United Arab Emirates", "United Kingdom", "United States",
];

const DEFAULT_TRIP_DAYS = 3;
const ITINERARY_HISTORY_LIMIT = 20;

const initialForm = {
  mode: "global",
  country: "South Africa",
  budget: "1000",
  currency: "ZAR",
  startDate: "",
  endDate: "",
  interests: ["parks", "restaurants"],
  priorityInterests: [],
  // tags the group wants hard-excluded from landmark picks and city scoring,
  // independent of anyone's positive interests - see resolveInterests().
  dealbreakers: [],
  // additional travelers' own interest picks, blended in at submit time -
  // see blendTravelerInterests(). Session-only, see its TODO(db) note.
  travelers: [],
  adults: "2",
  children: "",
  wheelchair: "none",
  climate: "",
  pace: "balanced",
  // "precise" mode: an explicit stop count per day instead of the pace
  // default. dayStopCounts[i] is the count for day i+1.
  preciseStops: false,
  dayStopCounts: [],
};

const steps = ["Trip basics", "Interests", "Accessibility & climate", "Review"];

function slugify(value) {
  return value.toLowerCase().replace(/\s+/g, "-");
}

function formatDimension(value) {
  return value.replace(/_/g, " ");
}

// Inclusive day count between two yyyy-mm-dd dates, or DEFAULT_TRIP_DAYS if
// either is missing - the itinerary planner always needs a day count to work
// with, even before real dates are set.
function tripLengthDays(form) {
  if (!form.startDate || !form.endDate) return DEFAULT_TRIP_DAYS;
  const start = new Date(form.startDate);
  const end = new Date(form.endDate);
  const days = Math.round((end - start) / 86_400_000) + 1;
  return days > 0 ? days : DEFAULT_TRIP_DAYS;
}

// Shared by the primary traveler's interest picker and every additional
// traveler's - single-click select, click-again mark priority, click-again
// clear. Pure, no state access, so it works the same against `form` directly
// or against one entry in form.travelers.
function cycleTagState(state, tagId) {
  const isSelected = state.interests.includes(tagId);
  const isPriority = state.priorityInterests.includes(tagId);
  if (!isSelected) {
    return { interests: [...state.interests, tagId], priorityInterests: state.priorityInterests };
  }
  if (!isPriority) {
    return { interests: state.interests, priorityInterests: [...state.priorityInterests, tagId] };
  }
  return {
    interests: state.interests.filter((tag) => tag !== tagId),
    priorityInterests: state.priorityInterests.filter((tag) => tag !== tagId),
  };
}

// TODO(db): "traveler" profiles here are session-only (form state, gone once
// you leave the page) - a real per-account family/group profile that's
// reusable across trips needs somewhere durable to live. This blend is the
// bypass: whoever's filling out the wizard can add other travelers' picks
// right here for one trip, without needing accounts/persistence for it to
// have an effect on this search.
function blendTravelerInterests(form) {
  const additional = form.travelers.filter((traveler) => traveler.interests.length > 0);
  if (additional.length === 0) {
    return { interests: form.interests, priority_interests: form.priorityInterests };
  }
  const allSets = [{ interests: form.interests }, ...additional];
  const interests = [...new Set(allSets.flatMap((set) => set.interests))];
  // a tag every single traveler picked is worth weighting like a priority
  // pick, even if nobody individually starred it - universal agreement is a
  // strong signal on its own
  const universal = interests.filter((tag) => allSets.every((set) => set.interests.includes(tag)));
  const priority_interests = [...new Set([...form.priorityInterests, ...universal])];
  return { interests, priority_interests };
}

// Blends every traveler's picks, then strips out anything the group flagged
// as a dealbreaker - a dealbreaker wins over another traveler's pick of the
// same tag, since it's an explicit "please don't" rather than mere apathy.
// Shared by both the city-ranking request and the landmark fetch so a
// dealbreaker tag never resurfaces in either.
function resolveInterests(form) {
  const { interests, priority_interests } = blendTravelerInterests(form);
  const dealbreakers = new Set(form.dealbreakers);
  return {
    interests: interests.filter((tag) => !dealbreakers.has(tag)),
    priority_interests: priority_interests.filter((tag) => !dealbreakers.has(tag)),
  };
}

function buildPreferences(form) {
  const children = form.children
    ? form.children
        .split(",")
        .map((age) => Number(age.trim()))
        .filter((age) => Number.isInteger(age) && age >= 0)
    : [];

  const { interests, priority_interests } = resolveInterests(form);
  const startMonth = form.startDate ? new Date(form.startDate).getMonth() + 1 : null;
  const endMonth = form.endDate ? new Date(form.endDate).getMonth() + 1 : null;

  return {
    budget_per_day: Number(form.budget),
    currency: form.currency.toUpperCase(),
    interests,
    priority_interests,
    travellers: { adults: Number(form.adults), children },
    accessibility: { wheelchair: form.wheelchair },
    climate: {
      ...(form.climate ? { prefer: form.climate } : {}),
      ...(startMonth ? { travel_month: startMonth } : {}),
      // only send a range when it doesn't wrap the year boundary - see
      // engine/scorers.py score_climate for why that case falls back to
      // travel_month alone instead
      ...(startMonth && endMonth && endMonth >= startMonth ? { travel_month_end: endMonth } : {}),
    },
    pace: form.pace,
  };
}

// Renders the interest-group tag buttons for one traveler's picks (the
// primary trip organizer, or one added via "Add another traveler"). Shared so
// the two call sites don't duplicate the group/tag rendering.
function InterestPicker({ interests, priorityInterests, onCycle }) {
  return INTEREST_GROUPS.map((group) => (
    <div key={group.key} className="interest-group">
      <h4 className="interest-group-label">{group.label}</h4>
      <div className="interest-list">
        {group.tags.map((tag) => {
          const isSelected = interests.includes(tag.id);
          const isPriority = priorityInterests.includes(tag.id);
          return (
            <button
              type="button"
              className={`interest-option ${isSelected ? "selected" : ""} ${isPriority ? "priority" : ""}`}
              key={tag.id}
              onClick={() => onCycle(tag.id)}
              title={isPriority ? "Must-have" : isSelected ? "Tap to mark as must-have" : ""}
            >
              {isPriority ? <Star size={14} /> : isSelected && <Check size={14} />} {tag.label}
            </button>
          );
        })}
      </div>
    </div>
  ));
}

function RecommendationCard({ recommendation, onSelect, selectLabel }) {
  const destinationName = recommendation.name || recommendation.id;
  const mapUrl =
    recommendation.map_url ||
    `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
      destinationName
    )}`;
  // The "interests" dimension gets special treatment: show each matched tag
  // as its own chip (starred if it was a priority pick) instead of one flat
  // "interests" chip, so a user can actually see which of their picks moved
  // this result up - not just that "interests" counted somehow.
  const interestsEntry = recommendation.breakdown?.find((entry) => entry.dimension === "interests");
  const priorityTags = new Set(interestsEntry?.evidence?.priority || []);
  const requestedTags = interestsEntry?.evidence?.requested || [];
  const otherEvidence = recommendation.breakdown
    ?.filter((entry) => entry.dimension !== "interests" && entry.weight > 0)
    .slice(0, 3);

  return (
    <article className="recommendation-card">
      {recommendation.image_url ? (
        <img
          className="recommendation-card-image"
          src={recommendation.image_url}
          alt={`${destinationName} destination`}
        />
      ) : (
        <div className="recommendation-card-image recommendation-card-image-fallback">
          <MapPin size={25} />
        </div>
      )}
      <div className="recommendation-card-body">
        <div className="recommendation-card-topline">
          <span className="recommendation-rank">#{recommendation.rank}</span>
          <span className="recommendation-score">
            {Math.round(recommendation.total_score * 100)}% match
          </span>
        </div>
        <h3>{destinationName}</h3>
        {recommendation.country && (
          <p className="recommendation-location">
            <MapPin size={14} /> {recommendation.country}
          </p>
        )}
        <p className="recommendation-explanation">
          {recommendation.explanation}
        </p>
        <div className="recommendation-evidence">
          {otherEvidence?.map((entry) => (
            <span key={entry.dimension}>
              <Check size={13} />
              {formatDimension(entry.dimension)}
            </span>
          ))}
          {requestedTags.map((tag) => (
            <span key={tag} className={priorityTags.has(tag) ? "priority" : ""}>
              {priorityTags.has(tag) ? <Star size={12} /> : <Check size={13} />}
              {formatDimension(tag)}
            </span>
          ))}
        </div>
        <div className="recommendation-card-actions">
          <a href={mapUrl} target="_blank" rel="noreferrer">
            View map <ExternalLink size={14} />
          </a>
          {onSelect && (
            <button type="button" onClick={() => onSelect(recommendation)}>
              {selectLabel} <ArrowRight size={14} />
            </button>
          )}
        </div>
      </div>
    </article>
  );
}

const ITINERARY_MAP_COLORS = ["#23a89e", "#f4a340", "#7c6fe0", "#e0607c", "#4f9de0", "#8bc34a"];
const ITINERARY_MAP_SIZE = 260;
const ITINERARY_MAP_PAD = 20;

// A rough "which stops are near which" layout, not a real basemap - plotting
// lat/lon on a plain SVG needs no map library/API key, at the cost of no
// streets/labels. Upgrade to Leaflet/Mapbox tiles if that visual context
// turns out to matter more than the dependency-free simplicity here.
function ItineraryMap({ itineraryDays }) {
  const points = itineraryDays.flatMap((day) =>
    day.stops.map((stop) => ({ lat: stop.landmark.lat, lon: stop.landmark.lon, dayNumber: day.dayNumber, name: stop.landmark.name }))
  );
  if (points.length < 2) return null;

  const lats = points.map((p) => p.lat);
  const lons = points.map((p) => p.lon);
  const minLat = Math.min(...lats);
  const latSpan = Math.max(...lats) - minLat || 0.001;
  const minLon = Math.min(...lons);
  const lonSpan = Math.max(...lons) - minLon || 0.001;
  const plotSize = ITINERARY_MAP_SIZE - ITINERARY_MAP_PAD * 2;
  const toXY = (p) => ({
    x: ITINERARY_MAP_PAD + ((p.lon - minLon) / lonSpan) * plotSize,
    // latitude increases northward, SVG y increases downward - flip it
    y: ITINERARY_MAP_PAD + (1 - (p.lat - minLat) / latSpan) * plotSize,
  });
  const activeDays = itineraryDays.filter((day) => day.stops.length > 0);

  return (
    <div className="itinerary-map">
      <p className="wizard-help">Rough layout of your stops by day - not a real map, see a stop&apos;s &quot;View map&quot; link for that.</p>
      <svg viewBox={`0 0 ${ITINERARY_MAP_SIZE} ${ITINERARY_MAP_SIZE}`} width="100%" height={ITINERARY_MAP_SIZE} role="img" aria-label="Rough layout of itinerary stops by day">
        {points.map((point, index) => {
          const { x, y } = toXY(point);
          const color = ITINERARY_MAP_COLORS[(point.dayNumber - 1) % ITINERARY_MAP_COLORS.length];
          return (
            <circle key={index} cx={x} cy={y} r={5} fill={color}>
              <title>{`Day ${point.dayNumber}: ${point.name}`}</title>
            </circle>
          );
        })}
      </svg>
      <div className="itinerary-map-legend">
        {activeDays.map((day) => (
          <span key={day.dayNumber}>
            <i style={{ background: ITINERARY_MAP_COLORS[(day.dayNumber - 1) % ITINERARY_MAP_COLORS.length] }} />
            Day {day.dayNumber}
          </span>
        ))}
      </div>
    </div>
  );
}

export default function Recommendations() {
  // wizard -> collecting preferences
  // results -> ranked countries or cities
  // landmarks -> a trip was created for the chosen city, pick stops for it
  // itinerary -> stops auto-sequenced into a day-by-day agenda, editable
  // done -> itinerary saved
  const [stage, setStage] = useState("wizard");
  const [step, setStep] = useState(0);
  const [form, setForm] = useState(initialForm);
  const [countries, setCountries] = useState(
    COUNTRIES.map((name) => ({ id: slugify(name), name }))
  );
  const [recommendationData, setRecommendationData] = useState(null);
  const [selectedCountry, setSelectedCountry] = useState(null);
  const [selectedCity, setSelectedCity] = useState(null);
  const [trip, setTrip] = useState(null);
  const [landmarksData, setLandmarksData] = useState(null);
  const [selectedLandmarks, setSelectedLandmarks] = useState(new Set());
  const [landmarkFilter, setLandmarkFilter] = useState("");
  // [{ dayNumber, stops: [{ landmark, startTime, endTime }] }] - seeded once
  // from buildDayPlan(), then mutated directly by drag-and-drop/remove/add-day.
  const [itineraryDays, setItineraryDays] = useState([]);
  // Snapshots of itineraryDays taken right before each mutating edit, so
  // "Undo" can pop the last one back. Capped so an editing spree can't grow
  // this unbounded.
  const [itineraryHistory, setItineraryHistory] = useState([]);
  const [dragStop, setDragStop] = useState(null); // { dayIndex, stopIndex } of the stop being dragged
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  // Bumped on every async action below; a response is only applied if it's
  // still the most recent one requested, so an earlier, slower request
  // (e.g. exploring a country, then quickly switching to another) can't
  // land after a newer one and overwrite it with stale results.
  const requestIdRef = useRef(0);
  // Stack of previous "results" views (country list before drilling into a
  // city, city list before picking one) so the back button can restore them
  // without an extra fetch. Empty means the only way back is the wizard.
  const [resultsHistory, setResultsHistory] = useState([]);

  useEffect(() => {
    let active = true;
    fetchRecommendationCatalog()
      .then((catalog) => {
        if (active && catalog.length > 0) {
          setCountries(catalog);
          setForm((current) => ({
            ...current,
            country: catalog.some((item) => item.name === current.country)
              ? current.country
              : catalog[0].name,
          }));
        }
      })
      .catch(() => {
        // Keep the bundled list available if the catalog endpoint is temporarily unavailable.
      });

    return () => {
      active = false;
    };
  }, []);

  const updateForm = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }));
    setError("");
  };

  // Each tag button cycles unselected -> selected -> priority (★) -> unselected,
  // so a user can flag a subset of their interests as must-have rather than
  // every selected interest counting equally (engine/scorers.py score_interests).
  const cycleInterest = (tagId) => {
    setForm((current) => ({ ...current, ...cycleTagState(current, tagId) }));
  };

  const cycleTravelerInterest = (travelerId, tagId) => {
    setForm((current) => ({
      ...current,
      travelers: current.travelers.map((traveler) =>
        traveler.id === travelerId ? { ...traveler, ...cycleTagState(traveler, tagId) } : traveler
      ),
    }));
  };

  const addTraveler = () => {
    setForm((current) => ({
      ...current,
      travelers: [
        ...current.travelers,
        { id: Date.now() + Math.random(), interests: [], priorityInterests: [] },
      ],
    }));
  };

  const removeTraveler = (travelerId) => {
    setForm((current) => ({
      ...current,
      travelers: current.travelers.filter((traveler) => traveler.id !== travelerId),
    }));
  };

  // Dealbreakers are a separate on/off list, not a 3rd cycle state on the
  // interest buttons - "avoid museums" shouldn't share a control with "I'd
  // like some museums", they're opposite intents.
  const toggleDealbreaker = (tagId) => {
    setForm((current) => ({
      ...current,
      dealbreakers: current.dealbreakers.includes(tagId)
        ? current.dealbreakers.filter((tag) => tag !== tagId)
        : [...current.dealbreakers, tagId],
    }));
  };

  const applyPreset = (preset) => {
    setForm((current) => ({
      ...current,
      interests: preset.interests,
      priorityInterests: preset.priorityInterests,
      pace: preset.pace,
    }));
  };

  // Turning precise mode on seeds one count per trip day from the current
  // pace default, which the user can then adjust per day; turning it off
  // just falls back to the pace default everywhere again.
  const togglePreciseStops = () => {
    setForm((current) => {
      if (current.preciseStops) return { ...current, preciseStops: false };
      const defaultCount = STOPS_PER_DAY_BY_PACE[current.pace] ?? STOPS_PER_DAY_BY_PACE.balanced;
      return {
        ...current,
        preciseStops: true,
        dayStopCounts: Array.from({ length: tripLengthDays(current) }, () => defaultCount),
      };
    });
  };

  const updateDayStopCount = (dayIndex, value) => {
    setForm((current) => {
      const counts = [...current.dayStopCounts];
      counts[dayIndex] = Math.max(1, Number(value) || 1);
      return { ...current, dayStopCounts: counts };
    });
  };

  const validateStep = () => {
    if (step === 0) {
      if (!Number.isFinite(Number(form.budget)) || Number(form.budget) <= 0) {
        return "Enter a daily budget greater than zero.";
      }
      if (!/^[a-z]{3}$/i.test(form.currency)) {
        return "Currency must be a 3-letter ISO code, such as ZAR.";
      }
      if (!Number.isInteger(Number(form.adults)) || Number(form.adults) < 1) {
        return "Add at least one adult traveller.";
      }
      if (form.startDate && form.endDate && form.endDate < form.startDate) {
        return "Trip end date can't be before the start date.";
      }
    }
    if (step === 1 && form.interests.length === 0) {
      return "Choose at least one interest.";
    }
    return "";
  };

  const submitRecommendations = async (level, parentId, country = null) => {
    const requestId = ++requestIdRef.current;
    setLoading(true);
    setError("");
    try {
      const data = await fetchRecommendations(
        buildPreferences(form),
        level,
        parentId
      );
      if (requestId !== requestIdRef.current) return; // superseded by a newer request
      setRecommendationData(data);
      setSelectedCountry(country);
      setStage("results");
    } catch (requestError) {
      if (requestId !== requestIdRef.current) return;
      setRecommendationData(null);
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Recommendations are currently unavailable."
      );
    } finally {
      if (requestId === requestIdRef.current) setLoading(false);
    }
  };

  const handleNext = async () => {
    const validationError = validateStep();
    if (validationError) {
      setError(validationError);
      return;
    }
    setError("");
    if (step < steps.length - 1) {
      setStep((current) => current + 1);
      return;
    }
    // A fresh search from the wizard starts a new drill-down, not a
    // continuation of whatever was explored before.
    setResultsHistory([]);
    await submitRecommendations(
      form.mode === "global" ? "country" : "city",
      form.mode === "country" ? slugify(form.country) : undefined,
      form.mode === "country" ? { id: slugify(form.country), name: form.country } : null
    );
  };

  // Excluded destinations only carry {id, name, country, reason} - enough to
  // still drill into them if the user wants to override the engine's call.
  const selectExcluded = (level, item) =>
    level === "country" ? exploreCities(item) : selectCity(item);

  const exploreCities = (country) => {
    setResultsHistory((current) => [
      ...current,
      { data: recommendationData, selectedCountry },
    ]);
    return submitRecommendations("city", country.id, country);
  };

  // Picking a city ends the exploratory part of the flow: start a real trip
  // for it, then load landmarks matching the user's specific interest tags
  // so they can build the first itinerary stops right here.
  //
  // TODO(db): this whole flow assumes one city per trip - createTrip() below
  // takes a single `destination` string, and the Trip model backing it has no
  // way to hold multiple destinations with their own day ranges (a real
  // multi-city trip, e.g. 3 days Cape Town + 2 days Durban, isn't
  // representable). That needs its own data model decision (something like
  // TripDestination from the live DB's actual schema - see the TODO(db) notes
  // in backend/project-backend/routes/trips.js) before it can be built, so
  // there's no useful frontend-only bypass here - it's a schema question first.
  const selectCity = async (city) => {
    if (loading) return;
    const requestId = ++requestIdRef.current;
    setLoading(true);
    setError("");
    try {
      // Bare city names are ambiguous ("Lima" alone geocodes to Lima, Ohio
      // as easily as Lima, Peru) - include the country we already know from
      // the recommendation so /landmarks searches the right place.
      const destinationLabel = city.country ? `${city.name}, ${city.country}` : city.name;
      const createdTrip = await createTrip({
        title: `${city.name} Trip`,
        destination: destinationLabel,
        budget: Number(form.budget) * tripLengthDays(form),
        startDate: form.startDate || undefined,
        endDate: form.endDate || undefined,
      });
      const landmarks = await fetchLandmarks(destinationLabel, resolveInterests(form).interests);
      if (requestId !== requestIdRef.current) return;
      setResultsHistory((current) => [
        ...current,
        { data: recommendationData, selectedCountry },
      ]);
      setTrip(createdTrip);
      setSelectedCity(city);
      setLandmarksData(landmarks);
      setSelectedLandmarks(new Set());
      setStage("landmarks");
    } catch (requestError) {
      if (requestId !== requestIdRef.current) return;
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Could not start this trip. Please try again."
      );
    } finally {
      if (requestId === requestIdRef.current) setLoading(false);
    }
  };

  // Restores the previous results view (a country list, or a city list)
  // with no extra fetch. Falls back to the wizard when there's nothing
  // earlier to go back to.
  const goBackToResults = () => {
    requestIdRef.current++; // invalidate any in-flight fetch for the view we're leaving
    if (resultsHistory.length === 0) {
      editPreferences();
      return;
    }
    const previous = resultsHistory[resultsHistory.length - 1];
    setResultsHistory((current) => current.slice(0, -1));
    setRecommendationData(previous.data);
    setSelectedCountry(previous.selectedCountry);
    setStage("results");
  };

  // Leaving the landmarks step abandons the trip that was created for that
  // city, so a changed mind doesn't leave a half-built draft trip behind.
  const goBackFromLandmarks = async () => {
    requestIdRef.current++;
    const abandonedTripId = trip?.id;
    setTrip(null);
    setSelectedCity(null);
    setLandmarksData(null);
    setSelectedLandmarks(new Set());
    setItineraryDays([]);
    goBackToResults();
    if (abandonedTripId) {
      try {
        await deleteTrip(abandonedTripId);
      } catch {
        // best-effort cleanup - not worth blocking navigation over
      }
    }
  };

  const toggleLandmark = (key) => {
    setSelectedLandmarks((current) => {
      const next = new Set(current);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const checkedLandmarks = () => {
    const chosen = [];
    landmarksData?.groups.forEach((group) => {
      group.landmarks.forEach((landmark, index) => {
        if (selectedLandmarks.has(`${group.interest}|${index}`)) {
          chosen.push(landmark);
        }
      });
    });
    return chosen;
  };

  // "Pick for me": pre-checks a reasonable spread of landmarks instead of
  // making the user tick every box by hand on a city with dozens of matches.
  // Each interest group gets a share of the overall stop budget
  // (stopsPerDay x tripDays), taking its first N landmarks - groups are
  // already sorted by distance, so this is "the closest matches per interest",
  // not a random sample. Replaces the current selection rather than adding to
  // it, so re-running it after manual tweaks gives a predictable result.
  const autoPickLandmarks = () => {
    if (!landmarksData?.groups?.length) return;
    const stopsPerDay = STOPS_PER_DAY_BY_PACE[form.pace] ?? STOPS_PER_DAY_BY_PACE.balanced;
    const target = stopsPerDay * tripLengthDays(form);
    const perGroup = Math.max(1, Math.round(target / landmarksData.groups.length));
    const next = new Set();
    landmarksData.groups.forEach((group) => {
      group.landmarks.slice(0, perGroup).forEach((_, index) => next.add(`${group.interest}|${index}`));
    });
    setSelectedLandmarks(next);
    setError("");
  };

  // Sequences the checked landmarks into a day-by-day agenda (engine is pure,
  // frontend-only - see src/utils/itineraryPlanner.js) and moves to the
  // editable preview stage. Re-running this (via "Back to picks") always
  // rebuilds fresh from buildDayPlan, discarding any manual drag/remove edits -
  // that's fine, it's an explicit action, not an accidental one.
  const buildItinerary = () => {
    const chosen = checkedLandmarks();
    if (chosen.length === 0) {
      setError("Check at least one landmark first.");
      return;
    }
    setError("");
    setItineraryDays(
      buildDayPlan({
        landmarks: chosen,
        tripDays: tripLengthDays(form),
        pace: form.pace,
        dayStopCounts: form.preciseStops ? form.dayStopCounts : undefined,
        familyFriendly: !form.preciseStops && form.children.trim().length > 0,
      })
    );
    setItineraryHistory([]);
    setStage("itinerary");
  };

  // Snapshots the itinerary right before a mutating edit so "Undo" can
  // restore it. Called at the start of every edit handler below, capped so a
  // long editing session doesn't grow this without bound.
  const snapshotItinerary = () => {
    setItineraryHistory((current) => [...current.slice(-(ITINERARY_HISTORY_LIMIT - 1)), itineraryDays]);
  };

  const undoItineraryEdit = () => {
    setItineraryHistory((current) => {
      if (current.length === 0) return current;
      setItineraryDays(current[current.length - 1]);
      return current.slice(0, -1);
    });
  };

  // dayNumber is just each day's position - re-derive it after any structural
  // change (add/remove/move) so a removed or emptied day never leaves a gap
  // (e.g. Day 1, Day 3 with no Day 2).
  const renumberDays = (days) => days.map((day, index) => ({ ...day, dayNumber: index + 1 }));

  const removeStop = (dayIndex, stopIndex) => {
    snapshotItinerary();
    setItineraryDays((current) =>
      renumberDays(
        current.map((day, index) => {
          if (index !== dayIndex) return day;
          const stops = day.stops.filter((_, i) => i !== stopIndex);
          return { ...day, stops: recomputeDayStopTimes(stops.map((s) => s.landmark)) };
        })
      )
    );
  };

  // Adding a day rebalances every already-picked stop evenly across the new
  // day count instead of leaving the new day empty ("drag one here") - the
  // itinerary only ever contains stops the user explicitly checked, so
  // there's no separate pool to pull fresh suggestions from; redistributing
  // the existing ones is what "auto-populate" can mean here.
  // ponytail: even split in current order, not a re-run of the geographic
  // sweep - upgrade to re-clustering if it visibly mixes far-apart stops.
  const addDay = () => {
    snapshotItinerary();
    setItineraryDays((current) => {
      const allLandmarks = current.flatMap((day) => day.stops.map((stop) => stop.landmark));
      if (allLandmarks.length === 0) {
        return renumberDays([...current, { dayNumber: 0, stops: [] }]);
      }
      const dayCount = current.length + 1;
      const perDay = Math.ceil(allLandmarks.length / dayCount);
      return Array.from({ length: dayCount }, (_, index) => ({
        dayNumber: index + 1,
        stops: recomputeDayStopTimes(allLandmarks.slice(index * perDay, (index + 1) * perDay)),
      }));
    });
  };

  // Only lets you remove an empty day - dropping a day with stops still in it
  // would silently lose them, and there's no undo here; empty it out first
  // (drag its stops elsewhere, or remove them) to remove the day itself.
  const removeDay = (dayIndex) => {
    snapshotItinerary();
    setItineraryDays((current) => renumberDays(current.filter((_, index) => index !== dayIndex)));
  };

  // Native HTML5 drag-and-drop - the platform already does this, no library
  // needed. Moves a stop to a new day/position and recomputes times for both
  // the source and destination day using the exact same rule buildDayPlan used.
  const moveStop = (from, to) => {
    if (from.dayIndex === to.dayIndex && from.stopIndex === to.stopIndex) return;
    snapshotItinerary();
    setItineraryDays((current) => {
      const days = current.map((day) => ({ ...day, stops: [...day.stops] }));
      const [moved] = days[from.dayIndex].stops.splice(from.stopIndex, 1);
      const destIndex = Math.min(to.stopIndex, days[to.dayIndex].stops.length);
      days[to.dayIndex].stops.splice(destIndex, 0, moved);
      days[from.dayIndex].stops = recomputeDayStopTimes(days[from.dayIndex].stops.map((s) => s.landmark));
      days[to.dayIndex].stops = recomputeDayStopTimes(days[to.dayIndex].stops.map((s) => s.landmark));
      return renumberDays(days);
    });
  };

  const saveItinerary = async () => {
    setLoading(true);
    setError("");
    const jobs = itineraryDays.flatMap((day) =>
      day.stops.map(({ landmark, startTime }) => ({
        dayNumber: day.dayNumber,
        title: landmark.name,
        location: landmark.address || undefined,
        startTime,
      }))
    );
    // allSettled instead of all - one failed stop shouldn't hide whether the
    // other N-1 actually saved, and it lets the user see exactly how much
    // landed instead of an all-or-nothing error with no way to tell.
    const outcomes = await Promise.allSettled(jobs.map((job) => addItineraryItem(trip.id, job)));
    const failedCount = outcomes.filter((outcome) => outcome.status === "rejected").length;
    setLoading(false);
    if (failedCount === 0) {
      setStage("done");
      return;
    }
    // Stay on this screen so the user can retry. Retrying re-sends every
    // stop, including ones that already saved, since there's no idempotency
    // key on the backend yet - acceptable for now (see TODO(db) in
    // api/trips.js), a real fix needs the DB schema question settled first.
    setError(
      `Saved ${jobs.length - failedCount} of ${jobs.length} stops. ${failedCount} failed - check your connection and try saving again.`
    );
  };

  const editPreferences = () => {
    setRecommendationData(null);
    setResultsHistory([]);
    setStep(0);
    setStage("wizard");
  };

  const resultTitle = recommendationData?.level === "country"
    ? "Countries that fit your trip"
    : `Cities in ${selectedCountry?.name || form.country}`;
  // The engine's `excluded` list mixes two very different things: places that
  // actually failed a requirement (budget/accessibility/relevance), and
  // places that simply didn't make the top-N cut despite scoring fine. Only
  // the first kind is worth calling "excluded by your requirements" - the
  // second is just normal ranking and shouldn't read as a rejection.
  const requirementExclusions = useMemo(
    () =>
      recommendationData?.excluded?.filter(
        (item) => !item.reason.startsWith("Ranked below the top")
      ) || [],
    [recommendationData]
  );
  const rankedOutCount =
    (recommendationData?.excluded?.length || 0) - requirementExclusions.length;
  const relaxSuggestions = useMemo(
    () => requirementExclusions.slice(0, 3),
    [requirementExclusions]
  );

  return (
    <main className="recommendations-page">
      <header className="recommendations-header">
        <Link to="/dashboard" className="recommendations-back-link">
          <ArrowLeft size={17} /> Back to dashboard
        </Link>
        <div className="recommendations-brand">
          <span><Plane size={18} /></span> Roamio
        </div>
      </header>

      <div className="recommendations-content">
        {stage === "wizard" && (
          <section className="recommendations-intro">
            <p className="recommendations-eyebrow">
              <Sparkles size={15} /> Personalised travel planning
            </p>
            <h1>Plan a trip that feels made for you.</h1>
            <p>Answer four quick steps. We&apos;ll explain why each country or city matches your group.</p>
          </section>
        )}

        {stage === "wizard" && (
          <section className="wizard-card">
            <div className="wizard-progress">
              {steps.map((label, index) => (
                <div className={`wizard-step ${index <= step ? "active" : ""}`} key={label}>
                  <span>{index + 1}</span>
                  {label}
                </div>
              ))}
            </div>

            <div className="wizard-content">
              {step === 0 && (
                <>
                  <h2>Where should we look?</h2>
                  <p className="wizard-help">Start globally, or tell us which country you already have in mind.</p>
                  <div className="preset-list">
                    {TRIP_PRESETS.map((preset) => (
                      <button type="button" key={preset.id} className="preset-option" onClick={() => applyPreset(preset)}>
                        <Wand2 size={14} /> {preset.label}
                      </button>
                    ))}
                  </div>
                  <div className="mode-options">
                    <button type="button" className={form.mode === "global" ? "mode-option selected" : "mode-option"} onClick={() => updateForm("mode", "global")}>
                      <Sparkles size={20} />
                      <strong>Explore globally</strong>
                      <span>Rank countries around the world.</span>
                    </button>
                    <button type="button" className={form.mode === "country" ? "mode-option selected" : "mode-option"} onClick={() => updateForm("mode", "country")}>
                      <MapPin size={20} />
                      <strong>I have a country in mind</strong>
                      <span>Find the best cities in one country.</span>
                    </button>
                  </div>
                  {form.mode === "country" && (
                    <label className="wizard-field">
                      Country
                      <select value={form.country} onChange={(event) => updateForm("country", event.target.value)}>
                        {countries.map((country) => <option key={country.id} value={country.name}>{country.name} ({country.city_count || 0} cities)</option>)}
                      </select>
                    </label>
                  )}
                  <div className="field-grid wizard-fields">
                    <label className="wizard-field">Daily budget<input type="number" min="1" value={form.budget} onChange={(event) => updateForm("budget", event.target.value)} /></label>
                    <label className="wizard-field">Currency<input maxLength="3" value={form.currency} onChange={(event) => updateForm("currency", event.target.value)} /></label>
                    <label className="wizard-field">Adults<input type="number" min="1" value={form.adults} onChange={(event) => updateForm("adults", event.target.value)} /></label>
                    <label className="wizard-field">Children&apos;s ages<input placeholder="e.g. 8, 12" value={form.children} onChange={(event) => updateForm("children", event.target.value)} /></label>
                    <label className="wizard-field">Start date<input type="date" value={form.startDate} onChange={(event) => updateForm("startDate", event.target.value)} /></label>
                    <label className="wizard-field">End date<input type="date" value={form.endDate} min={form.startDate || undefined} onChange={(event) => updateForm("endDate", event.target.value)} /></label>
                  </div>
                  <p className="wizard-help">Dates sharpen climate matching and let us lay out your itinerary by day - skip them and we&apos;ll use a sample {DEFAULT_TRIP_DAYS}-day plan later.</p>
                </>
              )}

              {step === 1 && (
                <>
                  <h2>What do you enjoy?</h2>
                  <p className="wizard-help">Tap once to pick, tap again to mark it a must-have (★) - must-haves count for more when we rank matches.</p>
                  <InterestPicker
                    interests={form.interests}
                    priorityInterests={form.priorityInterests}
                    onCycle={cycleInterest}
                  />
                  {form.travelers.map((traveler, index) => (
                    <div key={traveler.id} className="traveler-block">
                      <div className="traveler-block-header">
                        <h4>Traveler {index + 2}&apos;s picks</h4>
                        <button type="button" onClick={() => removeTraveler(traveler.id)} aria-label="Remove this traveler">
                          <X size={14} />
                        </button>
                      </div>
                      <InterestPicker
                        interests={traveler.interests}
                        priorityInterests={traveler.priorityInterests}
                        onCycle={(tagId) => cycleTravelerInterest(traveler.id, tagId)}
                      />
                    </div>
                  ))}
                  <button type="button" className="secondary-button" onClick={addTraveler}>
                    <Plus size={16} /> Add another traveler&apos;s preferences
                  </button>
                  {form.travelers.some((t) => t.interests.length > 0) && (
                    <p className="wizard-help">
                      A tag every traveler picked is weighted like a must-have automatically.
                    </p>
                  )}
                  <div className="dealbreaker-section">
                    <h4 className="interest-group-label">Anything to avoid?</h4>
                    <p className="wizard-help">These are excluded from every traveler&apos;s matches, even if someone else picked them.</p>
                    <div className="interest-list">
                      {INTEREST_GROUPS.flatMap((group) => group.tags).map((tag) => {
                        const excluded = form.dealbreakers.includes(tag.id);
                        return (
                          <button
                            type="button"
                            key={tag.id}
                            className={`interest-option dealbreaker ${excluded ? "selected" : ""}`}
                            onClick={() => toggleDealbreaker(tag.id)}
                          >
                            {excluded && <Ban size={14} />} {tag.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </>
              )}

              {step === 2 && (
                <>
                  <h2>Make it work for your group.</h2>
                  <p className="wizard-help">These data-backed preferences help the engine rank suitable matches.</p>
                  <div className="field-grid wizard-fields">
                    <label className="wizard-field">Accessibility<select value={form.wheelchair} onChange={(event) => updateForm("wheelchair", event.target.value)}><option value="none">No specific need</option><option value="preferred">Wheelchair preferred</option><option value="required">Wheelchair required</option></select></label>
                    <label className="wizard-field">Climate<select value={form.climate} onChange={(event) => updateForm("climate", event.target.value)}><option value="">No preference</option><option value="mild">Mild</option><option value="hot">Hot</option><option value="cold">Cold</option></select></label>
                  </div>
                  <label className="wizard-field">
                    Daily pace
                    <select value={form.pace} onChange={(event) => updateForm("pace", event.target.value)}>
                      {PACE_OPTIONS.map((option) => (
                        <option key={option.id} value={option.id}>{option.label} ({option.helper})</option>
                      ))}
                    </select>
                  </label>
                  <label className="wizard-field-checkbox">
                    <input type="checkbox" checked={form.preciseStops} onChange={togglePreciseStops} />
                    Set stops per day precisely
                  </label>
                  {form.preciseStops && (
                    <>
                      <p className="wizard-help">Different days can carry different amounts - a light arrival day, a packed middle day, whatever fits.</p>
                      <div className="field-grid wizard-fields">
                        {form.dayStopCounts.map((count, index) => (
                          <label key={index} className="wizard-field">
                            Day {index + 1}
                            <input
                              type="number"
                              min="1"
                              max="10"
                              value={count}
                              onChange={(event) => updateDayStopCount(index, event.target.value)}
                            />
                          </label>
                        ))}
                      </div>
                    </>
                  )}
                </>
              )}

              {step === 3 && (
                <>
                  <h2>Review your trip preferences.</h2>
                  <p className="wizard-help">You can go back and change anything before we search.</p>
                  <div className="review-grid">
                    <div><span>Search</span><strong>{form.mode === "global" ? "Global countries" : `Cities in ${form.country}`}</strong></div>
                    <div><span>Budget</span><strong>{form.budget} {form.currency.toUpperCase()} per day</strong></div>
                    <div><span>Travellers</span><strong>{form.adults} adults{form.children ? `, children aged ${form.children}` : ""}</strong></div>
                    <div>
                      <span>Interests</span>
                      <strong>
                        {form.interests
                          .map((tag) => (form.priorityInterests.includes(tag) ? `★ ${formatDimension(tag)}` : formatDimension(tag)))
                          .join(", ")}
                      </strong>
                    </div>
                    {form.dealbreakers.length > 0 && (
                      <div><span>Avoiding</span><strong>{form.dealbreakers.map(formatDimension).join(", ")}</strong></div>
                    )}
                    <div><span>Climate</span><strong>{form.climate || "Any climate"}</strong></div>
                    <div><span>Dates</span><strong>{form.startDate && form.endDate ? `${form.startDate} → ${form.endDate}` : `Not set (sample ${DEFAULT_TRIP_DAYS}-day plan)`}</strong></div>
                    <div><span>Pace</span><strong>{PACE_OPTIONS.find((option) => option.id === form.pace)?.label}</strong></div>
                  </div>
                </>
              )}

              {error && <p className="recommendations-error">{error}</p>}
              <div className="wizard-actions">
                {step > 0 && <button type="button" className="secondary-button" onClick={() => { setError(""); setStep((current) => current - 1); }}><ChevronLeft size={17} /> Back</button>}
                <button type="button" className="recommendations-submit" onClick={handleNext} disabled={loading}>
                  {loading ? <><LoaderCircle className="recommendations-spinner" size={18} /> Finding matches...</> : <>{step === steps.length - 1 ? "Find my matches" : "Continue"} <ArrowRight size={17} /></>}
                </button>
              </div>
            </div>
          </section>
        )}

        {stage === "results" && recommendationData && (
          <section className="recommendations-results">
            <div className="results-heading">
              <div>
                <p className="recommendations-eyebrow"><MapPin size={15} /> {recommendationData.level} recommendations</p>
                <h2>{resultTitle}</h2>
                <p>Ranked using your saved preferences. You can edit them and search again.</p>
              </div>
              <div className="results-heading-actions">
                <button type="button" className="secondary-button" onClick={goBackToResults}>
                  <ChevronLeft size={17} />
                  {resultsHistory.length > 0 ? "Back" : "Edit preferences"}
                </button>
                {resultsHistory.length > 0 && (
                  <button type="button" className="secondary-button" onClick={editPreferences}>Start over</button>
                )}
              </div>
            </div>
            {recommendationData.results.length === 0 ? (
              <div className="results-empty">
                <h3>No exact matches yet.</h3>
                <p>Try relaxing one of these requirements:</p>
                <ul>{relaxSuggestions.map((item) => <li key={item.id}>{item.name}: {item.reason}</li>)}</ul>
                <button type="button" className="recommendations-submit" onClick={editPreferences}>Edit preferences</button>
              </div>
            ) : (
              <div className="recommendation-list">
                {recommendationData.results.map((recommendation) => (
                  <RecommendationCard
                    key={recommendation.id}
                    recommendation={recommendation}
                    onSelect={
                      recommendationData.level === "country"
                        ? exploreCities
                        : recommendationData.level === "city"
                        ? selectCity
                        : undefined
                    }
                    selectLabel={
                      recommendationData.level === "country"
                        ? "Explore cities"
                        : loading
                        ? "Starting trip..."
                        : "Start a trip here"
                    }
                  />
                ))}
              </div>
            )}
            {recommendationData.comparison && <p className="recommendation-comparison">{recommendationData.comparison}</p>}
            {recommendationData.excluded?.length > 0 && (
              <details className="excluded-dropdown">
                <summary>
                  {requirementExclusions.length > 0 && (
                    <>{requirementExclusions.length} destination{requirementExclusions.length === 1 ? "" : "s"} excluded by your requirements</>
                  )}
                  {requirementExclusions.length > 0 && rankedOutCount > 0 && " · "}
                  {rankedOutCount > 0 && (
                    <>{rankedOutCount} more scored well but didn&apos;t make the top {recommendationData.results.length}</>
                  )}
                </summary>
                <ul className="excluded-list">
                  {recommendationData.excluded.map((item) => (
                    <li key={item.id}>
                      <div>
                        <strong>{item.name}</strong>
                        <span>{item.reason}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => selectExcluded(recommendationData.level, item)}
                        disabled={loading}
                      >
                        {recommendationData.level === "country" ? "Explore anyway" : "Plan a trip here"}
                      </button>
                    </li>
                  ))}
                </ul>
              </details>
            )}
            {error && <p className="recommendations-error">{error}</p>}
          </section>
        )}

        {stage === "landmarks" && (
          <section className="recommendations-results">
            <div className="results-heading">
              <div>
                <p className="recommendations-eyebrow"><Sparkles size={15} /> place recommendations</p>
                <h2>Things to do in {selectedCity?.name}</h2>
                <p>Pick a few to add straight into your new trip&apos;s itinerary.</p>
              </div>
              <button type="button" className="secondary-button" onClick={goBackFromLandmarks} disabled={loading}>
                <ChevronLeft size={17} /> Not this city
              </button>
            </div>
            <div className="landmark-toolbar">
              <label className="landmark-search">
                <Search size={15} />
                <input
                  type="text"
                  placeholder="Filter by name or area..."
                  value={landmarkFilter}
                  onChange={(event) => setLandmarkFilter(event.target.value)}
                />
              </label>
              <button type="button" className="secondary-button" onClick={autoPickLandmarks}>
                <Wand2 size={15} /> Pick top matches for me
              </button>
            </div>
            {landmarksData?.groups.map((group) => {
              const query = landmarkFilter.trim().toLowerCase();
              // Filter by text but keep each landmark's original index (the
              // selection key) stable, so hiding non-matching rows never
              // shifts which checkbox represents which landmark.
              const visible = group.landmarks
                .map((landmark, index) => ({ landmark, index }))
                .filter(
                  ({ landmark }) =>
                    !query ||
                    landmark.name.toLowerCase().includes(query) ||
                    landmark.address?.toLowerCase().includes(query)
                );
              return (
                <div key={group.interest} className="landmark-group">
                  <h4 className="interest-group-label">{formatDimension(group.interest)}</h4>
                  <p className="wizard-help">{group.explanation}</p>
                  {group.landmarks.length === 0 ? (
                    <p className="wizard-help">No {formatDimension(group.interest)} spots found nearby.</p>
                  ) : visible.length === 0 ? (
                    <p className="wizard-help">No matches for &quot;{landmarkFilter}&quot; in this group.</p>
                  ) : (
                    <div className="landmark-list">
                      {visible.map(({ landmark, index }) => {
                        // Keyed by position, not name - Geoapify sometimes
                        // returns several distinct places sharing the same
                        // display name (e.g. a city label repeated for
                        // several POIs geocoded to its center), and a
                        // name-based key collapsed all of them onto one
                        // checkbox state, so checking one appeared to check
                        // every same-named entry.
                        const key = `${group.interest}|${index}`;
                        const checked = selectedLandmarks.has(key);
                        // Coordinates, not name/address text - several distinct
                        // POIs can share the same geocoded label (see the
                        // duplicate-looking "Manila, 1000 Metro Manila..."
                        // rows), so only a pin at the real lat/lon actually
                        // tells them apart.
                        const mapUrl =
                          Number.isFinite(landmark.lat) && Number.isFinite(landmark.lon)
                            ? `https://www.google.com/maps/search/?api=1&query=${landmark.lat},${landmark.lon}`
                            : null;
                        return (
                          <label key={key} className={`landmark-item ${checked ? "selected" : ""}`}>
                            <input type="checkbox" checked={checked} onChange={() => toggleLandmark(key)} />
                            <span>
                              <strong>{landmark.name}</strong>
                              {landmark.address && <small>{landmark.address}</small>}
                              {landmark.opening_hours && <small>Hours: {landmark.opening_hours}</small>}
                            </span>
                            {mapUrl && (
                              <a
                                className="landmark-item-map"
                                href={mapUrl}
                                target="_blank"
                                rel="noreferrer"
                                onClick={(event) => event.stopPropagation()}
                                title="View this exact spot on the map"
                                aria-label={`View ${landmark.name} on the map`}
                              >
                                <MapPin size={14} />
                              </a>
                            )}
                          </label>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
            {error && <p className="recommendations-error">{error}</p>}
            <div className="wizard-actions">
              <button type="button" className="recommendations-submit" onClick={buildItinerary} disabled={loading}>
                Build my itinerary <ArrowRight size={17} />
              </button>
            </div>
          </section>
        )}

        {stage === "itinerary" && (
          <section className="recommendations-results">
            <div className="results-heading">
              <div>
                <p className="recommendations-eyebrow"><Sparkles size={15} /> your itinerary</p>
                <h2>Your day-by-day plan for {selectedCity?.name}</h2>
                <p>
                  {form.startDate && form.endDate
                    ? "Drag a stop to reorder it or move it to another day."
                    : `No trip dates were set, so this is a sample ${DEFAULT_TRIP_DAYS}-day plan - drag to reorder or move stops between days.`}
                </p>
              </div>
              <div className="results-heading-actions">
                <button
                  type="button"
                  className="secondary-button"
                  onClick={undoItineraryEdit}
                  disabled={itineraryHistory.length === 0}
                  title={itineraryHistory.length === 0 ? "No edits to undo" : "Undo the last change"}
                >
                  <Undo2 size={16} /> Undo
                </button>
                <button type="button" className="secondary-button" onClick={() => setStage("landmarks")} disabled={loading}>
                  <ChevronLeft size={17} /> Back to picks
                </button>
              </div>
            </div>

            <ItineraryMap itineraryDays={itineraryDays} />

            <div className="itinerary-days">
              {itineraryDays.map((day, dayIndex) => (
                <div
                  key={day.dayNumber}
                  className="itinerary-day"
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={() => {
                    if (dragStop) moveStop(dragStop, { dayIndex, stopIndex: day.stops.length });
                    setDragStop(null);
                  }}
                >
                  <div className="itinerary-day-header">
                    <h4 className="interest-group-label">
                      Day {day.dayNumber}
                      {isDayOverloaded(day.stops) && (
                        <span className="itinerary-day-warning" title="This day runs past a reasonable evening hour - consider moving a stop elsewhere.">
                          <AlertTriangle size={12} /> runs late
                        </span>
                      )}
                    </h4>
                    <button
                      type="button"
                      className="itinerary-day-remove"
                      onClick={() => removeDay(dayIndex)}
                      disabled={day.stops.length > 0 || itineraryDays.length <= 1}
                      title={day.stops.length > 0 ? "Remove this day's stops first" : "Remove this day"}
                      aria-label={`Remove Day ${day.dayNumber}`}
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                  {day.stops.length === 0 && <p className="wizard-help">No stops - drag one here.</p>}
                  {day.stops.map((stop, stopIndex) => {
                    const closed = isLikelyClosed(stop.landmark, stop.startTime);
                    return (
                      <div
                        key={`${stop.landmark.name}-${stopIndex}`}
                        className="itinerary-stop"
                        draggable
                        onDragStart={() => setDragStop({ dayIndex, stopIndex })}
                        onDragOver={(event) => event.preventDefault()}
                        onDrop={(event) => {
                          event.stopPropagation();
                          if (dragStop) moveStop(dragStop, { dayIndex, stopIndex });
                          setDragStop(null);
                        }}
                      >
                        <span className="itinerary-stop-time">{stop.startTime}</span>
                        <span className="itinerary-stop-name">
                          {stop.landmark.name}
                          {closed && (
                            <span className="itinerary-stop-warning" title={`Likely closed at ${stop.startTime} (hours: ${stop.landmark.opening_hours})`}>
                              <AlertTriangle size={12} /> may be closed
                            </span>
                          )}
                        </span>
                        <button
                          type="button"
                          className="itinerary-stop-remove"
                          onClick={() => removeStop(dayIndex, stopIndex)}
                          aria-label={`Remove ${stop.landmark.name}`}
                        >
                          <X size={14} />
                        </button>
                      </div>
                    );
                  })}
                </div>
              ))}
              <button type="button" className="itinerary-add-day" onClick={addDay}>
                <Plus size={16} /> Add a day
              </button>
            </div>

            {error && <p className="recommendations-error">{error}</p>}
            <div className="wizard-actions">
              <button type="button" className="recommendations-submit" onClick={saveItinerary} disabled={loading}>
                {loading ? <><LoaderCircle className="recommendations-spinner" size={18} /> Saving...</> : <>Save itinerary <ArrowRight size={17} /></>}
              </button>
            </div>
          </section>
        )}

        {stage === "done" && (
          <section className="recommendations-results">
            <p className="recommendations-eyebrow"><Check size={15} /> Trip created</p>
            <h2>Your trip to {selectedCity?.name} is ready.</h2>
            <p className="wizard-help">
              We saved {itineraryDays.reduce((sum, day) => sum + day.stops.length, 0)} stop{itineraryDays.reduce((sum, day) => sum + day.stops.length, 0) === 1 ? "" : "s"} across {itineraryDays.length} day{itineraryDays.length === 1 ? "" : "s"}.
            </p>
            <div className="wizard-actions">
              <Link to="/dashboard" className="secondary-button">Back to dashboard</Link>
              {trip?.id && (
                <Link to={`/trips/${trip.id}`} className="recommendations-submit">View itinerary <ArrowRight size={17} /></Link>
              )}
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
