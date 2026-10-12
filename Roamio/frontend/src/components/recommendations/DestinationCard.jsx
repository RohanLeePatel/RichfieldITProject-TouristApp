import { useState } from "react";
import { ArrowRight, Bookmark, CalendarCheck, Check, ExternalLink, MapPin, Star, ThumbsDown } from "lucide-react";

import ClimateInsights from "../insights/ClimateInsights.jsx";

import { formatDimension } from "../../pages/recommendations/constants.js";

// Six on-palette cover gradients; which one a destination gets is a stable
// hash of its name, so the same place always looks the same.
const COVERS = [1, 2, 3, 4, 5, 6].map((n) => `var(--cover-${n})`);
const coverFor = (name) => COVERS[[...name].reduce((sum, ch) => sum + ch.charCodeAt(0), 0) % COVERS.length];

function ScoreRing({ percent }) {
  const radius = 20;
  const circumference = 2 * Math.PI * radius;
  return (
    <div className="score-ring" role="img" aria-label={`${percent}% match`}>
      <svg viewBox="0 0 52 52" width="52" height="52">
        <circle cx="26" cy="26" r={radius} className="score-ring-track" />
        <circle
          cx="26" cy="26" r={radius}
          className="score-ring-fill"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - percent / 100)}
          transform="rotate(-90 26 26)"
        />
      </svg>
      <b>{percent}<small>%</small></b>
    </div>
  );
}

export default function DestinationCard({
  recommendation, onSelect, selectLabel, travelMonth,
  shortlisted, shortlistFull, onToggleShortlist, onDislike, busy,
}) {
  const [showInsights, setShowInsights] = useState(false);
  const destinationName = recommendation.name || recommendation.id;
  const mapUrl =
    recommendation.map_url ||
    `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(destinationName)}`;
  // Show each matched interest tag as its own chip (starred if it was a
  // priority pick) so users can see which of their picks moved this result up.
  const interestsEntry = recommendation.breakdown?.find((entry) => entry.dimension === "interests");
  const priorityTags = new Set(interestsEntry?.evidence?.priority || []);
  const requestedTags = interestsEntry?.evidence?.requested || [];
  const otherEvidence = recommendation.breakdown
    ?.filter((entry) => entry.dimension !== "interests" && entry.weight > 0 && entry.value >= 0.6)
    .slice(0, 3);
  const percent = Math.round(recommendation.total_score * 100);

  return (
    <article className="recommendation-card">
      <div className="recommendation-card-cover" style={recommendation.image_url ? undefined : { background: coverFor(destinationName) }}>
        {recommendation.image_url && (
          <img src={recommendation.image_url} alt={`${destinationName} destination`} />
        )}
        <span className="recommendation-rank">#{recommendation.rank}</span>
        <ScoreRing percent={percent} />
        {!recommendation.image_url && <MapPin size={44} className="cover-icon" aria-hidden="true" />}
      </div>
      <div className="recommendation-card-body">
        <h3>{destinationName}</h3>
        {recommendation.country && (
          <p className="recommendation-location"><MapPin size={14} /> {recommendation.country}</p>
        )}
        <p className="recommendation-explanation">{recommendation.explanation}</p>
        <p className="recommendation-why">Why it matched</p>
        <div className="chip-list recommendation-evidence">
          {otherEvidence?.map((entry) => (
            <span key={entry.dimension} className="chip"><Check size={12} />{formatDimension(entry.dimension)}</span>
          ))}
          {requestedTags.map((tag) => (
            <span key={tag} className={`chip ${priorityTags.has(tag) ? "priority" : ""}`}>
              {priorityTags.has(tag) ? <Star size={12} /> : <Check size={12} />}
              {formatDimension(tag)}
            </span>
          ))}
        </div>
        {(onToggleShortlist || onDislike) && (
          <div className="recommendation-feedback">
            {onToggleShortlist && (
              <button
                type="button"
                className={`card-link-button ${shortlisted ? "active" : ""}`}
                onClick={() => onToggleShortlist(recommendation)}
                aria-pressed={shortlisted}
                disabled={!shortlisted && shortlistFull}
                title={!shortlisted && shortlistFull ? "Shortlist is full - remove one to add another" : undefined}
              >
                <Bookmark size={14} fill={shortlisted ? "currentColor" : "none"} /> {shortlisted ? "Shortlisted" : "Shortlist"}
              </button>
            )}
            {onDislike && (
              <button type="button" className="card-link-button" onClick={() => onDislike(recommendation)} disabled={busy}>
                <ThumbsDown size={14} /> Not quite right
              </button>
            )}
          </div>
        )}
        <div className="recommendation-card-actions">
          <a href={mapUrl} target="_blank" rel="noreferrer">
            View map <ExternalLink size={14} />
          </a>
          {recommendation.country && (
            <button type="button" className="card-link-button" onClick={() => setShowInsights((open) => !open)} aria-expanded={showInsights}>
              <CalendarCheck size={14} /> {showInsights ? "Hide" : "Best time"}
            </button>
          )}
          {onSelect && (
            <button type="button" onClick={() => onSelect(recommendation)}>
              {selectLabel} <ArrowRight size={14} />
            </button>
          )}
        </div>
        {showInsights && (
          <div className="card-insights">
            <ClimateInsights name={destinationName} country={recommendation.country} month={travelMonth || undefined} showAbout={false} />
          </div>
        )}
      </div>
    </article>
  );
}
