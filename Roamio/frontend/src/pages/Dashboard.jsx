import {
  Plane,
  Map,
  Users,
  Sparkles,
  MapPin,
  CalendarDays,
  Plus,
  ArrowRight,
  Compass,
  ChevronRight,
  Clock3,
  CheckCircle2,
  Menu,
  CloudSun,
  Cloud,
  CloudRain,
  CloudLightning,
  Snowflake,
  Sun,
  Droplets,
  Wind,
  RefreshCw,
  Luggage,
} from "lucide-react";

import { useCallback, useEffect, useState } from "react";
import {
  Link,
  useNavigate,
} from "react-router-dom";

import { fetchWeather as fetchWeatherFromApi } from "../api/weather";
import { fetchMyGroups } from "../api/groups.js";
import { fetchTrips } from "../api/trips";
import { useAuthStore } from "../store/authStore.js";

import NeedsAttention from "../components/dashboard/NeedsAttention.jsx";
import GetStarted from "../components/onboarding/GetStarted.jsx";
import LanguagePrompt from "../components/onboarding/LanguagePrompt.jsx";
import ChatWidget from "../components/chat/ChatWidget.jsx";
import TermsGate from "../components/onboarding/TermsGate.jsx";
import AppSidebar from "../components/layout/AppSidebar.jsx";
import useActiveTrip from "../hooks/useActiveTrip.js";
import NextStop from "../components/dashboard/NextStop.jsx";
import useTheme from "../components/recommendations/useTheme.js";
import "../styles/dashboard.css";

// Unsplash photo (free to use under the Unsplash License)
import heroPhoto from "../assets/dashboard/hero-alps.jpg";

// =========================================================
// CONSTANTS
// =========================================================

// how many group members the dashboard card lists before "+N more"
const GROUP_PREVIEW_LIMIT = 4;

const DAY_MS = 24 * 60 * 60 * 1000;

// =========================================================
// TRIP HELPERS
// =========================================================

// "Upcoming" used to mean "happening now" and every future trip read
// "Planning" - now a dated future trip is Upcoming and a current one In progress.
function tripStatus(trip) {
  if (!trip.startDate) return "Planning";

  const start = new Date(trip.startDate);
  const end = trip.endDate
    ? new Date(trip.endDate)
    : start;

  const now = new Date();

  if (now > end) return "Completed";
  if (now >= start) return "In progress";

  return "Upcoming";
}

const STATUS_STYLE = {
  Planning: { className: "planning", icon: Clock3 },
  Upcoming: { className: "upcoming", icon: CalendarDays },
  "In progress": { className: "active", icon: CheckCircle2 },
};

function tripDateLabel(trip) {
  if (!trip.startDate) return "Dates not set";

  const format = (iso) =>
    new Date(iso).toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
    });

  return trip.endDate
    ? `${format(trip.startDate)} – ${format(trip.endDate)}`
    : format(trip.startDate);
}

// whole days from today to the trip start (0 = today), or null without dates
function daysUntil(trip) {
  if (!trip?.startDate) return null;

  const start = new Date(trip.startDate);
  const today = new Date();

  start.setHours(0, 0, 0, 0);
  today.setHours(0, 0, 0, 0);

  return Math.round((start - today) / DAY_MS);
}

function hasEnded(trip) {
  const end = new Date(trip.endDate || trip.startDate);
  const today = new Date();

  end.setHours(0, 0, 0, 0);
  today.setHours(0, 0, 0, 0);

  return end < today;
}

function countdownLabel(trip) {
  const days = daysUntil(trip);

  if (days === null) return "Add dates";
  if (days < 0) return "Happening now";
  if (days === 0) return "Today";
  if (days === 1) return "Tomorrow";

  return `In ${days} days`;
}

// =========================================================
// SORT / NEXT TRIP HELPERS
// =========================================================

