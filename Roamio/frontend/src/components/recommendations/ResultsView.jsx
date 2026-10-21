import { useState } from "react";
import { Bookmark, ChevronLeft, MapPin } from "lucide-react";

import CompareView from "./CompareView.jsx";
import DestinationCard from "./DestinationCard.jsx";
import ResultsAdvice from "./ResultsAdvice.jsx";

export default function ResultsView({
  data, title, historyCount, loading, error, exploreCities, selectCity, selectExcluded,
  goBack, startOver, editPreferences, requirementExclusions, rankedOutCount, relaxSuggestions, travelMonth,
  shortlist, toggleShortlist, notQuiteRight, maxShortlist,
}) {
  const [comparing, setComparing] = useState(false);
  const isCountry = data.level === "country";
  const isShortlisted = (id) => shortlist.some((item) => item.id === id);
  return (
    <section className="recommendations-results">
      <div className="results-heading">
        <div>
          <p className="recommendations-eyebrow"><MapPin size={15} /> {data.level} recommendations</p>
          <h2>{title}</h2>
          <p>Ranked using your saved preferences. You can edit them and search again.</p>
        </div>
        <div className="results-heading-actions">
          <button type="button" className="secondary-button" onClick={goBack}>
            <ChevronLeft size={17} />
            {historyCount > 0 ? "Back" : "Edit preferences"}
          </button>
          {historyCount > 0 && (
            <button type="button" className="secondary-button" onClick={startOver}>Start over</button>
          )}
        </div>
      </div>

      {data.results.length > 0 && (
        <>
          <ResultsAdvice data={data} />
          {data.comparison && <p className="recommendation-comparison">{data.comparison}</p>}
          {/* how several travellers' preferences were combined - the engine
              shows its working here the same way it does for each score */}
          {data.group_merge_explanation && (
            <p className="recommendation-comparison group-merge-note">{data.group_merge_explanation}</p>
          )}
          {data.group_conflicts?.length > 0 && (
            <ul className="group-conflicts" aria-label="Where your group disagrees">
              {data.group_conflicts.map((conflict) => <li key={conflict}>{conflict}</li>)}
            </ul>
          )}
        </>
      )}

      {data.results.length === 0 ? (
        <div className="results-empty">
          <h3>No exact matches yet.</h3>
          <p>Try relaxing one of these requirements:</p>
          <ul>{relaxSuggestions.map((item) => <li key={item.id}>{item.name}: {item.reason}</li>)}</ul>
          <button type="button" className="recommendations-submit" onClick={editPreferences}>Edit preferences</button>
        </div>
      ) : (
        <div className="recommendation-list">
          {data.results.map((recommendation) => (
            <DestinationCard
              key={recommendation.id}
              recommendation={recommendation}
              onSelect={isCountry ? exploreCities : data.level === "city" ? selectCity : undefined}
              selectLabel={isCountry ? "Explore cities" : loading ? "Starting trip..." : "Start a trip here"}
              travelMonth={travelMonth}
              shortlisted={isShortlisted(recommendation.id)}
              shortlistFull={shortlist.length >= maxShortlist}
              onToggleShortlist={toggleShortlist}
              onDislike={notQuiteRight}
              busy={loading}
            />
          ))}
        </div>
      )}

      {shortlist.length > 0 && (
        <div className="shortlist-bar" role="region" aria-label="Shortlist">
          <span><Bookmark size={15} /> {shortlist.length} shortlisted: {shortlist.map((item) => item.name || item.id).join(", ")}</span>
          <button type="button" className="recommendations-submit" onClick={() => setComparing(true)} disabled={shortlist.length < 2}>
            {shortlist.length < 2 ? "Shortlist 2 to compare" : "Compare"}
          </button>
        </div>
      )}
      {comparing && shortlist.length >= 2 && (
        <CompareView items={shortlist} onRemove={toggleShortlist} onClose={() => setComparing(false)} />
      )}

      {data.excluded?.length > 0 && (
        <details className="excluded-dropdown">
          <summary>
            {requirementExclusions.length > 0 && (
              <>{requirementExclusions.length} destination{requirementExclusions.length === 1 ? "" : "s"} excluded by your requirements</>
            )}
            {requirementExclusions.length > 0 && rankedOutCount > 0 && " · "}
            {rankedOutCount > 0 && (
              <>{rankedOutCount} more scored well but didn&apos;t make the top {data.results.length}</>
            )}
          </summary>
          <ul className="excluded-list">
            {data.excluded.map((item) => (
              <li key={item.id}>
                <div>
                  <strong>{item.name}</strong>
                  <span>{item.reason}</span>
                </div>
                <button type="button" onClick={() => selectExcluded(data.level, item)} disabled={loading}>
                  {isCountry ? "Explore anyway" : "Plan a trip here"}
                </button>
              </li>
            ))}
          </ul>
        </details>
      )}
      {error && <p className="recommendations-error" role="alert">{error}</p>}
    </section>
  );
}
