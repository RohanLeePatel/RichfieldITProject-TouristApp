import { CalendarDays, Check, Globe, MapPin, Wallet, Wand2 } from "lucide-react";

import { CURRENCIES, DEFAULT_TRIP_DAYS, TRIP_PRESETS, PACE_OPTIONS, formatDimension } from "../../../pages/recommendations/constants.js";

const sameSet = (a, b) => a.length === b.length && a.every((tag) => b.includes(tag));

// Mirrors buildPreferences() in constants.js, so what the traveller is shown
// here is exactly what the engine will receive.
const parseAges = (value) =>
  value
    .split(",")
    .map((age) => Number(age.trim()))
    .filter((age) => Number.isInteger(age) && age >= 0);

export default function BasicsStep({ form, updateForm, countries, applyPreset }) {
  const parsedAges = parseAges(form.children);
  // A preset only changes interests/pace (set on later steps), so show which
  // one is active and what it filled in - otherwise clicking looks like a no-op.
  const active = TRIP_PRESETS.find(
    (preset) => sameSet(preset.interests, form.interests) && sameSet(preset.priorityInterests, form.priorityInterests) && preset.pace === form.pace
  );
  return (
    <>
      <div className="wizard-intro">
        <h2>Where should we look?</h2>
        <p className="wizard-help">Start globally, or tell us which country you already have in mind.</p>
      </div>

      <section className="panel">
        <h3 className="panel-title"><Wand2 size={15} /> Quick start</h3>
        <div className="preset-list" role="group" aria-label="Quick starting points">
          {TRIP_PRESETS.map((preset) => (
            <button type="button" key={preset.id} className={`preset-option ${active?.id === preset.id ? "selected" : ""}`} aria-pressed={active?.id === preset.id} onClick={() => applyPreset(preset)}>
              {active?.id === preset.id ? <Check size={14} /> : <Wand2 size={14} />} {preset.label}
            </button>
          ))}
        </div>
        {active && (
          <p className="wizard-help preset-note">
            Applied: {active.interests.map(formatDimension).join(", ")} · {PACE_OPTIONS.find((o) => o.id === active.pace)?.label} pace
            {active.children ? ", and suggested ages below" : ""}. Fine-tune on the next steps.
          </p>
        )}
      </section>

      <section className="panel">
        <h3 className="panel-title"><Globe size={15} /> Search area</h3>
        <div className="mode-options">
          <button type="button" className={`mode-option ${form.mode === "global" ? "selected" : ""}`} onClick={() => updateForm("mode", "global")}>
            <Globe size={22} />
            <strong>Explore globally</strong>
            <span>Rank countries around the world.</span>
          </button>
          <button type="button" className={`mode-option ${form.mode === "country" ? "selected" : ""}`} onClick={() => updateForm("mode", "country")}>
            <MapPin size={22} />
            <strong>I have a country in mind</strong>
            <span>Find the best cities in one country.</span>
          </button>
        </div>
        {form.mode === "country" && (
          <label className="wizard-field">
            Country
            <select value={form.country} onChange={(event) => updateForm("country", event.target.value)}>
              {countries.map((country) => (
                <option key={country.id} value={country.name}>{country.name}{country.city_count ? ` (${country.city_count} cities)` : ""}</option>
              ))}
            </select>
          </label>
        )}
      </section>

      <div className="panel-row">
        <section className="panel">
          <h3 className="panel-title"><Wallet size={15} /> Budget &amp; group</h3>
          <div className="field-grid wizard-fields">
            <label className="wizard-field">Daily budget<input type="number" min="1" value={form.budget} onChange={(event) => updateForm("budget", event.target.value)} /></label>
            {/* A free-text code could only fail late, as a 422 from the
                engine that the traveller had no way to diagnose. */}
            <label className="wizard-field">Currency
              <select value={form.currency} onChange={(event) => updateForm("currency", event.target.value)}>
                {CURRENCIES.map((code) => (
                  <option key={code} value={code}>{code}</option>
                ))}
              </select>
            </label>
            <label className="wizard-field">Adults<input type="number" min="1" value={form.adults} onChange={(event) => updateForm("adults", event.target.value)} /></label>
            <label className="wizard-field">Children&apos;s ages
              <input
                inputMode="numeric"
                placeholder="e.g. 8, 12"
                value={form.children}
                onChange={(event) => updateForm("children", event.target.value)}
                aria-describedby="children-ages-read"
              />
            </label>
          </div>
          <p className="wizard-help" id="children-ages-read">
            {form.children.trim()
              ? parsedAges.length > 0
                ? `Travelling with ${parsedAges.length} ${parsedAges.length === 1 ? "child" : "children"}, aged ${parsedAges.join(", ")}.`
                : "We couldn't read any ages there - separate them with commas, like 8, 12."
              : "Leave blank if no children are coming. Ages shape which places we suggest."}
          </p>
        </section>

        <section className="panel">
          <h3 className="panel-title"><CalendarDays size={15} /> Dates</h3>
          <div className="field-grid wizard-fields">
            <label className="wizard-field">Start date<input type="date" value={form.startDate} onChange={(event) => updateForm("startDate", event.target.value)} /></label>
            <label className="wizard-field">End date<input type="date" value={form.endDate} min={form.startDate || undefined} onChange={(event) => updateForm("endDate", event.target.value)} /></label>
          </div>
          <p className="wizard-help">Dates sharpen climate matching and let us lay out your itinerary by day - skip them and we&apos;ll use a sample {DEFAULT_TRIP_DAYS}-day plan later.</p>
        </section>
      </div>
    </>
  );
}
