import { ArrowRight, Check } from "lucide-react";
import { Link } from "react-router-dom";

export default function TripDone({ cityName, tripId, days }) {
  const stops = days.reduce((sum, day) => sum + day.stops.length, 0);
  return (
    <section className="recommendations-results trip-done">
      <span className="trip-done-badge"><Check size={30} /></span>
      <p className="recommendations-eyebrow">Trip created</p>
      <h2>Your trip to {cityName} is ready.</h2>
      <p className="wizard-help">
        We saved {stops} stop{stops === 1 ? "" : "s"} across {days.length} day{days.length === 1 ? "" : "s"}.
      </p>
      <div className="wizard-actions">
        <Link to="/dashboard" className="secondary-button">Back to dashboard</Link>
        {tripId && (
          <Link to={`/trips/${tripId}`} className="recommendations-submit">View itinerary <ArrowRight size={17} /></Link>
        )}
      </div>
    </section>
  );
}
