import { Gauge, Minus, Plus, Thermometer } from "lucide-react";

import { PACE_OPTIONS } from "../../../pages/recommendations/constants.js";

export default function GroupStep({ form, updateForm, togglePreciseStops, updateDayStopCount }) {
  return (
    <>
      <div className="wizard-intro">
        <h2>Make it work for your group.</h2>
        <p className="wizard-help">These data-backed preferences help the engine rank suitable matches.</p>
      </div>

      <section className="panel">
        <h3 className="panel-title"><Thermometer size={15} /> Access &amp; climate</h3>
        <div className="field-grid wizard-fields">
          <label className="wizard-field">Accessibility
            <select value={form.wheelchair} onChange={(event) => updateForm("wheelchair", event.target.value)}>
              <option value="none">No specific need</option>
              <option value="preferred">Wheelchair preferred</option>
              <option value="required">Wheelchair required</option>
            </select>
          </label>
          <label className="wizard-field">Climate
            <select value={form.climate} onChange={(event) => updateForm("climate", event.target.value)}>
              <option value="">No preference</option>
              <option value="mild">Mild</option>
              <option value="hot">Hot</option>
              <option value="cold">Cold</option>
            </select>
          </label>
        </div>
      </section>

      <section className="panel">
        <h3 className="panel-title"><Gauge size={15} /> Daily pace</h3>
        <div className="segmented four" role="radiogroup" aria-label="Daily pace">
          {PACE_OPTIONS.map((option) => {
            const selected = !form.preciseStops && form.pace === option.id;
            return (
              <button
                type="button"
                role="radio"
                aria-checked={selected}
                key={option.id}
                className={selected ? "selected" : ""}
                onClick={() => {
                  if (form.preciseStops) togglePreciseStops();
                  updateForm("pace", option.id);
                }}
              >
                <strong>{option.label}</strong>
                <span>{option.helper}</span>
              </button>
            );
          })}
          <button
            type="button"
            role="radio"
            aria-checked={form.preciseStops}
            className={`precise-option ${form.preciseStops ? "selected" : ""}`}
            onClick={() => !form.preciseStops && togglePreciseStops()}
          >
            <strong>Precise</strong>
            <span>set each day</span>
          </button>
        </div>

        {form.preciseStops && (
          <>
            <p className="wizard-help">Different days can carry different amounts - a light arrival day, a packed middle day, whatever fits.</p>
            <div className="stepper-grid">
              {form.dayStopCounts.map((count, index) => (
                <div key={index} className="stepper">
                  <span>Day {index + 1}</span>
                  <div>
                    <button type="button" aria-label={`Fewer stops on day ${index + 1}`} onClick={() => updateDayStopCount(index, count - 1)} disabled={count <= 1}><Minus size={14} /></button>
                    <strong>{count}</strong>
                    <button type="button" aria-label={`More stops on day ${index + 1}`} onClick={() => updateDayStopCount(index, count + 1)} disabled={count >= 10}><Plus size={14} /></button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </section>
    </>
  );
}
