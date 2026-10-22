import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Sparkles } from "lucide-react";

import ItineraryEditor from "../components/recommendations/ItineraryEditor.jsx";
import LandmarkPicker from "../components/recommendations/LandmarkPicker.jsx";
import PageShell from "../components/recommendations/PageShell.jsx";
import ResultsView from "../components/recommendations/ResultsView.jsx";
import TripDone from "../components/recommendations/TripDone.jsx";
import WizardView from "../components/recommendations/WizardView.jsx";
import {
  fetchRecommendationCatalog,
  fetchRecommendations,
  fetchLandmarks,
} from "../api/recommendations.js";
import { createTrip, addItineraryItem, deleteTrip } from "../api/trips.js";
import { useTripStore } from "../store/tripStore.js";
import { fetchMe } from "../api/account.js";

import { buildDayPlan, dayCapacity, daysNeeded, recomputeDayStopTimes, STOPS_PER_DAY_BY_PACE } from "../utils/itineraryPlanner.js";
import {
  COUNTRIES,
  ITINERARY_HISTORY_LIMIT,
  buildMemberPreferences,
  buildPreferences,
  cycleTagState,
  emptyTraveler,
  initialForm,
  resolveInterests,
  slugify,
  steps,
  TRIP_TEMPLATES,
  tripLengthDays,
} from "./recommendations/constants.js";

const MAX_SHORTLIST = 3;

