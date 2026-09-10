import { useMemo, useState } from "react";
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

import { fetchRecommendations } from "../api/recommendations.js";
import "../styles/recommendations.css";

const INTERESTS = ["history", "nature", "food", "family"];
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
  interests: ["nature", "food"],
  adults: "2",
  children: "",
  wheelchair: "none",
  climate: "",
  pace: "balanced",
};

const steps = ["Trip basics", "Interests", "Accessibility & pace", "Review"];

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

  return {
    budget_per_day: Number(form.budget),
    currency: form.currency.toUpperCase(),
    interests: form.interests,
    travellers: { adults: Number(form.adults), children },
    accessibility: { wheelchair: form.wheelchair },
    climate: {
      ...(form.climate ? { prefer: form.climate } : {}),
      ...(form.month ? { travel_month: Number(form.month) } : {}),
    },
    pace: form.pace,
  };
}

function RecommendationCard({ recommendation, onSelect }) {
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
              Explore cities <ArrowRight size={14} />
            </button>
          )}
        </div>
      </div>
    </article>
  );
}

export default function Recommendations() {
  const [step, setStep] = useState(0);
  const [form, setForm] = useState(initialForm);
  const [recommendationData, setRecommendationData] = useState(null);
  const [selectedCountry, setSelectedCountry] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const updateForm = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }));
    setError("");
  };

  const toggleInterest = (interest) => {
    setForm((current) => ({
      ...current,
      interests: current.interests.includes(interest)
        ? current.interests.filter((item) => item !== interest)
        : [...current.interests, interest],
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

  const submitRecommendations = async (level, parentId) => {
    setLoading(true);
    setError("");
    try {
      const data = await fetchRecommendations(
        buildPreferences(form),
        level,
        parentId
      );
      setRecommendationData(data);
      setSelectedCountry(null);
    } catch (requestError) {
      setRecommendationData(null);
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Recommendations are currently unavailable."
      );
    } finally {
      setLoading(false);
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
    await submitRecommendations(
      form.mode === "global" ? "country" : "city",
      form.mode === "country" ? slugify(form.country) : undefined
    );
  };

  const exploreCities = async (country) => {
    setSelectedCountry(country);
    await submitRecommendations("city", country.id);
  };

  const resultTitle = recommendationData?.level === "country"
    ? "Countries that fit your trip"
    : `Cities in ${selectedCountry?.name || form.country}`;
  const relaxSuggestions = useMemo(
    () => recommendationData?.excluded?.slice(0, 3) || [],
    [recommendationData]
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
        {!recommendationData && (
          <section className="recommendations-intro">
            <p className="recommendations-eyebrow">
              <Sparkles size={15} /> Personalised travel planning
            </p>
            <h1>Plan a trip that feels made for you.</h1>
            <p>Answer four quick steps. We&apos;ll explain why each country or city matches your group.</p>
          </section>
        )}

        {!recommendationData && (
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
                        {COUNTRIES.map((country) => <option key={country} value={country}>{country}</option>)}
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
                  <p className="wizard-help">Pick the interests that should influence your ranking.</p>
                  <div className="interest-list">
                    {INTERESTS.map((interest) => (
                      <button type="button" className={`interest-option ${form.interests.includes(interest) ? "selected" : ""}`} key={interest} onClick={() => toggleInterest(interest)}>
                        {form.interests.includes(interest) && <Check size={14} />} {interest}
                      </button>
                    ))}
                  </div>
                </>
              )}

              {step === 2 && (
                <>
                  <h2>Make it work for your group.</h2>
                  <p className="wizard-help">These preferences help the engine avoid unsuitable matches.</p>
                  <div className="field-grid wizard-fields">
                    <label className="wizard-field">Accessibility<select value={form.wheelchair} onChange={(event) => updateForm("wheelchair", event.target.value)}><option value="none">No specific need</option><option value="preferred">Wheelchair preferred</option><option value="required">Wheelchair required</option></select></label>
                    <label className="wizard-field">Climate<select value={form.climate} onChange={(event) => updateForm("climate", event.target.value)}><option value="">No preference</option><option value="mild">Mild</option><option value="hot">Hot</option><option value="cold">Cold</option></select></label>
                    <label className="wizard-field">Travel pace<select value={form.pace} onChange={(event) => updateForm("pace", event.target.value)}><option value="relaxed">Relaxed</option><option value="balanced">Balanced</option><option value="packed">Packed</option></select></label>
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
                    <div><span>Interests</span><strong>{form.interests.join(", ")}</strong></div>
                    <div><span>Style</span><strong>{form.pace}, {form.climate || "any climate"}</strong></div>
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

        {recommendationData && (
          <section className="recommendations-results">
            <div className="results-heading">
              <div>
                <p className="recommendations-eyebrow"><MapPin size={15} /> {recommendationData.level} recommendations</p>
                <h2>{resultTitle}</h2>
                <p>Ranked using your saved preferences. You can edit them and search again.</p>
              </div>
              <button type="button" className="secondary-button" onClick={() => { setRecommendationData(null); setStep(0); }}><ChevronLeft size={17} /> Edit preferences</button>
            </div>
            {recommendationData.results.length === 0 ? (
              <div className="results-empty">
                <h3>No exact matches yet.</h3>
                <p>Try relaxing one of these requirements:</p>
                <ul>{relaxSuggestions.map((item) => <li key={item.id}>{item.id}: {item.reason}</li>)}</ul>
                <button type="button" className="recommendations-submit" onClick={() => setRecommendationData(null)}>Edit preferences</button>
              </div>
            ) : (
              <div className="recommendation-list">
                {recommendationData.results.map((recommendation) => (
                  <RecommendationCard
                    key={recommendation.id}
                    recommendation={recommendation}
                    onSelect={recommendationData.level === "country" ? exploreCities : undefined}
                  />
                ))}
              </div>
            )}
            {recommendationData.comparison && <p className="recommendation-comparison">{recommendationData.comparison}</p>}
            {recommendationData.excluded?.length > 0 && <p className="recommendation-excluded">{recommendationData.excluded.length} destinations were excluded by your requirements.</p>}
          </section>
        )}
      </div>
    </main>
  );
}
