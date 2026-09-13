import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronLeft,
  ExternalLink,
  LoaderCircle,
  MapPin,
  Plane,
  Sparkles,
} from "lucide-react";
import { Link } from "react-router-dom";

import {
  fetchRecommendationCatalog,
  fetchRecommendations,
  fetchLandmarks,
} from "../api/recommendations.js";
import { createTrip, addItineraryItem, deleteTrip } from "../api/trips.js";
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

const TAG_TO_GROUP = Object.fromEntries(
  INTEREST_GROUPS.flatMap((group) =>
    group.tags.map((tag) => [tag.id, group.key])
  )
);

const COUNTRIES = [
  "Argentina", "Australia", "Brazil", "Canada", "Egypt", "France",
  "Germany", "Italy", "Japan", "Kenya", "Mexico", "Namibia", "Netherlands",
  "Portugal", "Singapore", "South Africa", "Spain", "Thailand",
  "United Arab Emirates", "United Kingdom", "United States",
];

const initialForm = {
  mode: "global",
  country: "South Africa",
  budget: "1000",
  currency: "ZAR",
  month: "",
  interests: ["parks", "restaurants"],
  adults: "2",
  children: "",
  wheelchair: "none",
  climate: "",
};

const steps = ["Trip basics", "Interests", "Accessibility & climate", "Review"];

function slugify(value) {
  return value.toLowerCase().replace(/\s+/g, "-");
}

function formatDimension(value) {
  return value.replace(/_/g, " ");
}

function buildPreferences(form) {
  const children = form.children
    ? form.children
        .split(",")
        .map((age) => Number(age.trim()))
        .filter((age) => Number.isInteger(age) && age >= 0)
    : [];

  const broadInterests = [
    ...new Set(form.interests.map((tag) => TAG_TO_GROUP[tag]).filter(Boolean)),
  ];

  return {
    budget_per_day: Number(form.budget),
    currency: form.currency.toUpperCase(),
    interests: broadInterests,
    travellers: { adults: Number(form.adults), children },
    accessibility: { wheelchair: form.wheelchair },
    climate: {
      ...(form.climate ? { prefer: form.climate } : {}),
      ...(form.month ? { travel_month: Number(form.month) } : {}),
    },
  };
}

function RecommendationCard({ recommendation, onSelect, selectLabel }) {
  const destinationName = recommendation.name || recommendation.id;
  const mapUrl =
    recommendation.map_url ||
    `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
      destinationName
    )}`;
  const evidence = recommendation.breakdown
    ?.filter((entry) => entry.weight > 0)
    .slice(0, 4);

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
          {evidence?.map((entry) => (
            <span key={entry.dimension}>
              <Check size={13} />
              {formatDimension(entry.dimension)}
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

export default function Recommendations() {
  // wizard -> collecting preferences
  // results -> ranked countries or cities
  // landmarks -> a trip was created for the chosen city, pick stops for it
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

  const toggleInterest = (tagId) => {
    setForm((current) => ({
      ...current,
      interests: current.interests.includes(tagId)
        ? current.interests.filter((item) => item !== tagId)
        : [...current.interests, tagId],
    }));
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
        budget: Number(form.budget) * 7,
      });
      const landmarks = await fetchLandmarks(destinationLabel, form.interests);
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

  const finishTrip = async () => {
    setLoading(true);
    setError("");
    try {
      const chosen = [];
      landmarksData?.groups.forEach((group) => {
        group.landmarks.forEach((landmark) => {
          if (selectedLandmarks.has(`${group.interest}|${landmark.name}`)) {
            chosen.push(landmark);
          }
        });
      });

      await Promise.all(
        chosen.map((landmark) =>
          addItineraryItem(trip.id, {
            title: landmark.name,
            location: landmark.address || undefined,
          })
        )
      );
      setStage("done");
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Could not save your itinerary. Please try again."
      );
    } finally {
      setLoading(false);
    }
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
                    <label className="wizard-field">Travel month<select value={form.month} onChange={(event) => updateForm("month", event.target.value)}><option value="">Any month</option>{Array.from({ length: 12 }, (_, index) => <option key={index + 1} value={index + 1}>{new Date(2024, index, 1).toLocaleString("en", { month: "long" })}</option>)}</select></label>
                  </div>
                </>
              )}

              {step === 1 && (
                <>
                  <h2>What do you enjoy?</h2>
                  <p className="wizard-help">Pick everything that should influence your ranking - the more specific, the better your match.</p>
                  {INTEREST_GROUPS.map((group) => (
                    <div key={group.key} className="interest-group">
                      <h4 className="interest-group-label">{group.label}</h4>
                      <div className="interest-list">
                        {group.tags.map((tag) => (
                          <button
                            type="button"
                            className={`interest-option ${form.interests.includes(tag.id) ? "selected" : ""}`}
                            key={tag.id}
                            onClick={() => toggleInterest(tag.id)}
                          >
                            {form.interests.includes(tag.id) && <Check size={14} />} {tag.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
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
                    <div><span>Interests</span><strong>{form.interests.map((tag) => formatDimension(tag)).join(", ")}</strong></div>
                    <div><span>Climate</span><strong>{form.climate || "Any climate"}</strong></div>
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
                <ul>{relaxSuggestions.map((item) => <li key={item.id}>{item.id}: {item.reason}</li>)}</ul>
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
            {requirementExclusions.length > 0 && <p className="recommendation-excluded">{requirementExclusions.length} destination{requirementExclusions.length === 1 ? "" : "s"} were excluded by your requirements.</p>}
            {rankedOutCount > 0 && <p className="recommendation-excluded">{rankedOutCount} more scored well too, but only the top {recommendationData.results.length} are shown.</p>}
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
            {landmarksData?.groups.map((group) => (
              <div key={group.interest} className="landmark-group">
                <h4 className="interest-group-label">{formatDimension(group.interest)}</h4>
                <p className="wizard-help">{group.explanation}</p>
                {group.landmarks.length === 0 ? (
                  <p className="wizard-help">No {formatDimension(group.interest)} spots found nearby.</p>
                ) : (
                  <div className="landmark-list">
                    {group.landmarks.map((landmark) => {
                      const key = `${group.interest}|${landmark.name}`;
                      const checked = selectedLandmarks.has(key);
                      return (
                        <label key={key} className={`landmark-item ${checked ? "selected" : ""}`}>
                          <input type="checkbox" checked={checked} onChange={() => toggleLandmark(key)} />
                          <span>
                            <strong>{landmark.name}</strong>
                            {landmark.address && <small>{landmark.address}</small>}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>
            ))}
            {error && <p className="recommendations-error">{error}</p>}
            <div className="wizard-actions">
              <button type="button" className="recommendations-submit" onClick={finishTrip} disabled={loading}>
                {loading ? <><LoaderCircle className="recommendations-spinner" size={18} /> Saving...</> : <>Add to trip & finish <ArrowRight size={17} /></>}
              </button>
            </div>
          </section>
        )}

        {stage === "done" && (
          <section className="recommendations-results">
            <p className="recommendations-eyebrow"><Check size={15} /> Trip created</p>
            <h2>Your trip to {selectedCity?.name} is ready.</h2>
            <p className="wizard-help">
              We saved {selectedLandmarks.size} stop{selectedLandmarks.size === 1 ? "" : "s"} to your itinerary. You can keep adding to it from the dashboard.
            </p>
            <div className="wizard-actions">
              <Link to="/dashboard" className="recommendations-submit">Back to dashboard <ArrowRight size={17} /></Link>
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
