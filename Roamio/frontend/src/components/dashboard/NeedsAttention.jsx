import { useEffect, useState } from "react";
import { BellRing, CalendarCheck, ChevronRight, ShieldAlert, Wallet } from "lucide-react";
import { Link } from "react-router-dom";

import { fetchBudgetSummary } from "../../api/budget.js";
import { fetchNotifications } from "../../api/notifications.js";
import { fetchCountrySafety } from "../../api/tripHub.js";
import { fetchTrip } from "../../api/trips.js";
import { splitDestination } from "../../utils/countries.js";

const DAY_MS = 24 * 60 * 60 * 1000;
const dayStart = (value) => {
  const date = new Date(value);
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
};

// Dashboard card: only things to act on - today's stops on a trip that's
// under way, a serious advisory or a budget at 80%+ for the next trip, and
// unread notifications. Each line links to where it's dealt with.
export default function NeedsAttention({ trips, nextTrip }) {
  const [items, setItems] = useState(null);

  const today = dayStart(Date.now());
  const ongoing = trips.find((trip) => trip.startDate && dayStart(trip.startDate) <= today && today <= dayStart(trip.endDate || trip.startDate));
  const watched = ongoing || nextTrip;

  useEffect(() => {
    let active = true;
    const found = [];

    const todayStops = ongoing
      ? fetchTrip(ongoing.id).then((trip) => {
          const dayNumber = Math.round((today - dayStart(trip.startDate)) / DAY_MS) + 1;
          const stops = (trip.itinerary || []).filter((item) => item.dayNumber === dayNumber);
          if (stops.length > 0) {
            found.push({
              key: "today",
              icon: CalendarCheck,
              to: `/trips/${trip.id}`,
              title: `Today in ${splitDestination(trip.destination).city || trip.title}`,
              detail: stops.map((stop) => `${stop.startTime} ${stop.title}`).join(" · "),
            });
          }
        })
      : Promise.resolve();

    const info = watched?.destination ? splitDestination(watched.destination).info : null;
    const safety = info
      ? fetchCountrySafety(info.iso3).then((advisory) => {
          if (advisory.riskLevel >= 3) {
            found.push({
              key: "safety",
              icon: ShieldAlert,
              to: `/trips/${watched.id}`,
              title: `${advisory.advisoryLevel} - ${splitDestination(watched.destination).country}`,
              detail: advisory.source === "MOCK" ? "Sample advisory (no live feed configured)" : advisory.summary,
            });
          }
        })
      : Promise.resolve();

    const budget = watched
      ? fetchBudgetSummary(watched.id).then((summary) => {
          summary.warnings.forEach((text, index) =>
            found.push({ key: `b${index}`, icon: Wallet, to: `/trips/${watched.id}/budget`, title: watched.title, detail: text })
          );
        })
      : Promise.resolve();

    const inbox = fetchNotifications().then((data) => {
      (data?.notifications || [])
        .filter((note) => !note.isRead)
        .slice(0, 3)
        .forEach((note) => found.push({ key: `n${note.id}`, icon: BellRing, title: note.title, detail: note.message }));
    });

    // each source on its own: one failing doesn't hide the others
    Promise.allSettled([todayStops, safety, budget, inbox]).then(() => {
      if (active) setItems([...found]);
    });
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ongoing?.id, watched?.id]);

  return (
    <section className="dashboard-card attention-card">
      <div className="card-heading">
        <div>
          <h2>Needs your attention</h2>
        </div>
      </div>

      {items === null ? (
        <p className="attention-empty">Checking...</p>
      ) : items.length === 0 ? (
        <p className="attention-empty">Nothing right now.</p>
      ) : (
        <ul className="attention-list">
          {items.map(({ key, icon: Icon, to, title, detail }) => {
            const body = (
              <>
                <Icon size={17} />
                <span>
                  <strong>{title}</strong>
                  {detail && <small>{detail}</small>}
                </span>
                {to && <ChevronRight size={15} />}
              </>
            );
            return <li key={key}>{to ? <Link to={to}>{body}</Link> : <div>{body}</div>}</li>;
          })}
        </ul>
      )}
    </section>
  );
}
