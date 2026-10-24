import { ClipboardCheck } from "lucide-react";

import { ACCESSIBILITY_LABELS, allDealbreakers, DEFAULT_TRIP_DAYS, formatDimension, paceLabel } from "../../../pages/recommendations/constants.js";

// "2026-12-14" -> "14 Dec 2026"; noon so no timezone shifts it a day
const formatDay = (iso) => new Date(`${iso}T12:00:00`).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });

export default function ReviewStep({ form, goToStep }) {
  const rows = [
    // chosen on the first step (TripGroupPanel)
    { label: "Trip for", step: 0, value: form.travelGroupId ? form.travelGroupName || "Your travel group" : "Just me" },
    { label: "Search", step: 0, value: form.mode === "global" ? "Global countries" : `Cities in ${form.country}` },
    { label: "Budget", step: 0, value: `${form.budget} ${form.currency.toUpperCase()} per day` },
    { label: "Travellers", step: 0, value: `${form.adults} adult${Number(form.adults) === 1 ? "" : "s"}${form.children ? `, ${form.children.includes(",") ? "children" : "a child"} aged ${form.children}` : ""}` },
    {
      label: "Dates", step: 0,
      value: form.startDate && form.endDate ? `${formatDay(form.startDate)} → ${formatDay(form.endDate)}` : `Not set (sample ${DEFAULT_TRIP_DAYS}-day plan)`,
    },
    {
      label: "Interests", step: 1,
      value: form.interests.map((tag) => (form.priorityInterests.includes(tag) ? `★ ${formatDimension(tag)}` : formatDimension(tag))).join(", "),
    },
    ...(allDealbreakers(form).length > 0 ? [{ label: "Avoiding", step: 1, value: allDealbreakers(form).map(formatDimension).join(", ") }] : []),
    { label: "Climate", step: 2, value: form.climate || "Any climate" },
    { label: "Accessibility", step: 2, value: ACCESSIBILITY_LABELS[form.wheelchair] },
    { label: "Pace", step: 2, value: paceLabel(form) },
  ];
  return (
    <>
      <div className="wizard-intro">
        <h2>Review your trip preferences.</h2>
        <p className="wizard-help">You can go back and change anything before we search.</p>
      </div>
      <section className="panel">
        <h3 className="panel-title"><ClipboardCheck size={15} /> Everything we&apos;ll search with</h3>
        <div className="review-grid">
          {rows.map((row) => (
            <div key={row.label}>
              <span>{row.label}</span>
              <strong>{row.value}</strong>
              <button type="button" onClick={() => goToStep(row.step)}>Edit</button>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
