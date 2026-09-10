import { useState } from "react";
import {
  ArrowLeft,
  Check,
  ChevronDown,
  LoaderCircle,
  MapPin,
  Plane,
  Sparkles,
} from "lucide-react";
import { Link } from "react-router-dom";

import { fetchRecommendations } from "../api/recommendations.js";
import "../styles/recommendations.css";

const INTERESTS = [
  "history",
  "nature",
  "food",
  "family",
];

const COUNTRIES = [
  { id: "argentina", name: "Argentina" },
  { id: "australia", name: "Australia" },
  { id: "brazil", name: "Brazil" },
  { id: "canada", name: "Canada" },
  { id: "egypt", name: "Egypt" },
  { id: "france", name: "France" },
  { id: "germany", name: "Germany" },
  { id: "italy", name: "Italy" },
  { id: "japan", name: "Japan" },
  { id: "kenya", name: "Kenya" },
  { id: "mexico", name: "Mexico" },
  { id: "netherlands", name: "Netherlands" },
  { id: "south-africa", name: "South Africa" },
  { id: "namibia", name: "Namibia" },
  { id: "portugal", name: "Portugal" },
  { id: "singapore", name: "Singapore" },
  { id: "spain", name: "Spain" },
  { id: "thailand", name: "Thailand" },
  { id: "united-arab-emirates", name: "United Arab Emirates" },
  { id: "united-kingdom", name: "United Kingdom" },
  { id: "united-states", name: "United States" },
];

const initialForm = {
  level: "city",
  country: "south-africa",
  budget: "1000",
  currency: "ZAR",
  interests: ["nature", "food"],
  adults: "2",
  children: "",
  wheelchair: "none",
  climate: "",
  month: "",
  pace: "balanced",
};

function formatDimension(dimension) {
  return dimension.replace(/_/g, " ");
}

function RecommendationCard({ recommendation }) {
  return (
    <article className="recommendation-card">
      <div className="recommendation-rank">#{recommendation.rank}</div>
      <div className="recommendation-card-content">
        <div className="recommendation-card-heading">
          <div>
            <p className="recommendation-card-id">
              <MapPin size={14} />
              {recommendation.id}
            </p>
            <h3>Recommended destination</h3>
          </div>
          <strong>{Math.round(recommendation.total_score * 100)}%</strong>
        </div>
        <p className="recommendation-explanation">
          {recommendation.explanation}
        </p>
        {recommendation.breakdown?.length > 0 && (
          <div className="recommendation-evidence">
            {recommendation.breakdown
              .filter((entry) => entry.weight > 0)
              .slice(0, 3)
              .map((entry) => (
                <span key={entry.dimension}>
                  <Check size={13} />
                  {formatDimension(entry.dimension)}
                </span>
              ))}
          </div>
        )}
      </div>
    </article>
  );
}