export default function Recommendations() {
  // wizard -> collecting preferences
  // results -> ranked countries or cities
  // landmarks -> a city was chosen, pick stops for it
  // itinerary -> stops auto-sequenced into a day-by-day agenda, editable
  // done -> itinerary saved
  const [stage, setStage] = useState("wizard");
  const [step, setStep] = useState(0);
  // just you to start; picking a travel group on the first step brings in its
  // people (TripGroupPanel)
  const [form, setForm] = useState(initialForm);

  // the home currency saved in Settings
  useEffect(() => {
    fetchMe()
      .then((me) => {
        const currency = me?.preferences?.currency;
        if (currency) setForm((current) => ({ ...current, currency }));
      })
      .catch(() => {});
  }, []);
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
  const savedStopsRef = useRef(new Set()); // stops already saved, so a retry doesn't duplicate them
  // Stack of previous "results" views (country list before drilling into a
  // city, city list before picking one) so the back button can restore them
  // without an extra fetch. Empty means the only way back is the wizard.
  const [resultsHistory, setResultsHistory] = useState([]);
  const [dislikedIds, setDislikedIds] = useState([]); // "not quite right" picks, sent as exclude_ids
  const [shortlist, setShortlist] = useState([]); // up to MAX_SHORTLIST results to compare

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
    setForm((current) => ({ ...current, travelers: [...current.travelers, emptyTraveler()] }));
  };

  // one traveller's own budget/access/climate/pace - "" means they defer to
  // the group, so it's left out of the request entirely
  const updateTraveler = (travelerId, field, value) => {
    setForm((current) => ({
      ...current,
      travelers: current.travelers.map((traveler) =>
        traveler.id === travelerId ? { ...traveler, [field]: value } : traveler
      ),
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

  const toggleTravelerDealbreaker = (travelerId, tagId) => {
    setForm((current) => ({
      ...current,
      travelers: current.travelers.map((traveler) => {
        if (traveler.id !== travelerId) return traveler;
        const list = traveler.dealbreakers || [];
        return { ...traveler, dealbreakers: list.includes(tagId) ? list.filter((tag) => tag !== tagId) : [...list, tagId] };
      }),
    }));
  };

  // A template from the trips page fills the form and drops the user on the
  // review step, so they land on something they can check and change rather
  // than straight into results they didn't ask for.
  const [searchParams, setSearchParams] = useSearchParams();
  useEffect(() => {
    const start = searchParams.get("start");
    const end = searchParams.get("end");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(start || "") || !/^\d{4}-\d{2}-\d{2}$/.test(end || "")) return;
    setForm((current) => ({ ...current, startDate: start, endDate: end }));
    setSearchParams({}, { replace: true });
  }, [searchParams, setSearchParams]);

  useEffect(() => {
    const templateId = searchParams.get("template");
    if (!templateId) return;

    const template = TRIP_TEMPLATES.find((item) => item.id === templateId);
    if (template) {
      setForm((current) => ({
        ...current,
        country: template.country,
        budget: template.budget,
        climate: template.climate,
        pace: template.pace,
        interests: template.interests,
        priorityInterests: template.priorityInterests,
        ...(template.wheelchair ? { wheelchair: template.wheelchair } : {}),
      }));
      setStep(steps.length - 1);
    }
    // drop the param so a later reload or back-navigation doesn't re-apply it
    // over edits the user has since made
    setSearchParams({}, { replace: true });
  }, [searchParams, setSearchParams]);

  const applyPreset = (preset) => {
    setForm((current) => ({
      ...current,
      interests: preset.interests,
      priorityInterests: preset.priorityInterests,
      pace: preset.pace,
      // never overwrite ages the traveller has already typed
      children: preset.children && !current.children.trim() ? preset.children : current.children,
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

  const submitRecommendations = async (level, parentId, country = null, excludeIds = dislikedIds) => {
    const requestId = ++requestIdRef.current;
    setLoading(true);
    setError("");
    try {
      const data = await fetchRecommendations(
        buildPreferences(form),
        level,
        parentId,
        excludeIds,
        buildMemberPreferences(form)
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
    setDislikedIds([]);
    setShortlist([]);
    await submitRecommendations(
      form.mode === "global" ? "country" : "city",
      form.mode === "country" ? slugify(form.country) : undefined,
      form.mode === "country" ? { id: slugify(form.country), name: form.country } : null,
      []
    );
  };

  const toggleShortlist = (recommendation) =>
    setShortlist((current) =>
      current.some((item) => item.id === recommendation.id)
        ? current.filter((item) => item.id !== recommendation.id)
        : current.length < MAX_SHORTLIST ? [...current, recommendation] : current
    );

  // Re-ask the engine with this destination left out, so the slot it held is
  // refilled by the next best match instead of just shrinking the list.
  const notQuiteRight = (recommendation) => {
    const excludeIds = [...dislikedIds, recommendation.id];
    setDislikedIds(excludeIds);
    setShortlist((current) => current.filter((item) => item.id !== recommendation.id));
    const level = recommendationData.level;
    return submitRecommendations(level, level === "city" ? selectedCountry?.id : undefined, selectedCountry, excludeIds);
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

  // Bare city names are ambiguous ("Lima" alone geocodes to Lima, Ohio as
  // easily as Lima, Peru) - include the country we already know from the
  // recommendation so /landmarks searches the right place.
  const destinationLabelFor = (city) => (city.country ? `${city.name}, ${city.country}` : city.name);

  // Picking a city ends the exploratory part of the flow: load landmarks
  // matching the user's specific interest tags so they can build the first
  // itinerary stops right here. The trip itself is only created on save, so
  // backing out (or closing the tab) never leaves an empty trip behind.
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
      const landmarks = await fetchLandmarks(destinationLabelFor(city), resolveInterests(form).interests);
      if (requestId !== requestIdRef.current) return;
      setResultsHistory((current) => [
        ...current,
        { data: recommendationData, selectedCountry },
      ]);
      setTrip(null);
      setSelectedCity(city);
      setLandmarksData(landmarks);
      setSelectedLandmarks(new Set());
      setStage("landmarks");
    } catch (requestError) {
      if (requestId !== requestIdRef.current) return;
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Could not load places for this city. Please try again."
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

  // Leaving the landmarks step abandons this city. If a save already created
  // the trip (a partial save, then "Back"), delete it so no half-built draft
  // trip is left behind.
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

  const landmarkAt = (key) => {
    const [interest, index] = key.split("|");
    return landmarksData?.groups.find((group) => group.interest === interest)?.landmarks[Number(index)];
  };
  const sameName = (a, b) => a?.name?.trim().toLowerCase() === b?.name?.trim().toLowerCase();

  const toggleLandmark = (key) => {
    // one place often matches two interests (a park that's also a historic site)
    const landmark = landmarkAt(key);
    if (
      !selectedLandmarks.has(key) &&
      [...selectedLandmarks].some((other) => sameName(landmarkAt(other), landmark)) &&
      !window.confirm(`${landmark.name} is already in your plan. Add it again?`)
    ) {
      return;
    }
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
  // (what the trip's days hold at this pace), taking its first N landmarks - groups are
  // already sorted by distance, so this is "the closest matches per interest",
  // not a random sample. Replaces the current selection rather than adding to
  // it, so re-running it after manual tweaks gives a predictable result.
  const familyFriendly = !form.preciseStops && form.children.trim().length > 0;

  const autoPickLandmarks = () => {
    if (!landmarksData?.groups?.length) return;
    const target = dayCapacity(tripLengthDays(form), form.pace, familyFriendly);
    const perGroup = Math.max(1, Math.round(target / landmarksData.groups.length));
    const next = new Set();
    const names = new Set(); // never the same place twice
    landmarksData.groups.forEach((group) => {
      let taken = 0;
      group.landmarks.forEach((landmark, index) => {
        const name = landmark.name?.trim().toLowerCase();
        if (taken >= perGroup || names.has(name)) return;
        names.add(name);
        next.add(`${group.interest}|${index}`);
        taken += 1;
      });
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
        familyFriendly,
      })
    );
    setItineraryHistory([]);
    savedStopsRef.current = new Set();
    setStage("itinerary");
  };

  // Snapshots the itinerary right before a mutating edit so "Undo" can
  // restore it. Called at the start of every edit handler below, capped so a
  // long editing session doesn't grow this without bound.
  const snapshotItinerary = () => {
    setItineraryHistory((current) => [...current.slice(-(ITINERARY_HISTORY_LIMIT - 1)), itineraryDays]);
  };

  const undoItineraryEdit = () => {
    if (itineraryHistory.length === 0) return;
    setItineraryDays(itineraryHistory[itineraryHistory.length - 1]);
    setItineraryHistory(itineraryHistory.slice(0, -1));
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
        // kept so the saved trip can be mapped later, not just this session
        lat: Number.isFinite(landmark.lat) ? landmark.lat : undefined,
        lon: Number.isFinite(landmark.lon) ? landmark.lon : undefined,
      }))
    );
    // allSettled instead of all - one failed stop shouldn't hide whether the
    // other N-1 actually saved, and it lets the user see exactly how much
    // landed instead of an all-or-nothing error with no way to tell.
    const keyOf = (job) => `${job.dayNumber}|${job.startTime}|${job.title}`;
    const pending = jobs.filter((job) => !savedStopsRef.current.has(keyOf(job)));
    // created on the first save; a retry after a partial failure reuses it
    let savedTrip = trip;
    if (!savedTrip) {
      try {
        savedTrip = await createTrip({
          title: `${selectedCity.name} Trip`,
          destination: destinationLabelFor(selectedCity),
          budget: Number(form.budget) * tripLengthDays(form),
          startDate: form.startDate || undefined,
          endDate: form.endDate || undefined,
          // kept on the trip so the hub, budget and translator don't ask again
          currency: form.currency.toUpperCase(),
          travellers: { adults: Number(form.adults), childAges: buildPreferences(form).travellers.children.filter((age) => age <= 17) },
          interests: resolveInterests(form).interests,
          travelGroupId: form.travelGroupId || undefined,
        });
        setTrip(savedTrip);
        // the new trip becomes the one the rest of the app is about
        useTripStore.getState().setActiveTrip(savedTrip.id);
        useTripStore.getState().load(true);
      } catch (requestError) {
        setLoading(false);
        setError(requestError instanceof Error ? requestError.message : "Could not create this trip. Please try again.");
        return;
      }
    }
    const outcomes = await Promise.allSettled(
      pending.map((job) => addItineraryItem(savedTrip.id, job).then(() => savedStopsRef.current.add(keyOf(job))))
    );
    const failedCount = outcomes.filter((outcome) => outcome.status === "rejected").length;
    setLoading(false);
    if (failedCount === 0) {
      setStage("done");
      return;
    }
    // Stay on this screen so the user can retry; only unsaved stops are re-sent.
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

  const hero =
    stage === "wizard" ? (
      <>
        <p className="recommendations-eyebrow"><Sparkles size={15} /> Personalised travel planning</p>
        <h1>Plan a trip that feels made for you.</h1>
        <p>Answer four quick steps. We&apos;ll explain why each country or city matches your group.</p>
      </>
    ) : null;

  return (
    <PageShell hero={hero}>
      {stage === "wizard" && (
        <WizardView
          step={step}
          setStep={setStep}
          error={error}
          setError={setError}
          loading={loading}
          onNext={handleNext}
          form={form}
          updateForm={updateForm}
          countries={countries}
          applyPreset={applyPreset}
          cycleInterest={cycleInterest}
          cycleTravelerInterest={cycleTravelerInterest}
          addTraveler={addTraveler}
          removeTraveler={removeTraveler}
          updateTraveler={updateTraveler}
          toggleDealbreaker={toggleDealbreaker}
          toggleTravelerDealbreaker={toggleTravelerDealbreaker}
          togglePreciseStops={togglePreciseStops}
          updateDayStopCount={updateDayStopCount}
        />
      )}

      {stage === "results" && recommendationData && (
        <ResultsView
          data={recommendationData}
          title={resultTitle}
          historyCount={resultsHistory.length}
          loading={loading}
          error={error}
          exploreCities={exploreCities}
          selectCity={selectCity}
          selectExcluded={selectExcluded}
          goBack={goBackToResults}
          startOver={editPreferences}
          editPreferences={editPreferences}
          requirementExclusions={requirementExclusions}
          rankedOutCount={rankedOutCount}
          relaxSuggestions={relaxSuggestions}
          travelMonth={form.startDate ? new Date(form.startDate).getMonth() + 1 : null}
          shortlist={shortlist}
          toggleShortlist={toggleShortlist}
          notQuiteRight={notQuiteRight}
          maxShortlist={MAX_SHORTLIST}
        />
      )}

      {stage === "landmarks" && (
        <LandmarkPicker
          cityName={selectedCity?.name}
          landmarksData={landmarksData}
          selectedLandmarks={selectedLandmarks}
          toggleLandmark={toggleLandmark}
          filter={landmarkFilter}
          setFilter={setLandmarkFilter}
          autoPick={autoPickLandmarks}
          onBuild={buildItinerary}
          onBack={goBackFromLandmarks}
          loading={loading}
          error={error}
          daysNeeded={daysNeeded(selectedLandmarks.size, form.pace, familyFriendly)}
          tripDays={tripLengthDays(form)}
        />
      )}

      {stage === "itinerary" && (
        <ItineraryEditor
          cityName={selectedCity?.name}
          days={itineraryDays}
          hasDates={Boolean(form.startDate && form.endDate)}
          canUndo={itineraryHistory.length > 0}
          loading={loading}
          error={error}
          undo={undoItineraryEdit}
          back={() => setStage("landmarks")}
          addDay={addDay}
          removeDay={removeDay}
          removeStop={removeStop}
          moveStop={moveStop}
          dragStop={dragStop}
          setDragStop={setDragStop}
          onSave={saveItinerary}
        />
      )}

      {stage === "done" && <TripDone cityName={selectedCity?.name} tripId={trip?.id} days={itineraryDays} />}
    </PageShell>
  );
}
