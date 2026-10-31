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

// The same tags as one flat list - the trip hub's place search and the
// Travel Group's interests use these too, so everyone picks from one vocabulary.
export const INTEREST_TAGS = INTEREST_GROUPS.flatMap((group) => group.tags);

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
    // The one preset explicitly about children left the ages field empty, so
    // none of the age-band scoring ever ran for it. A starting point, not an
    // assumption: applyPreset fills it only while the field is untouched, and
    // it lands in an input the traveller can see and edit.
    children: "6, 9",
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

// Destination-led starting points, browsable from the trips page. A preset
// (above) only sets interests and pace inside the wizard; a template also
// picks the country, budget and climate, so a group can start from a whole
// shape of trip instead of a blank form.
//
// Deliberately no hard-coded stops: the template sets preferences and the
// normal pipeline (ranking -> /landmarks -> itinerary planner) fills in real
// places with real coordinates. Canned stop lists would go stale and could
// not be mapped.
export const TRIP_TEMPLATES = [
  {
    id: "cape-town-weekend",
    label: "Cape Town long weekend",
    blurb: "Museums and the waterfront food scene at an easy pace.",
    country: "South Africa",
    budget: "1200",
    climate: "mild",
    pace: "balanced",
    interests: ["historic_sites", "museums", "restaurants", "cafes"],
    priorityInterests: ["historic_sites"],
  },
  {
    id: "kids-first-beach",
    label: "Kids-first beach week",
    blurb: "Short days, playgrounds and somewhere to swim.",
    country: "Thailand",
    budget: "900",
    climate: "hot",
    pace: "relaxed",
    interests: ["beaches", "playgrounds", "zoos_aquariums", "restaurants"],
    priorityInterests: ["beaches", "playgrounds"],
  },
  {
    id: "culture-deep-dive",
    label: "Culture deep dive",
    blurb: "Packed days of museums, historic sites and street food.",
    country: "Japan",
    budget: "2200",
    climate: "mild",
    pace: "packed",
    interests: ["museums", "historic_sites", "street_food", "cafes"],
    priorityInterests: ["museums"],
  },
  {
    id: "hiking-escape",
    label: "Hiking and parks escape",
    blurb: "Trails and open country, with somewhere to eat afterwards.",
    country: "Namibia",
    budget: "1100",
    climate: "mild",
    pace: "balanced",
    interests: ["hiking", "parks", "restaurants"],
    priorityInterests: ["hiking"],
  },
  {
    id: "food-first",
    label: "Food-first city break",
    blurb: "Built around markets, cafes and long dinners.",
    country: "Italy",
    budget: "1600",
    climate: "mild",
    pace: "balanced",
    interests: ["restaurants", "cafes", "street_food", "historic_sites"],
    priorityInterests: ["restaurants", "street_food"],
  },
  {
    id: "step-free-city",
    label: "Step-free city break",
    blurb: "Flat, well-served cities with step-free attractions.",
    country: "Netherlands",
    budget: "1800",
    climate: "mild",
    pace: "relaxed",
    wheelchair: "required",
    interests: ["museums", "cafes", "parks"],
    priorityInterests: [],
  },
];

export const COUNTRIES = [
  "Argentina", "Australia", "Brazil", "Canada", "Egypt", "France",
  "Germany", "Italy", "Japan", "Kenya", "Mexico", "Namibia", "Netherlands",
  "Portugal", "Singapore", "South Africa", "Spain", "Thailand",
  "United Arab Emirates", "United Kingdom", "United States",
];

// Offered in the wizard's currency picker. The engine converts any ISO 4217
// code through fastFOREX, so this list is about keeping travellers out
// of a late 422 rather than a limit on what is supported.
export const CURRENCIES = ["ZAR", "USD", "EUR", "GBP", "AUD", "CAD", "AED", "INR", "JPY", "KES"];

export const DEFAULT_TRIP_DAYS = 3;
// the engine needs a spread of interests to rank anything; avoided ones don't count
export const MIN_INTERESTS = 3;
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
  // additional travelers' own picks and constraints, sent as
  // `member_preferences` and merged by the engine (engine/group.py).
  // Session-only, see the TODO(db) note on blendTravelerInterests().
  travelers: [],
  adults: "1", // "Just me" is the default, and locks this to 1
  children: "",
  wheelchair: "none",
  climate: "",
  pace: "balanced",
  // "precise" mode: an explicit stop count per day instead of the pace
  // default. dayStopCounts[i] is the count for day i+1.
  preciseStops: false,
  dayStopCounts: [],
};

