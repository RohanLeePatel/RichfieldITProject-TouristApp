import {
  Baby, Building2, Check, Coffee, Droplets, Fish, Landmark, Mountain, Palmtree,
  Star, Trees, Utensils, UtensilsCrossed, FerrisWheel,
} from "lucide-react";

import { INTEREST_GROUPS } from "../../pages/recommendations/constants.js";

const TAG_ICONS = {
  parks: Trees, hiking: Mountain, beaches: Palmtree, waterparks: Droplets,
  museums: Landmark, historic_sites: Building2,
  restaurants: Utensils, cafes: Coffee, street_food: UtensilsCrossed,
  theme_parks: FerrisWheel, zoos_aquariums: Fish, playgrounds: Baby,
};

// Big tri-state tiles (off -> selected -> ★ must-have -> off) for one
// traveler's picks. Shared by the organizer and every added traveler.
// Default: one card per category (main picker). `flat`: plain groups with no
// card chrome, for use inside an already-carded traveler block.
export default function InterestPicker({ interests, priorityInterests, onCycle, flat = false }) {
  return INTEREST_GROUPS.map((group) => (
    <section key={group.key} className={flat ? "interest-group" : "panel interest-group"}>
      <h4 className="interest-group-label">{group.label}</h4>
      <div className="interest-list">
        {[...group.tags].sort((a, b) => priorityInterests.includes(b.id) - priorityInterests.includes(a.id)).map((tag) => {
          const Icon = TAG_ICONS[tag.id] || Trees;
          const isSelected = interests.includes(tag.id);
          const isPriority = priorityInterests.includes(tag.id);
          return (
            <button
              type="button"
              key={tag.id}
              className={`interest-option ${isSelected ? "selected" : ""} ${isPriority ? "priority" : ""}`}
              onClick={() => onCycle(tag.id)}
              aria-pressed={isSelected}
              title={isPriority ? "Must-have - tap to clear" : isSelected ? "Tap again to mark as must-have" : "Tap to add"}
            >
              <Icon size={22} />
              <span>{tag.label}</span>
              {isPriority ? <Star size={14} className="interest-badge" /> : isSelected && <Check size={14} className="interest-badge" />}
            </button>
          );
        })}
      </div>
    </section>
  ));
}
