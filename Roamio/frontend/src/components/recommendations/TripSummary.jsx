import { Compass } from "lucide-react";

import { ACCESSIBILITY_LABELS, allDealbreakers, DEFAULT_TRIP_DAYS, formatDimension, paceLabel, tripLengthDays } from "../../pages/recommendations/constants.js";

// Live "your trip so far" card beside the wizard - fills the side of the
// page and shows the effect of presets/picks straight away.
export default function TripSummary({ form }) {
  const hasDates = form.startDate && form.endDate;
  const days = tripLengthDays(form);
  const rows = [
    ["Searching", form.mode === "global" ? "Countries worldwide" : `Cities in ${form.country}`],
    ["Budget", `${form.budget || "-"} ${form.currency.toUpperCase()} / day`],
    ["Group", `${form.adults || 1} adult${Number(form.adults) === 1 ? "" : "s"}${form.children ? ` + kids ${form.children}` : ""}${form.travelers.length ? ` · ${form.travelers.length + 1} people's picks` : ""}`],
    ["Length", hasDates ? `${days} day${days === 1 ? "" : "s"}` : `Sample ${DEFAULT_TRIP_DAYS}-day plan`],
    ["Pace", paceLabel(form)],
    ["Climate", form.climate ? form.climate[0].toUpperCase() + form.climate.slice(1) : "Any"],
    ["Access", ACCESSIBILITY_LABELS[form.wheelchair]],
  ];
  return (
    <aside className="panel trip-summary" aria-label="Your trip so far">
      <h3 className="panel-title"><Compass size={15} /> Your trip so far</h3>
      <dl>
        {rows.map(([label, value]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
      <h4 className="interest-group-label">Interests</h4>
      {form.interests.length === 0 ? (
        <p className="wizard-help">None picked yet.</p>
      ) : (
        <div className="chip-list">
          {form.interests.map((tag) => (
            <span key={tag} className={`chip ${form.priorityInterests.includes(tag) ? "priority" : ""}`}>
              {form.priorityInterests.includes(tag) && "★ "}{formatDimension(tag)}
            </span>
          ))}
        </div>
      )}
      {allDealbreakers(form).length > 0 && (
        <>
          <h4 className="interest-group-label">Avoiding</h4>
          <div className="chip-list">
            {allDealbreakers(form).map((tag) => <span key={tag} className="chip dealbreaker selected">{formatDimension(tag)}</span>)}
          </div>
        </>
      )}
    </aside>
  );
}