export default function Recommendations() {
  const [form, setForm] = useState(initialForm);
  const [recommendationData, setRecommendationData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const updateForm = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const toggleInterest = (interest) => {
    setForm((current) => ({
      ...current,
      interests: current.interests.includes(interest)
        ? current.interests.filter((item) => item !== interest)
        : [...current.interests, interest],
    }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");

    const budget = Number(form.budget);
    const adults = Number(form.adults);
    const children = form.children
      ? form.children
          .split(",")
          .map((age) => Number(age.trim()))
          .filter((age) => Number.isInteger(age) && age >= 0)
      : [];

    if (!Number.isFinite(budget) || budget <= 0) {
      setError("Enter a daily budget greater than zero.");
      return;
    }

    if (!Number.isInteger(adults) || adults < 1) {
      setError("Add at least one adult traveller.");
      return;
    }

    if (!/^[a-z]{3}$/i.test(form.currency)) {
      setError("Currency must be a 3-letter ISO code, such as ZAR.");
      return;
    }

    setLoading(true);

    try {
      const preferences = {
        budget_per_day: budget,
        currency: form.currency.toUpperCase(),
        interests: form.interests,
        travellers: { adults, children },
        accessibility: { wheelchair: form.wheelchair },
        climate: {
          ...(form.climate ? { prefer: form.climate } : {}),
          ...(form.month ? { travel_month: Number(form.month) } : {}),
        },
        pace: form.pace,
      };

      const data = await fetchRecommendations(
        preferences,
        form.level,
        form.level === "city" ? form.country : undefined
      );
      setRecommendationData(data);
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

  return (
    <main className="recommendations-page">
      <header className="recommendations-header">
        <Link to="/dashboard" className="recommendations-back-link">
          <ArrowLeft size={17} />
          Back to dashboard
        </Link>
        <div className="recommendations-brand">
          <span>
            <Plane size={18} />
          </span>
          Roamio
        </div>
      </header>

      <div className="recommendations-content">
        <section className="recommendations-intro">
          <p className="recommendations-eyebrow">
            <Sparkles size={15} />
            Personalised travel planning
          </p>
          <h1>Find a destination that fits your trip.</h1>
          <p>
            Tell us what matters to your group and we&apos;ll rank the best
            matching destinations from our travel catalogue.
          </p>
        </section>

        <div className="recommendations-layout">
          <form className="recommendations-form" onSubmit={handleSubmit}>
            <div className="form-section">
              <h2>What are you looking for?</h2>
              <div className="field-grid">
                <label>
                  Recommendation level
                  <span className="select-wrapper">
                    <select
                      value={form.level}
                      onChange={(event) =>
                        updateForm("level", event.target.value)
                      }
                    >
                      <option value="city">Cities</option>
                      <option value="country">Countries</option>
                    </select>
                    <ChevronDown size={16} />
                  </span>
                </label>
                {form.level === "city" && (
                  <label>
                    Country
                    <span className="select-wrapper">
                      <select
                        value={form.country}
                        onChange={(event) =>
                          updateForm("country", event.target.value)
                        }
                      >
                        {COUNTRIES.map((country) => (
                          <option key={country.id} value={country.id}>
                            {country.name}
                          </option>
                        ))}
                      </select>
                      <ChevronDown size={16} />
                    </span>
                  </label>
                )}
              </div>
            </div>

            <div className="form-section">
              <h2>Interests</h2>
              <div className="interest-list">
                {INTERESTS.map((interest) => (
                  <button
                    type="button"
                    className={`interest-option ${
                      form.interests.includes(interest) ? "selected" : ""
                    }`}
                    key={interest}
                    onClick={() => toggleInterest(interest)}
                  >
                    {form.interests.includes(interest) && <Check size={14} />}
                    {interest}
                  </button>
                ))}
              </div>
            </div>

            <div className="form-section">
              <h2>Trip preferences</h2>
              <div className="field-grid">
                <label>
                  Daily budget
                  <input
                    type="number"
                    min="1"
                    step="1"
                    value={form.budget}
                    onChange={(event) =>
                      updateForm("budget", event.target.value)
                    }
                  />
                </label>
                <label>
                  Currency
                  <input
                    maxLength="3"
                    value={form.currency}
                    onChange={(event) =>
                      updateForm("currency", event.target.value)
                    }
                  />
                </label>
                <label>
                  Adults
                  <input
                    type="number"
                    min="1"
                    step="1"
                    value={form.adults}
                    onChange={(event) =>
                      updateForm("adults", event.target.value)
                    }
                  />
                </label>
                <label>
                  Children&apos;s ages
                  <input
                    placeholder="e.g. 8, 12"
                    value={form.children}
                    onChange={(event) =>
                      updateForm("children", event.target.value)
                    }
                  />
                </label>
                <label>
                  Accessibility
                  <span className="select-wrapper">
                    <select
                      value={form.wheelchair}
                      onChange={(event) =>
                        updateForm("wheelchair", event.target.value)
                      }
                    >
                      <option value="none">No specific need</option>
                      <option value="preferred">Wheelchair preferred</option>
                      <option value="required">Wheelchair required</option>
                    </select>
                    <ChevronDown size={16} />
                  </span>
                </label>
                <label>
                  Travel pace
                  <span className="select-wrapper">
                    <select
                      value={form.pace}
                      onChange={(event) =>
                        updateForm("pace", event.target.value)
                      }
                    >
                      <option value="relaxed">Relaxed</option>
                      <option value="balanced">Balanced</option>
                      <option value="packed">Packed</option>
                    </select>
                    <ChevronDown size={16} />
                  </span>
                </label>
                <label>
                  Climate
                  <span className="select-wrapper">
                    <select
                      value={form.climate}
                      onChange={(event) =>
                        updateForm("climate", event.target.value)
                      }
                    >
                      <option value="">No preference</option>
                      <option value="mild">Mild</option>
                      <option value="hot">Hot</option>
                      <option value="cold">Cold</option>
                    </select>
                    <ChevronDown size={16} />
                  </span>
                </label>
                <label>
                  Travel month
                  <span className="select-wrapper">
                    <select
                      value={form.month}
                      onChange={(event) =>
                        updateForm("month", event.target.value)
                      }
                    >
                      <option value="">Any month</option>
                      {Array.from({ length: 12 }, (_, index) => (
                        <option key={index + 1} value={index + 1}>
                          {new Date(2024, index, 1).toLocaleString("en", {
                            month: "long",
                          })}
                        </option>
                      ))}
                    </select>
                    <ChevronDown size={16} />
                  </span>
                </label>
              </div>
            </div>

            {error && <p className="recommendations-error">{error}</p>}

            <button
              type="submit"
              className="recommendations-submit"
              disabled={loading}
            >
              {loading ? (
                <>
                  <LoaderCircle className="recommendations-spinner" size={18} />
                  Finding matches...
                </>
              ) : (
                <>
                  <Sparkles size={18} />
                  Find my recommendations
                </>
              )}
            </button>
          </form>

          <section className="recommendations-results" aria-live="polite">
            {!recommendationData && !loading && (
              <div className="results-placeholder">
                <Sparkles size={28} />
                <h2>Your best matches will appear here.</h2>
                <p>Complete your preferences and start exploring.</p>
              </div>
            )}

            {loading && (
              <div className="results-placeholder">
                <LoaderCircle className="recommendations-spinner" size={30} />
                <h2>Finding your best matches...</h2>
                <p>Our recommendation engine is comparing destinations.</p>
              </div>
            )}

            {recommendationData && !loading && (
              <>
                <div className="results-heading">
                  <div>
                    <p className="recommendations-eyebrow">
                      <MapPin size={15} />
                      {recommendationData.level} recommendations
                    </p>
                    <h2>Matches for your trip</h2>
                  </div>
                  <span>{recommendationData.results.length} found</span>
                </div>
                {recommendationData.results.length === 0 ? (
                  <div className="results-empty">
                    No destinations matched every requirement. Try relaxing an
                    accessibility or climate preference.
                  </div>
                ) : (
                  <div className="recommendation-list">
                    {recommendationData.results.map((recommendation) => (
                      <RecommendationCard
                        key={recommendation.id}
                        recommendation={recommendation}
                      />
                    ))}
                  </div>
                )}
                {recommendationData.comparison && (
                  <p className="recommendation-comparison">
                    {recommendationData.comparison}
                  </p>
                )}
                {recommendationData.excluded?.length > 0 && (
                  <p className="recommendation-excluded">
                    {recommendationData.excluded.length} destination(s) were
                    excluded by your requirements.
                  </p>
                )}
              </>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}
