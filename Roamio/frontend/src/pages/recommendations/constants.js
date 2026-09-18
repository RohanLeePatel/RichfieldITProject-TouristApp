// Pure constants + helpers for the recommendation wizard/itinerary flow -
// no React, no state. Split out of Recommendations.jsx so the page only
// holds state/handlers and the components only render.

// Specific tags the user can pick, grouped under the 4 broad dimensions the
// scoring engine actually knows about (engine/weights.py). The broad group
// key is what gets sent as `preferences.interests`; the specific tag ids are
// what get passed straight through to /landmarks once a city is chosen.
export const INTEREST_GROUPS = [
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

export const PACE_OPTIONS = [
  { id: "relaxed", label: "Relaxed", helper: "~2 stops a day" },
  { id: "balanced", label: "Balanced", helper: "~3 stops a day" },
  { id: "packed", label: "Packed", helper: "~5 stops a day" },
];

// One-click starting points - fills interests/priority/pace so a group
// doesn't have to build every trip from a blank wizard.
export const TRIP_PRESETS = [
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

export const COUNTRIES = [
  "Argentina", "Australia", "Brazil", "Canada", "Egypt", "France",
  "Germany", "Italy", "Japan", "Kenya", "Mexico", "Namibia", "Netherlands",
  "Portugal", "Singapore", "South Africa", "Spain", "Thailand",
  "United Arab Emirates", "United Kingdom", "United States",
];

export const DEFAULT_TRIP_DAYS = 3;
export const ITINERARY_HISTORY_LIMIT = 20;

export const initialForm = {
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

export const steps = ["Trip basics", "Interests", "Accessibility & climate", "Review"];

export function slugify(value) {
  return value.toLowerCase().replace(/\s+/g, "-");
}

export function formatDimension(value) {
  return value.replace(/_/g, " ");
}

// Inclusive day count between two yyyy-mm-dd dates, or DEFAULT_TRIP_DAYS if
// either is missing - the itinerary planner always needs a day count to work
// with, even before real dates are set.
export function tripLengthDays(form) {
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
export function cycleTagState(state, tagId) {
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
export function blendTravelerInterests(form) {
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
export function resolveInterests(form) {
  const { interests, priority_interests } = blendTravelerInterests(form);
  const dealbreakers = new Set(allDealbreakers(form));
  return {
    interests: interests.filter((tag) => !dealbreakers.has(tag)),
    priority_interests: priority_interests.filter((tag) => !dealbreakers.has(tag)),
  };
}

export function buildPreferences(form) {
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

// "Balanced" normally, or "Precise (3 - 2 - 4 stops)" once per-day counts are on.
export function paceLabel(form) {
  if (form.preciseStops) return `Precise (${form.dayStopCounts.join(" - ")} stops)`;
  return PACE_OPTIONS.find((option) => option.id === form.pace)?.label;
}

export const ACCESSIBILITY_LABELS = {
  none: "No specific need",
  preferred: "Wheelchair preferred",
  required: "Wheelchair required",
};

// The organizer's avoid list plus every added traveler's - one person's
// "please not" applies to the whole group, same rule as before.
export function allDealbreakers(form) {
  return [...new Set([...form.dealbreakers, ...form.travelers.flatMap((t) => t.dealbreakers || [])])];
}
