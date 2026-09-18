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

export default function InterestsStep({
  form, cycleInterest, cycleTravelerInterest, addTraveler, removeTraveler, toggleDealbreaker, toggleTravelerDealbreaker,
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
        <p className="wizard-help">Add each person&apos;s own picks - we blend them so the plan works for everyone.</p>
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