function getRelevantTrips(trips) {
  return [...trips]
    .filter(
      (trip) =>
        tripStatus(trip) !== "Completed"
    )
    .sort((a, b) => {
      if (!a.startDate && !b.startDate) {
        return 0;
      }

      if (!a.startDate) return 1;
      if (!b.startDate) return -1;

      return (
        new Date(a.startDate) -
        new Date(b.startDate)
      );
    });
}

function getNextTrip(trips) {
  return getRelevantTrips(trips)[0] || null;
}

// =========================================================
// WEATHER HELPERS
// =========================================================

function getDashboardWeatherInfo(description) {
  const normalizedDescription = String(
    description || ""
  ).toLowerCase();

  if (
    normalizedDescription.includes("thunder") ||
    normalizedDescription.includes("storm")
  ) {
    return {
      label: "Thunderstorm",
      icon: CloudLightning,
      className: "storm",
    };
  }

  if (
    normalizedDescription.includes("snow") ||
    normalizedDescription.includes("sleet") ||
    normalizedDescription.includes("ice")
  ) {
    return {
      label: "Snow",
      icon: Snowflake,
      className: "snow",
    };
  }

  if (
    normalizedDescription.includes("rain") ||
    normalizedDescription.includes("shower") ||
    normalizedDescription.includes("drizzle")
  ) {
    return {
      label: "Rain",
      icon: CloudRain,
      className: "rain",
    };
  }

  if (
    normalizedDescription.includes("cloud") ||
    normalizedDescription.includes("overcast")
  ) {
    return {
      label: normalizedDescription.includes(
        "overcast"
      )
        ? "Overcast"
        : "Partly cloudy",
      icon: Cloud,
      className: "cloud",
    };
  }

  if (
    normalizedDescription.includes("clear") ||
    normalizedDescription.includes("sun")
  ) {
    return {
      label: "Clear sky",
      icon: Sun,
      className: "sun",
    };
  }

  return {
    label: "Current conditions",
    icon: CloudSun,
    className: "default",
  };
}

// =========================================================
// DATE / GREETING
// =========================================================

function getDashboardDate() {
  return new Date().toLocaleDateString(
    "en-ZA",
    {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    }
  );
}

// the hero always said "Good morning", even at night
function getGreeting() {
  const hour = new Date().getHours();

  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";

  return "Good evening";
}

// =========================================================
// TRAVEL GROUP
// =========================================================

// The stand-in group shown when the user isn't in a travel group yet: just themselves.
// The status "Organizer" here, and on the group member list below, is a display label
// for the signed-in user. It does not grant any permission.
function getDefaultGroupMembers(
  userName,
  initials
) {
  return [
    {
      id: "member-1",
      name: userName,
      relationship: "Trip organizer",
      role: "Trip organizer",
      type: "Adult",
      email: "",
      initials,
      color: "blue",
      interests: [],
      trips: 0,
      status: "Organizer",
    },
  ];
}

// =========================================================
// COUNT-UP
// =========================================================

const prefersReducedMotion = () =>
  window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;

// Animates a stat from 0 up to its value (ease-out), e.g. once trips load.
function CountUp({ value, duration = 900 }) {
  const [shown, setShown] = useState(0);

  useEffect(() => {
    if (prefersReducedMotion()) return undefined;

    let frame;
    const start = performance.now();

    const tick = (now) => {
      const t = Math.min(1, (now - start) / duration);
      setShown(Math.round(value * (1 - Math.pow(1 - t, 3))));
      if (t < 1) frame = requestAnimationFrame(tick);
    };

    frame = requestAnimationFrame(tick);

    return () => cancelAnimationFrame(frame);
  }, [value, duration]);

  return prefersReducedMotion() ? value : shown;
}

// =========================================================
// DASHBOARD
// =========================================================

