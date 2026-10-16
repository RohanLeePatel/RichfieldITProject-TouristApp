import { Ban, Plus, Users, X } from "lucide-react";

import { INTEREST_GROUPS } from "../../../pages/recommendations/constants.js";
import InterestPicker from "../InterestPicker.jsx";

function AvoidChips({ avoided, onToggle }) {
  return (
    <div className="chip-list">
      {INTEREST_GROUPS.flatMap((group) => group.tags).map((tag) => {
        const excluded = avoided.includes(tag.id);
        return (
          <button
            type="button"
            key={tag.id}
            className={`chip dealbreaker ${excluded ? "selected" : ""}`}
            aria-pressed={excluded}
            onClick={() => onToggle(tag.id)}
          >
            {excluded && <Ban size={13} />} {tag.label}
          </button>
        );
      })}
    </div>
  );
}

// A traveller's own budget/access/climate/pace. Left blank they follow the
// group; set, they go to the engine as member_preferences and the merge rules
// in engine/group.py decide what wins (tightest budget, strictest access
// need, majority climate and pace).
function TravelerConstraints({ traveler, index, currency, onChange }) {
  return (
    <div className="field-grid wizard-fields traveler-constraints">
      <label className="wizard-field">
        Their daily budget ({currency})
        <input
          type="number"
          min="1"
          inputMode="numeric"
          placeholder="Same as group"
          value={traveler.budget}
          onChange={(event) => onChange(traveler.id, "budget", event.target.value)}
          aria-label={`Traveler ${index + 2} daily budget`}
        />
      </label>
      <label className="wizard-field">
        Their accessibility need
        <select value={traveler.wheelchair} onChange={(event) => onChange(traveler.id, "wheelchair", event.target.value)}>
          <option value="">Same as group</option>
          <option value="none">No specific need</option>
          <option value="preferred">Wheelchair preferred</option>
          <option value="required">Wheelchair required</option>
        </select>
      </label>
      <label className="wizard-field">
        Their climate
        <select value={traveler.climate} onChange={(event) => onChange(traveler.id, "climate", event.target.value)}>
          <option value="">Same as group</option>
          <option value="mild">Mild</option>
          <option value="hot">Hot</option>
          <option value="cold">Cold</option>
        </select>
      </label>
      <label className="wizard-field">
        Their pace
        <select value={traveler.pace} onChange={(event) => onChange(traveler.id, "pace", event.target.value)}>
          <option value="">Same as group</option>
          <option value="relaxed">Relaxed</option>
          <option value="balanced">Balanced</option>
          <option value="packed">Packed</option>
        </select>
      </label>
    </div>
  );
}

export default function InterestsStep({
  form, cycleInterest, cycleTravelerInterest, addTraveler, removeTraveler, updateTraveler, toggleDealbreaker, toggleTravelerDealbreaker,
}) {
  return (
    <>
      <div className="wizard-intro">
        <h2>What do you enjoy?</h2>
        <p className="wizard-help">Tap once to pick, tap again to mark it a must-have (★) - must-haves count for more when we rank matches.</p>
      </div>

      <InterestPicker interests={form.interests} priorityInterests={form.priorityInterests} onCycle={cycleInterest} />

      <section className="panel">
        <h3 className="panel-title"><Users size={15} /> Travelling with others?</h3>
        <p className="wizard-help">Add each person&apos;s own picks and limits - we merge them so the plan works for everyone. The tightest budget and the strictest access need always win.</p>
        {form.travelers.map((traveler, index) => (
          <div key={traveler.id} className="traveler-block">
            <div className="traveler-block-header">
              <h4>Traveler {index + 2}&apos;s picks</h4>
              <button type="button" onClick={() => removeTraveler(traveler.id)} aria-label="Remove this traveler">
                <X size={14} />
              </button>
            </div>
            <InterestPicker
              flat
              interests={traveler.interests}
              priorityInterests={traveler.priorityInterests}
              onCycle={(tagId) => cycleTravelerInterest(traveler.id, tagId)}
            />
            <h4 className="interest-group-label">Traveler {index + 2} wants to avoid</h4>
            <AvoidChips avoided={traveler.dealbreakers || []} onToggle={(tagId) => toggleTravelerDealbreaker(traveler.id, tagId)} />
            <h4 className="interest-group-label">Traveler {index + 2}&apos;s own limits</h4>
            <TravelerConstraints traveler={traveler} index={index} currency={form.currency} onChange={updateTraveler} />
          </div>
        ))}
        <button type="button" className="secondary-button" onClick={addTraveler}>
          <Plus size={16} /> Add another traveler&apos;s preferences
        </button>
        {form.travelers.some((t) => t.interests.length > 0) && (
          <p className="wizard-help">A tag every traveler picked is weighted like a must-have automatically.</p>
        )}
      </section>

      <section className="panel">
        <h3 className="panel-title"><Ban size={15} /> Anything to avoid?</h3>
        <p className="wizard-help">These are excluded from every traveler&apos;s matches, even if someone else picked them.</p>
        <AvoidChips avoided={form.dealbreakers} onToggle={toggleDealbreaker} />
      </section>
    </>
  );
}
