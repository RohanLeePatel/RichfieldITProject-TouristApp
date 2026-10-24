import { useEffect, useState } from "react";
import {
  BookOpen, CalendarCheck, Lightbulb, LoaderCircle, Shirt, Snowflake, Sun, ThermometerSun, Umbrella, Wind, CloudSun,
} from "lucide-react";

import { fetchClimate, fetchPlaceSummary, geocodePlace } from "../../api/climate.js";
import {
  MONTH_NAMES, bestMonths, combineAdvice, comfortScore,
} from "../../utils/travelAdvice.js";
import "../../styles/insights.css";

const TIP_ICONS = { hot: ThermometerSun, sun: Sun, cold: Snowflake, mild: CloudSun, layers: Shirt, rain: Umbrella, dry: Sun, wind: Wind };

// Typical weather for one month, a 12-month "best time to visit" chart, packing
// advice and a short place summary - all from free keyless sources
// (api/climate.js). Give it a place name (+ country); latitude/longitude skip
// the geocoding step when the caller already has them. `forecast` (optional,
// Celsius) adds tips for the coming days.
export default function ClimateInsights({ name, country, latitude, longitude, month, forecast, showAbout = true, heading }) {
  const [state, setState] = useState({ status: "loading" });
  const [selectedMonth, setSelectedMonth] = useState(month || new Date().getMonth() + 1);

  useEffect(() => {
    if (month) setSelectedMonth(month);
  }, [month]);

  useEffect(() => {
    let active = true;
    setState({ status: "loading" });
    (async () => {
      try {
        const place = Number.isFinite(latitude) && Number.isFinite(longitude)
          ? { name, country, latitude, longitude }
          : await geocodePlace(name, country);
        const [climate, about] = await Promise.all([
          fetchClimate(place.latitude, place.longitude),
          showAbout ? fetchPlaceSummary(name, country).catch(() => null) : Promise.resolve(null),
        ]);
        if (active) setState({ status: "ready", climate, about });
      } catch (error) {
        if (active) setState({ status: "error", message: error instanceof Error ? error.message : "Could not load travel insights." });
      }
    })();
    return () => {
      active = false;
    };
  }, [name, country, latitude, longitude, showAbout]);

  if (state.status === "loading") {
    return <p className="insights-note"><LoaderCircle className="insights-spinner" size={15} /> Loading climate and travel tips...</p>;
  }
  if (state.status === "error") {
    return <p className="insights-note">Travel insights are unavailable right now. {state.message}</p>;
  }

  const { climate, about } = state;
  const stats = climate.months[selectedMonth - 1];
  const best = bestMonths(climate.months, 3);
  const tips = combineAdvice(forecast, stats);
  // stretch bars across the actual min-max so small differences are visible
  const scores = climate.months.map((m) => comfortScore(m)).filter((s) => s !== null);
  const lo = Math.min(...scores);
  const span = Math.max(...scores) - lo || 1;
  const fmt = (value, unit = "") => (value == null ? "-" : `${Math.round(value)}${unit}`);

  return (
    <div className="insights">
      <div className="insights-grid">
        <section className="insights-card">
          <h3>{heading || `Typical weather in ${MONTH_NAMES[selectedMonth - 1]}`}</h3>
          <div className="insights-stats">
            <div><span>Daytime high</span><strong>{fmt(stats.highC, "°C")}</strong></div>
            <div><span>Night low</span><strong>{fmt(stats.lowC, "°C")}</strong></div>
            <div><span>Days with rain</span><strong>{stats.rainyDayPct == null ? "-" : `${Math.round(stats.rainyDayPct * 100)}%`}</strong></div>
            <div><span>Monthly rain</span><strong>{fmt(stats.rainMm, " mm")}</strong></div>
          </div>
          <p className="insights-fine">Average of {climate.fromYear}–{climate.toYear} daily records.</p>
        </section>

        <section className="insights-card">
          <h3><Lightbulb size={15} /> Advice for your trip</h3>
          <ul className="insights-tips">
            {tips.map((tip, index) => {
              const Icon = TIP_ICONS[tip.kind] || Lightbulb;
              return <li key={index}><Icon size={16} /> <span>{tip.text}</span></li>;
            })}
          </ul>
        </section>
      </div>

      <section className="insights-card">
        <h3><CalendarCheck size={15} /> Best time to visit</h3>
        <p className="insights-fine">
          Taller bar = milder, drier weather. Best months: <b>{[...best].sort((a, b) => a - b).map((m) => MONTH_NAMES[m - 1]).join(", ")}</b>. Click a month to see its details.
        </p>
        <div className="insights-months" role="list">
          {climate.months.map((m) => {
            const score = comfortScore(m) ?? 0;
            return (
              <button
                type="button"
                role="listitem"
                key={m.month}
                className={`${best.includes(m.month) ? "best" : ""} ${m.month === selectedMonth ? "selected" : ""}`}
                onClick={() => setSelectedMonth(m.month)}
                aria-label={`${MONTH_NAMES[m.month - 1]}: comfort ${score} out of 100`}
                aria-pressed={m.month === selectedMonth}
              >
                <i style={{ height: `${20 + (80 * (score - lo)) / span}%` }} />
                <span>{MONTH_NAMES[m.month - 1].slice(0, 3)}</span>
              </button>
            );
          })}
        </div>
      </section>

      {showAbout && about && (
        <section className="insights-card insights-about">
          {about.thumbnail && <img src={about.thumbnail} alt="" loading="lazy" />}
          <div>
            <h3><BookOpen size={15} /> About this place</h3>
            <p>{about.extract}</p>
            {about.url && <a href={about.url} target="_blank" rel="noreferrer">Read more on Wikipedia</a>}
          </div>
        </section>
      )}

      <p className="insights-fine insights-credit">
        Weather history by <a href="https://open-meteo.com/" target="_blank" rel="noreferrer">Open-Meteo.com</a>
        {showAbout && about ? " · place text from Wikipedia (CC BY-SA)" : ""}.
      </p>
    </div>
  );
}