export default function Dashboard() {
  const { theme } = useTheme(); // follows the app-wide theme selected in Settings
  const navigate = useNavigate();

  // =========================================================
  // MOBILE MENU
  // =========================================================

  const [mobileMenu, setMobileMenu] =
    useState(false);

  // =========================================================
  // WEATHER STATE
  // =========================================================

  const [weather, setWeather] =
    useState(null);

  const [weatherLoading, setWeatherLoading] =
    useState(true);

  const [weatherError, setWeatherError] =
    useState("");

  // =========================================================
  // USER
  // =========================================================

  // from the auth store, which merges in the name/photo saved in Settings
  const savedUser =
    useAuthStore((state) => state.user) || {};

  let userName =
    savedUser?.name ||
    savedUser?.fullName ||
    savedUser?.firstName ||
    "";

  if (!userName) {
    userName = "Roamio User";
  }

  userName = userName.trim();

  const firstName =
    userName.split(/\s+/)[0] || "Roamio";

  const initials =
    userName
      .split(/\s+/)
      .filter(Boolean)
      .map((word) =>
        word.charAt(0)
      )
      .join("")
      .substring(0, 2)
      .toUpperCase() || "R";

  // =========================================================
  // TRIPS
  // =========================================================

  const [trips, setTrips] =
    useState([]);

  // the dashboard is about the trip picked in the sidebar (taken from this
  // page's own fresh list); the next upcoming one until a trip is picked
  const { trip: activeTrip } = useActiveTrip();
  const nextTrip =
    trips.find((trip) => String(trip.id) === String(activeTrip?.id)) ||
    getNextTrip(trips);

  const [tripsLoading, setTripsLoading] =
    useState(true);

  const [tripsError, setTripsError] =
    useState("");

  useEffect(() => {
    let active = true;

    setTripsLoading(true);
    setTripsError("");

    fetchTrips()
      .then((data) => {
        if (!active) return;

        setTrips(
          Array.isArray(data)
            ? data
            : []
        );
      })
      .catch((error) => {
        if (!active) return;

        setTripsError(
          error instanceof Error
            ? error.message
            : "Could not load your trips."
        );
      })
      .finally(() => {
        if (active) {
          setTripsLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, []);

  // =========================================================
  // TRAVEL GROUP
  // =========================================================

  // the active trip's travel group: its members (you marked), then its
  // companions without an account; just you for a solo trip
  const [groups, setGroups] = useState([]);
  useEffect(() => {
    fetchMyGroups().then(setGroups).catch(() => setGroups([]));
  }, []);

  const tripGroup = groups.find((group) => group.id === nextTrip?.travelGroupId) || null;
  const initialsOf = (name) =>
    name.trim().split(/\s+/).slice(0, 2).map((part) => part.charAt(0)).join("").toUpperCase() || "?";
  const groupMembers = tripGroup
    ? [
        ...tripGroup.members.map((member) => ({
          id: `u${member.userId}`,
          name: member.user?.fullName || "Member",
          initials: initialsOf(member.user?.fullName || "Member"),
          role: member.role.charAt(0) + member.role.slice(1).toLowerCase(),
          status: member.userId === savedUser.id ? "Organizer" : "",
        })),
        ...(tripGroup.companions || []).map((companion) => ({
          id: companion.id,
          name: companion.name,
          initials: initialsOf(companion.name),
          role: companion.type === "Child" ? "Child, no account" : "No account",
        })),
      ]
    : getDefaultGroupMembers(userName, initials);

  // =========================================================
  // WEATHER
  // =========================================================

  const fetchDashboardWeather =
    useCallback(async () => {
      try {
        setWeatherLoading(true);
        setWeatherError("");

        if (
          !nextTrip?.destination
        ) {
          setWeather(null);
          setWeatherLoading(false);
          return;
        }

        const data =
          await fetchWeatherFromApi(
            nextTrip.destination
          );

        setWeather(data);
      } catch (error) {
        console.error(
          "Could not load dashboard weather:",
          error
        );

        setWeatherError(
          "Weather information is currently unavailable."
        );
      } finally {
        setWeatherLoading(false);
      }
    }, [nextTrip?.id, nextTrip?.destination]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    fetchDashboardWeather();
  }, [fetchDashboardWeather]);

  // =========================================================
  // DERIVED DATA
  // =========================================================

  const relevantTrips =
    getRelevantTrips(trips);

  const nextTripDays =
    daysUntil(nextTrip);

  const completedTrips =
    trips.filter(
      (trip) =>
        tripStatus(trip) ===
        "Completed"
    );

  const displayedTrips =
    relevantTrips.slice(0, 4);

  const shownMembers =
    groupMembers.slice(0, GROUP_PREVIEW_LIMIT);

  const hiddenMemberCount =
    groupMembers.length - shownMembers.length;

  const stats = [
    {
      to: "/trips",
      label: "Current & upcoming",
      value: relevantTrips.length,
      icon: Plane,
      tone: "blue",
    },
    {
      to: "/trips",
      label: "Total trips",
      value: trips.length,
      icon: Compass,
      tone: "teal",
    },
    {
      to: "/trips?status=completed",
      label: "Completed",
      value: completedTrips.length,
      icon: CheckCircle2,
      tone: "purple",
    },
    {
      to: "/family",
      label: "Group members",
      value: groupMembers.length,
      icon: Users,
      tone: "orange",
    },
  ];

  // =========================================================
  // NAVIGATION
  // =========================================================

  const closeMobileMenu = () => {
    setMobileMenu(false);
  };

  // =========================================================
  // ACTIONS
  // =========================================================

  const handleCreateTrip = () => {
    navigate("/recommendations");
  };

  const handleOpenGroup = () => {
    navigate(tripGroup ? `/family?group=${tripGroup.id}` : "/family");
  };

  // =========================================================
  // WEATHER BODY
  // =========================================================

  const renderWeather = () => {
    if (weatherLoading) {
      return (
        <div className="weather-state">
          <RefreshCw
            size={22}
            className="weather-refresh-spin"
          />

          <div>
            <strong>Checking the skies…</strong>
            <span>Getting the latest weather for your next trip.</span>
          </div>
        </div>
      );
    }

    if (weatherError) {
      return (
        <div className="weather-state">
          <CloudSun size={22} />

          <div>
            <strong>Weather unavailable</strong>
            <span>{weatherError}</span>

            <button
              type="button"
              className="text-button"
              onClick={fetchDashboardWeather}
            >
              Try again
              <ArrowRight size={14} />
            </button>
          </div>
        </div>
      );
    }

    if (!weather) {
      return (
        <div className="weather-state">
          <CloudSun size={22} />

          <div>
            <strong>Your trip weather awaits</strong>
            <span>
              Create a trip with a destination and we'll show its current
              weather here.
            </span>

            <button
              type="button"
              className="text-button"
              onClick={handleCreateTrip}
            >
              Plan a trip
              <ArrowRight size={14} />
            </button>
          </div>
        </div>
      );
    }

    const weatherInfo =
      getDashboardWeatherInfo(
        weather?.current?.description
      );

    const WeatherIcon =
      weatherInfo.icon;

    const temperature =
      Math.round(
        weather?.current?.temp ?? 0
      );

    const humidity =
      weather?.current?.humidity;

    const windSpeed =
      weather?.current?.wind_speed;

    return (
      <>
        <div className="weather-now">
          <div
            className={`weather-now-icon weather-icon-${weatherInfo.className}`}
          >
            <WeatherIcon
              size={40}
              strokeWidth={1.6}
            />
          </div>

          <div className="weather-now-copy">
            <strong className="weather-temp">
              {temperature}°
            </strong>

            <span className="weather-condition">
              {weatherInfo.label}
            </span>
          </div>
        </div>

        <dl className="weather-metrics">
          <div>
            <dt>
              <Droplets size={15} />
              Humidity
            </dt>

            <dd>{humidity ?? "--"}%</dd>
          </div>

          <div>
            <dt>
              <Wind size={15} />
              Wind
            </dt>

            <dd>
              {windSpeed != null
                ? `${Math.round(windSpeed * 3.6)} km/h`
                : "--"}
            </dd>
          </div>
        </dl>

        <Link
          to={nextTrip ? `/weather?trip=${nextTrip.id}` : "/weather"}
          className="card-footer-link"
        >
          Full forecast
          <ArrowRight size={15} />
        </Link>
      </>
    );
  };

  // =========================================================
  // RETURN
  // =========================================================

  return (
    <div className="dashboard-page" data-theme={theme}>

      {/* =====================================================
          SIDEBAR
      ===================================================== */}

      <AppSidebar open={mobileMenu} onClose={closeMobileMenu} />
      <ChatWidget />
      <TermsGate />

      {/* =====================================================
          MAIN
      ===================================================== */}

      <main className="dashboard-main">

        {/* HEADER */}

        <header className="dashboard-header">

          <button
            type="button"
            className="mobile-menu-button"
            onClick={() =>
              setMobileMenu(true)
            }
            aria-label="Open menu"
          >
            <Menu size={20} />
          </button>

          <div className="header-date">
            <CalendarDays size={16} />

            <span>{getDashboardDate()}</span>
          </div>

          <div className="header-actions">

            <Link
              to="/settings"
              className="header-profile"
              aria-label="Profile and settings"
            >

              <div className="profile-avatar">
                {savedUser.photo ? (
                  <img src={savedUser.photo} alt="" />
                ) : (
                  initials
                )}
              </div>

              <div className="profile-details">
                <strong>{userName}</strong>
                <span>Profile & settings</span>
              </div>

              <ChevronRight size={16} />

            </Link>

          </div>

        </header>

        {/* ===================================================
            DASHBOARD CONTENT
        =================================================== */}

        {/* HERO - full-width photo band; the stat cards overlap its edge */}

        <section className="hero-band">

          <div
            className="hero-photo"
            style={{ backgroundImage: `url(${heroPhoto})` }}
            aria-hidden="true"
          />

          <div className="hero-shade" aria-hidden="true" />

          <div className="hero-section">

            <div className="hero-content">

              <p className="hero-badge">
                <Sparkles size={14} />
                Smart group travel
              </p>

              <h1>
                {getGreeting()}, <span>{firstName}</span>
              </h1>

              <p className="hero-subtitle">
                {nextTrip
                  ? "Here's where your group's plans stand today."
                  : "Ready to plan your next group adventure? Everything you need is in one place."}
              </p>

              <div className="hero-actions">

                <button
                  type="button"
                  className="hero-button"
                  onClick={handleCreateTrip}
                >
                  <Plus size={18} />
                  Plan a new trip
                </button>

                <Link
                  to="/trips"
                  className="hero-button secondary"
                >
                  View my trips
                </Link>

              </div>

            </div>

            {/* NEXT TRIP SPOTLIGHT */}

            {nextTrip ? (
              <Link
                to={`/trips/${nextTrip.id}`}
                className="hero-spotlight"
              >

                <span className="spotlight-label">
                  <Luggage size={14} />
                  Active trip
                </span>

                <div className="spotlight-countdown">
                  {nextTripDays === null ? (
                    <strong className="spotlight-word">
                      Dates TBC
                    </strong>
                  ) : nextTripDays <= 0 ? (
                    <strong className="spotlight-word">
                      {nextTripDays === 0 ? "Today" : hasEnded(nextTrip) ? "Finished" : "Underway"}
                    </strong>
                  ) : (
                    <>
                      <strong>{nextTripDays}</strong>
                      <span>
                        {nextTripDays === 1 ? "day to go" : "days to go"}
                      </span>
                    </>
                  )}
                </div>

                <div className="spotlight-route" aria-hidden="true">
                  <span className="route-dot" />

                  <span className="route-line">
                    <Plane size={16} className="route-plane" />
                  </span>

                  <MapPin size={16} className="route-pin" />
                </div>

                <div className="spotlight-trip">
                  <strong>
                    {nextTrip.title || "Untitled trip"}
                  </strong>

                  <span>
                    <MapPin size={14} />
                    {nextTrip.destination || "Destination not set"}
                  </span>

                  <span>
                    <CalendarDays size={14} />
                    {tripDateLabel(nextTrip)}
                  </span>
                </div>

                <span className="spotlight-link">
                  Open trip
                  <ArrowRight size={15} />
                </span>

              </Link>
            ) : (
              <div className="hero-spotlight is-empty">

                <span className="spotlight-label">
                  <Luggage size={14} />
                  Next trip
                </span>

                <div className="spotlight-trip">
                  <strong>Nothing booked yet</strong>

                  <span>
                    Answer a few questions and Roamio suggests destinations
                    your whole group will enjoy.
                  </span>
                </div>

              </div>
            )}

          </div>

        </section>

        <div className="dashboard-content">

          {/* =================================================
              STATS
          ================================================= */}

          <section
            className="stats-grid"
            aria-label="Trip summary"
          >

            {stats.map(({ to, label, value, icon: Icon, tone }) => (
              <Link
                key={label}
                to={to}
                className="stat-card"
              >

                <div className={`stat-icon ${tone}`}>
                  <Icon size={19} />
                </div>

                <div className="stat-info">
                  <strong>
                    {tripsLoading && label !== "Group members"
                      ? "–"
                      : <CountUp value={value} />}
                  </strong>

                  <span>{label}</span>
                </div>

              </Link>
            ))}

          </section>

          {/* =================================================
              MAIN GRID
          ================================================= */}

          <LanguagePrompt />
          {!tripsLoading && !tripsError && <GetStarted trips={trips} groups={groups} />}

          <NextStop trip={nextTrip} />

          <div className="dashboard-grid">

            {/* TRIPS */}

            <section className="dashboard-card trips-section">

              <div className="card-heading">

                <h2>Upcoming trips</h2>

                {relevantTrips.length > 0 && (
                  <Link
                    to="/trips"
                    className="view-all"
                  >
                    View all
                    <ArrowRight size={15} />
                  </Link>
                )}

              </div>

              {tripsLoading ? (

                <div
                  className="trip-list"
                  aria-busy="true"
                  aria-label="Loading your trips"
                >
                  {[0, 1, 2].map((i) => (
                    <div
                      className="trip-row skeleton"
                      key={i}
                    />
                  ))}
                </div>

              ) : tripsError ? (

                <div className="empty-state">
                  <div className="empty-icon">
                    <Map size={22} />
                  </div>

                  <strong>We couldn't load your trips</strong>

                  <p>{tripsError}</p>

                  <button
                    type="button"
                    className="primary-button"
                    onClick={() => window.location.reload()}
                  >
                    <RefreshCw size={16} />
                    Try again
                  </button>
                </div>

              ) : displayedTrips.length === 0 ? (

                <div className="empty-state">
                  <div className="empty-icon">
                    <Plane size={22} />
                  </div>

                  <strong>No upcoming trips yet</strong>

                  <p>
                    Plan your next adventure and it will show up here with a
                    countdown and live weather.
                  </p>

                  <button
                    type="button"
                    className="primary-button"
                    onClick={handleCreateTrip}
                  >
                    <Plus size={16} />
                    Plan a new trip
                  </button>
                </div>

              ) : (

                <ul className="trip-list">

                  {displayedTrips.map((trip) => {
                    const status =
                      tripStatus(trip);

                    const { className, icon: StatusIcon } =
                      STATUS_STYLE[status];

                    const start = trip.startDate
                      ? new Date(trip.startDate)
                      : null;

                    return (
                      <li key={trip.id}>
                        <Link
                          to={`/trips/${trip.id}`}
                          className="trip-row"
                        >

                          <div
                            className={`trip-date-tile ${
                              start ? "" : "is-empty"
                            }`}
                            aria-hidden="true"
                          >
                            {start ? (
                              <>
                                <span>
                                  {start.toLocaleDateString("en-GB", {
                                    month: "short",
                                  })}
                                </span>

                                <strong>{start.getDate()}</strong>
                              </>
                            ) : (
                              <CalendarDays size={20} />
                            )}
                          </div>

                          <div className="trip-info">
                            <h3>
                              {trip.title || "Untitled trip"}
                            </h3>

                            <div className="trip-meta">
                              <span>
                                <MapPin size={14} />
                                {trip.destination || "Destination not set"}
                              </span>

                              <span>
                                <CalendarDays size={14} />
                                {tripDateLabel(trip)}
                              </span>
                            </div>
                          </div>

                          <div className="trip-side">
                            <span className={`trip-status ${className}`}>
                              <StatusIcon size={13} />
                              {status}
                            </span>

                            <span className="trip-countdown">
                              {countdownLabel(trip)}
                            </span>
                          </div>

                          <ChevronRight
                            size={18}
                            className="trip-chevron"
                          />

                        </Link>
                      </li>
                    );
                  })}

                </ul>

              )}

            </section>

            {/* RIGHT COLUMN */}

            <aside className="dashboard-right-column">

              <NeedsAttention trips={trips} nextTrip={nextTrip} />

              {/* WEATHER */}

              <section className="dashboard-card weather-card">

                <div className="card-heading">

                  <div>
                    <h2>Weather</h2>

                    {nextTrip?.destination && (
                      <p className="section-sub">
                        <MapPin size={13} />
                        {nextTrip.destination} · now
                      </p>
                    )}
                  </div>

                  <button
                    type="button"
                    className="icon-button"
                    onClick={fetchDashboardWeather}
                    disabled={
                      weatherLoading ||
                      !nextTrip?.destination
                    }
                    aria-label="Refresh weather"
                    title="Refresh weather"
                  >
                    <RefreshCw
                      size={15}
                      className={
                        weatherLoading
                          ? "weather-refresh-spin"
                          : ""
                      }
                    />
                  </button>

                </div>

                {renderWeather()}

              </section>

              {/* TRAVEL GROUP */}

              <section className="dashboard-card group-card">

                <div className="card-heading">

                  <div>
                    <h2>{tripGroup ? tripGroup.name : "Travel group"}</h2>

                    <p className="section-sub">
                      {groupMembers.length}{" "}
                      {groupMembers.length === 1 ? "member" : "members"}
                    </p>
                  </div>

                  <button
                    type="button"
                    className="icon-button"
                    aria-label="Add group member"
                    title="Add group member"
                    onClick={handleOpenGroup}
                  >
                    <Plus size={16} />
                  </button>

                </div>

                <ul className="group-list">

                  {shownMembers.map((member, index) => (
                    <li
                      className="group-member"
                      key={member.id}
                    >

                      <div
                        className={`group-avatar tone-${index % 4}`}
                      >
                        {member.initials}
                      </div>

                      <div className="group-member-info">
                        <strong>{member.name}</strong>

                        <span>
                          {member.role ||
                            member.relationship ||
                            "Group member"}
                        </span>
                      </div>

                      {member.status === "Organizer" && (
                        <span className="organizer-badge">
                          You
                        </span>
                      )}

                    </li>
                  ))}

                </ul>

                {hiddenMemberCount > 0 && (
                  <p className="group-more">
                    +{hiddenMemberCount} more
                  </p>
                )}

                <Link
                  to={tripGroup ? `/family?group=${tripGroup.id}` : "/family"}
                  className="card-footer-link"
                >
                  {groupMembers.length > 1
                    ? "Manage group"
                    : "Invite your travel group"}
                  <ArrowRight size={15} />
                </Link>

              </section>

            </aside>

          </div>

        </div>

      </main>

    </div>
  );
}
