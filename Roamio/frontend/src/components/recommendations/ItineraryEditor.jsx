import { AlertTriangle, ArrowRight, ChevronLeft, GripVertical, LoaderCircle, Plus, Sparkles, Trash2, Undo2, X } from "lucide-react";

import { DEFAULT_TRIP_DAYS } from "../../pages/recommendations/constants.js";
import { isDayOverloaded, isLikelyClosed } from "../../utils/itineraryPlanner.js";
import ItineraryMap, { dayColor } from "./ItineraryMap.jsx";

// One stop in a day. Its "may be closed" badge comes from opening hours and the
// start time (isLikelyClosed), so it is a hint, not a guarantee.
function StopCard({ stop, onRemove, onDragStart, onDrop }) {
  const closed = isLikelyClosed(stop.landmark, stop.startTime);
  return (
    <div
      className="itinerary-stop"
      draggable
      onDragStart={onDragStart}
      onDragOver={(event) => event.preventDefault()}
      onDrop={(event) => {
        event.stopPropagation();
        onDrop();
      }}
    >
      <GripVertical size={16} className="itinerary-stop-grip" aria-hidden="true" />
      <span className="itinerary-stop-time">{stop.startTime}</span>
      <span className="itinerary-stop-name">
        {stop.landmark.name}
        {closed && (
          <span className="itinerary-stop-warning" title={`Likely closed at ${stop.startTime} (hours: ${stop.landmark.opening_hours})`}>
            <AlertTriangle size={12} /> may be closed
          </span>
        )}
      </span>
      <button type="button" className="itinerary-stop-remove" onClick={onRemove} aria-label={`Remove ${stop.landmark.name}`}>
        <X size={14} />
      </button>
    </div>
  );
}

// Presentational: the parent owns the plan and every change goes through its
// callbacks. Undo, Save and the drag state therefore live with the parent, which
// keeps this component easy to test.
export default function ItineraryEditor({
  cityName, days, hasDates, canUndo, loading, error,
  undo, back, addDay, spreadStops, removeDay, removeStop, moveStop, dragStop, setDragStop, onSave,
}) {
  return (
    <section className="recommendations-results">
      <div className="results-heading">
        <div>
          <p className="recommendations-eyebrow"><Sparkles size={15} /> your itinerary</p>
          <h2>Your day-by-day plan for {cityName}</h2>
          <p>
            {hasDates
              ? "Drag a stop to reorder it or move it to another day."
              : `No trip dates were set, so this is a sample ${DEFAULT_TRIP_DAYS}-day plan - drag to reorder or move stops between days.`}
          </p>
        </div>
        <div className="results-heading-actions">
          <button type="button" className="secondary-button" onClick={back} disabled={loading}>
            <ChevronLeft size={17} /> Back to picks
          </button>
        </div>
      </div>

      <ItineraryMap itineraryDays={days} />

      <div className="itinerary-days">
        {days.map((day, dayIndex) => (
          <div
            key={day.dayNumber}
            className="itinerary-day"
            style={{ "--day-color": dayColor(day.dayNumber) }}
            onDragOver={(event) => event.preventDefault()}
            onDrop={() => {
              if (dragStop) moveStop(dragStop, { dayIndex, stopIndex: day.stops.length });
              setDragStop(null);
            }}
          >
            <div className="itinerary-day-header">
              <h4>
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
                disabled={day.stops.length > 0 || days.length <= 1}
                title={day.stops.length > 0 ? "Remove this day's stops first" : "Remove this day"}
                aria-label={`Remove Day ${day.dayNumber}`}
              >
                <Trash2 size={14} />
              </button>
            </div>
            {day.stops.length === 0 && <p className="itinerary-day-empty">No stops - drag one here.</p>}
            {day.stops.map((stop, stopIndex) => (
              <StopCard
                key={`${stop.landmark.name}-${stopIndex}`}
                stop={stop}
                onRemove={() => removeStop(dayIndex, stopIndex)}
                onDragStart={() => setDragStop({ dayIndex, stopIndex })}
                onDrop={() => {
                  if (dragStop) moveStop(dragStop, { dayIndex, stopIndex });
                  setDragStop(null);
                }}
              />
            ))}
          </div>
        ))}
        <button type="button" className="itinerary-add-day" onClick={addDay}>
          <Plus size={20} />
          <strong>Add a day</strong>
          <span>Adds an empty day - your stops stay where they are</span>
        </button>
      </div>

      {error && <p className="recommendations-error" role="alert">{error}</p>}
      <div className="action-bar">
        <button type="button" className="secondary-button" onClick={undo} disabled={!canUndo} title={canUndo ? "Undo the last change" : "No edits to undo"}>
          <Undo2 size={16} /> Undo
        </button>
        <button type="button" className="secondary-button" onClick={spreadStops} disabled={days.length < 2} title="Share all stops evenly across the days">
          Spread stops evenly
        </button>
        <button type="button" className="recommendations-submit" onClick={onSave} disabled={loading}>
          {loading ? <><LoaderCircle className="recommendations-spinner" size={18} /> Saving...</> : <>Save itinerary <ArrowRight size={17} /></>}
        </button>
      </div>
    </section>
  );
}
