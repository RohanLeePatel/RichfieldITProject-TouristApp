import { ArrowRight, Check, CloudSun, FileText, Languages, Users } from "lucide-react";
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
      {/* what most people do next - each opens on this trip, nothing to retype */}
      {tripId && (
        <ul className="trip-done-next">
          <li><Link to={`/weather?trip=${tripId}`}><CloudSun size={16} /> Check the weather</Link></li>
          <li><Link to="/family"><Users size={16} /> Invite your travel group</Link></li>
          <li><Link to={`/trips/${tripId}`}><FileText size={16} /> Add tickets and bookings</Link></li>
          <li><Link to={`/translator?trip=${tripId}`}><Languages size={16} /> Get the translator ready</Link></li>
        </ul>
      )}
      <div className="wizard-actions">
        <Link to="/dashboard" className="secondary-button">Back to dashboard</Link>
        {tripId && (
          <Link to={`/trips/${tripId}`} className="recommendations-submit">Open your trip <ArrowRight size={17} /></Link>
        )}
      </div>
    </section>
  );
}
