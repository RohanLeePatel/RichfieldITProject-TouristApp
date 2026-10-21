import { ArrowRight, Check, ChevronLeft, MapPin, Search, Sparkles, Wand2 } from "lucide-react";

import { formatDimension } from "../../pages/recommendations/constants.js";

export default function LandmarkPicker({
  cityName, landmarksData, selectedLandmarks, toggleLandmark, filter, setFilter,
  autoPick, onBuild, onBack, loading, error, daysNeeded, tripDays,
}) {
  const count = selectedLandmarks.size;
  return (
    <section className="recommendations-results">
      <div className="results-heading">
        <div>
          <p className="recommendations-eyebrow"><Sparkles size={15} /> place recommendations</p>
          <h2>Things to do in {cityName}</h2>
          <p>Pick a few to add straight into your new trip&apos;s itinerary.</p>
        </div>
        <button type="button" className="secondary-button" onClick={onBack} disabled={loading}>
          <ChevronLeft size={17} /> Not this city
        </button>
      </div>

      <div className="picker-layout">
        <div className="picker-main">
          <div className="landmark-toolbar">
            <label className="landmark-search">
              <Search size={15} />
              <input type="text" placeholder="Filter by name or area..." value={filter} onChange={(event) => setFilter(event.target.value)} />
            </label>
            <button type="button" className="secondary-button" onClick={autoPick}>
              <Wand2 size={15} /> Pick top matches for me
            </button>
          </div>

          {landmarksData?.groups.map((group) => {
            const query = filter.trim().toLowerCase();
            // Filter by text but keep each landmark's original index (the
            // selection key) stable, so hiding non-matching rows never
            // shifts which card represents which landmark.
            const visible = group.landmarks
              .map((landmark, index) => ({ landmark, index }))
              .filter(({ landmark }) => !query || landmark.name.toLowerCase().includes(query) || landmark.address?.toLowerCase().includes(query));
            return (
              <div key={group.interest} className="landmark-group">
                <h4 className="interest-group-label">{formatDimension(group.interest)}</h4>
                <p className="wizard-help">{group.explanation}</p>
                {group.landmarks.length === 0 ? (
                  <p className="wizard-help">No {formatDimension(group.interest)} spots found nearby.</p>
                ) : visible.length === 0 ? (
                  <p className="wizard-help">No matches for &quot;{filter}&quot; in this group.</p>
                ) : (
                  <div className="landmark-list">
                    {visible.map(({ landmark, index }) => {
                      // Keyed by position, not name - Geoapify sometimes
                      // returns several distinct places sharing one display
                      // name, and a name key made them all toggle together.
                      const key = `${group.interest}|${index}`;
                      const checked = selectedLandmarks.has(key);
                      // Coordinates tell same-named POIs apart; text can't.
                      const mapUrl =
                        Number.isFinite(landmark.lat) && Number.isFinite(landmark.lon)
                          ? `https://www.google.com/maps/search/?api=1&query=${landmark.lat},${landmark.lon}`
                          : null;
                      return (
                        <label key={key} className={`landmark-item ${checked ? "selected" : ""}`}>
                          <input type="checkbox" checked={checked} onChange={() => toggleLandmark(key)} />
                          <span className="landmark-check" aria-hidden="true"><Check size={14} /></span>
                          <span className="landmark-text">
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
        </div>

        <aside className="picker-summary">
          <h3>Your picks</h3>
          <p className="picker-count"><b>{count}</b> stop{count === 1 ? "" : "s"} selected</p>
          <p className="wizard-help">
            {count === 0
              ? "Tick places on the left, or let us pick the closest matches."
              : `About ${daysNeeded} day${daysNeeded === 1 ? "" : "s"} at your pace${daysNeeded > tripDays ? ` - more than your ${tripDays}-day trip, so extra days get added` : ""}.`}
          </p>
          {error && <p className="recommendations-error" role="alert">{error}</p>}
          <button type="button" className="recommendations-submit" onClick={onBuild} disabled={loading}>
            Build my itinerary <ArrowRight size={17} />
          </button>
        </aside>
      </div>
    </section>
  );
}
