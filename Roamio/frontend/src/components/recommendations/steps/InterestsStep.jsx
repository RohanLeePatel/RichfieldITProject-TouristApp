import { useEffect, useRef, useState } from "react";
import { Ban, Plus, Users, X } from "lucide-react";

import { INTEREST_GROUPS, MIN_INTERESTS, resolveInterests } from "../../../pages/recommendations/constants.js";
import { nameError } from "../../../utils/validation.js";
import FieldError from "../../FieldError.jsx";
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
          max="1000000"
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

const TAG_LABELS = Object.fromEntries(INTEREST_GROUPS.flatMap((group) => group.tags).map((tag) => [tag.id, tag.label]));

// Popup shown when a tap would make a tag both an interest and avoided.
// "avoid": they tapped avoid on a picked interest; "pick": they tapped an
// interest that is already avoided.
function ConflictDialog({ conflict, onConfirm, onCancel }) {
  const ref = useRef(null);
  useEffect(() => {
    const dialog = ref.current;
    if (conflict && !dialog.open) dialog.showModal();
    if (!conflict && dialog.open) dialog.close();
  }, [conflict]);
  const label = conflict ? TAG_LABELS[conflict.tagId] || conflict.tagId : "";
  const avoid = conflict?.kind === "avoid";
  return (
    <dialog ref={ref} className="conflict-dialog" onCancel={onCancel} onClose={onCancel}>
      <h3>{conflict?.who || "You"} can&apos;t pick and avoid {label}</h3>
      <p>
        {avoid
          ? `${label} is one of the interests picked. Do you want to avoid it instead?`
          : `${label} is marked to avoid. Do you want to pick it as an interest instead?`}
      </p>
      <div className="conflict-dialog-actions">
        <button type="button" className="secondary-button" onClick={onCancel}>
          {avoid ? "Keep it as an interest" : "Keep avoiding it"}
        </button>
        <button type="button" className="recommendations-submit" onClick={onConfirm}>
          {avoid ? "Avoid it instead" : "Pick it instead"}
        </button>
      </div>
    </dialog>
  );
}

const travelerName = (traveler, index) => traveler.name?.trim() || `Traveler ${index + 2}`;

export default function InterestsStep({
  form, cycleInterest, cycleTravelerInterest, addTraveler, removeTraveler, updateTraveler, toggleDealbreaker, toggleTravelerDealbreaker,
}) {
  // what the engine will still get once the avoided tags are taken out
  const usable = resolveInterests(form).interests.length;
  const enoughPicked = form.interests.length >= MIN_INTERESTS;

  // travelerId null = the organiser. Taps that would contradict themselves open
  // the popup first; everything else goes straight through.
  const [conflict, setConflict] = useState(null);
  const stateFor = (travelerId) => (travelerId ? form.travelers.find((t) => t.id === travelerId) : form);
  const cycle = (travelerId, tagId) => (travelerId ? cycleTravelerInterest(travelerId, tagId) : cycleInterest(tagId));
  const toggleAvoid = (travelerId, tagId) => (travelerId ? toggleTravelerDealbreaker(travelerId, tagId) : toggleDealbreaker(tagId));
  const whoFor = (travelerId) => {
    const index = form.travelers.findIndex((t) => t.id === travelerId);
    return travelerId ? travelerName(form.travelers[index], index) : "You";
  };

  const tapInterest = (travelerId, tagId) => {
    const state = stateFor(travelerId);
    const avoided = (state.dealbreakers || []).includes(tagId);
    if (avoided && !state.interests.includes(tagId)) setConflict({ kind: "pick", travelerId, tagId, who: whoFor(travelerId) });
    else cycle(travelerId, tagId);
  };
  const tapAvoid = (travelerId, tagId) => {
    const state = stateFor(travelerId);
    const avoided = (state.dealbreakers || []).includes(tagId);
    if (!avoided && state.interests.includes(tagId)) setConflict({ kind: "avoid", travelerId, tagId, who: whoFor(travelerId) });
    else toggleAvoid(travelerId, tagId);
  };
  const resolveConflict = () => {
    const { kind, travelerId, tagId } = conflict;
    if (kind === "pick") {
      toggleAvoid(travelerId, tagId); // stop avoiding it
      cycle(travelerId, tagId); // pick it
    } else {
      const state = stateFor(travelerId);
      toggleAvoid(travelerId, tagId);
      // pick -> must-have -> off takes up to two taps
      cycle(travelerId, tagId);
      if (!state.priorityInterests.includes(tagId)) cycle(travelerId, tagId);
    }
    setConflict(null);
  };

  return (
    <>
      <ConflictDialog conflict={conflict} onConfirm={resolveConflict} onCancel={() => setConflict(null)} />
      <div className="wizard-intro">
        <h2>What do you enjoy?</h2>
        <p className="wizard-help">Pick at least 3 interests. Tap once to pick, tap again to mark it a must-have (★) - must-haves count for more when we rank matches. Anything you avoid below doesn&apos;t count.</p>
      </div>

      <InterestPicker interests={form.interests} priorityInterests={form.priorityInterests} onCycle={(tagId) => tapInterest(null, tagId)} />

      <section className="panel">
        <h3 className="panel-title"><Users size={15} /> Travelling with others?</h3>
        <p className="wizard-help">Add each person&apos;s own picks and limits - we merge them so the plan works for everyone. The tightest budget and the strictest access need always win.</p>
        {form.travelers.map((traveler, index) => (
          <div key={traveler.id} className="traveler-block">
            <div className="traveler-block-header">
              <h4>{travelerName(traveler, index)}&apos;s picks</h4>
              <button type="button" onClick={() => removeTraveler(traveler.id)} aria-label="Remove this traveler">
                <X size={14} />
              </button>
            </div>
            <label className="wizard-field traveler-name-field">
              Name (optional)
              <input
                type="text"
                value={traveler.name || ""}
                maxLength={60}
                placeholder="So we can say who a place suits"
                onChange={(event) => updateTraveler(traveler.id, "name", event.target.value)}
              />
              <FieldError message={nameError(traveler.name, "the name", { max: 60, required: false })} />
            </label>
            <InterestPicker
              flat
              interests={traveler.interests}
              priorityInterests={traveler.priorityInterests}
              onCycle={(tagId) => tapInterest(traveler.id, tagId)}
            />
            <h4 className="interest-group-label">{travelerName(traveler, index)} wants to avoid</h4>
            <AvoidChips avoided={traveler.dealbreakers || []} onToggle={(tagId) => tapAvoid(traveler.id, tagId)} />
            <h4 className="interest-group-label">{travelerName(traveler, index)}&apos;s own limits</h4>
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
        <AvoidChips avoided={form.dealbreakers} onToggle={(tagId) => tapAvoid(null, tagId)} />
        <div aria-live="polite">
          {enoughPicked && usable < MIN_INTERESTS && (
            <p className="recommendations-error">
              Only {usable} of your interests {usable === 1 ? "is" : "are"} left once the ones you avoid are removed. We need at least {MIN_INTERESTS} - stop avoiding one, or pick another interest above.
            </p>
          )}
          {enoughPicked && usable === MIN_INTERESTS && (
            <p className="wizard-help">
              You have exactly {MIN_INTERESTS} interests left that you&apos;re not avoiding - the minimum. Avoiding any more of them would leave too few, so pick another interest first.
            </p>
          )}
        </div>
      </section>
    </>
  );
}