// A traveler's own constraints. "" means "no view of their own, use the
// group's" - only the ones actually set get sent, so an untouched traveler
// never drags the merge around.
export const emptyTraveler = () => ({
  id: Date.now() + Math.random(),
  name: "",
  interests: [],
  priorityInterests: [],
  dealbreakers: [],
  budget: "",
  wheelchair: "",
  climate: "",
  pace: "",
});

// The wizard's group from a list of companions (a travel group's people
// without an account): you plus each adult, children's
// ages where the page has them, and each member's interests as a traveller of
// their own so the engine can merge them. Members store interest labels
// ("Beaches"); the wizard works in tag ids ("beaches").
export function groupFromFamily(members) {
  const list = Array.isArray(members) ? members : [];
  const idFor = (label) => INTEREST_TAGS.find((tag) => tag.label === label)?.id;
  const ages = list
    .filter((member) => member.type === "Child" && member.age !== "" && member.age != null)
    .map((member) => Number(member.age))
    .filter((age) => Number.isInteger(age) && age >= 0);
  return {
    adults: String(1 + list.filter((member) => member.type !== "Child").length),
    children: ages.join(", "),
    travelers: list
      .map((member) => ({ ...emptyTraveler(), name: member.name || "", interests: (member.interests || []).map(idFor).filter(Boolean) }))
      .filter((traveler) => traveler.interests.length > 0),
  };
}

// The wizard's group step for a travel group: you, its other members (adults
// with an account - their interests aren't stored, so none are assumed) and
// its companions (people without an account, with their interests).
export function groupFromTravelGroup(group) {
  const base = groupFromFamily(group?.companions);
  const otherMembers = Math.max(0, (group?.members?.length || 1) - 1);
  return { ...base, adults: String(Number(base.adults) + otherMembers) };
}

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

  const { interests } = resolveInterests(form);
  const { priority_interests } = blendTravelerInterests(form);
  const startMonth = form.startDate ? new Date(form.startDate).getMonth() + 1 : null;
  const endMonth = form.endDate ? new Date(form.endDate).getMonth() + 1 : null;

  return {
    budget_per_day: Number(form.budget),
    currency: form.currency.toUpperCase(),
    interests,
    priority_interests,
    // the organiser's own "please not" list; the engine pools everyone's
    avoid_interests: form.dealbreakers,
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
// One Preferences object per traveler who set a constraint of their own, for
// the request's `member_preferences`. The engine merges these with the
// organiser's (engine/group.py): tightest budget, strictest access need,
// majority climate/pace, pooled interests.
//
// Travelers who only picked interests are left out - blendTravelerInterests()
// already folds those into the organiser's set, and sending a member with no
// constraints would only add noise to the merge notes.
export function buildMemberPreferences(form) {
  const base = buildPreferences(form);
  const dealbreakers = new Set(allDealbreakers(form));

  return form.travelers
    .filter(
      (traveler) =>
        traveler.budget ||
        traveler.wheelchair ||
        traveler.climate ||
        traveler.pace ||
        // someone whose only input was "not this" still has to reach the
        // engine, or their dealbreaker is attributed to the organiser
        traveler.dealbreakers?.length ||
        traveler.name?.trim()
    )
    .map((traveler) => ({
      ...base,
      label: traveler.name?.trim() || undefined,
      budget_per_day: traveler.budget ? Number(traveler.budget) : base.budget_per_day,
      interests: traveler.interests.filter((tag) => !dealbreakers.has(tag)),
      priority_interests: traveler.priorityInterests,
      avoid_interests: traveler.dealbreakers || [],
      accessibility: { wheelchair: traveler.wheelchair || base.accessibility.wheelchair },
      climate: { ...base.climate, ...(traveler.climate ? { prefer: traveler.climate } : {}) },
      pace: traveler.pace || base.pace,
    }));
}

export function allDealbreakers(form) {
  return [...new Set([...form.dealbreakers, ...form.travelers.flatMap((t) => t.dealbreakers || [])])];
}
