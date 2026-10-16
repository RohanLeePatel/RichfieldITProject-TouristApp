import { Compass, MapPin } from "lucide-react";
import { Link } from "react-router-dom";

import { PACE_OPTIONS, TRIP_TEMPLATES } from "../../pages/recommendations/constants.js";

const paceLabel = (id) => PACE_OPTIONS.find((option) => option.id === id)?.label || id;

// Starting points for a trip, instead of a blank wizard. Each card hands the
// template id to the wizard, which fills the form and jumps to the review
// step - the ranking and landmark lookups still run normally from there, so
// nothing here is a canned itinerary.
export default function TripTemplates() {
  return (
    <section className="recommendations-results trip-templates">
      <div className="results-heading">
        <div>
          <h2>Start from a shape of trip</h2>
          <p>Pick one as a starting point, then change anything before we search.</p>
        </div>
      </div>

      <div className="trips-grid">
        {TRIP_TEMPLATES.map((template) => (
          <Link key={template.id} to={`/explore?template=${template.id}`} className="trips-grid-card">
            <h3>{template.label}</h3>
            <p className="trips-grid-destination">
              <MapPin size={14} /> {template.country}
            </p>
            <p className="template-blurb">{template.blurb}</p>
            <p className="trips-grid-dates">
              {paceLabel(template.pace)} pace · around {template.budget} a day
            </p>
            <span className="trips-grid-link">
              <Compass size={15} /> Use this starting point
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}
