import { CheckCircle2, Circle, X } from "lucide-react";
import { Link } from "react-router-dom";

import useTips from "../../store/tipsStore.js";
import "../../styles/onboarding.css";

// Dashboard card for new accounts. Each step ticks itself when the user has
// really done it (from their trips and groups), so it never needs a "next"
// button, and it goes away on its own once everything is done.
export default function GetStarted({ trips, groups }) {
  const { has, mark } = useTips();
  const firstTrip = trips[0];

  const steps = [
    {
      key: "trip",
      done: trips.length > 0,
      to: "/recommendations",
      title: "Plan your first trip",
      detail: "Answer a few questions and get destination ideas.",
    },
    {
      key: "stop",
      done: trips.some((trip) => (trip._count?.itinerary || 0) > 0),
      to: firstTrip ? `/trips/${firstTrip.id}` : "/recommendations",
      title: "Add a stop to your itinerary",
      detail: "Save places to a day-by-day plan.",
    },
    {
      key: "group",
      done: groups.length > 0,
      to: "/family",
      title: "Add the people you travel with",
      detail: "Make a travel group to plan together.",
    },
    {
      key: "chat",
      done: has("done:chat"),
      to: "/chat",
      title: "Ask the trip assistant something",
      detail: "Try: \"What's the weather like during my trip?\"",
    },
  ];
  const finished = steps.filter((step) => step.done).length;

  if (has("checklist") || finished === steps.length) return null;

  return (
    <section className="dashboard-card get-started" aria-label="Get started">
      <div className="card-heading">
        <div>
          <h2>Get started</h2>
          <p>{finished} of {steps.length} done</p>
        </div>
        <button type="button" className="get-started-hide" onClick={() => mark("checklist")} aria-label="Hide this checklist">
          <X size={16} /> Hide
        </button>
      </div>

      <ul>
        {steps.map(({ key, done, to, title, detail }) => (
          <li key={key} className={done ? "is-done" : ""}>
            <Link to={to}>
              {done ? <CheckCircle2 size={20} aria-hidden="true" /> : <Circle size={20} aria-hidden="true" />}
              <span>
                <strong>{title}</strong>
                <small>{detail}</small>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
