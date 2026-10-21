import {
  Plane,
  Map,
  Users,
  Sparkles,
  MapPin,
  CalendarDays,
  Plus,
  ArrowRight,
  Settings,
  LogOut,
  Home,
  Compass,
  ChevronRight,
  Clock3,
  CheckCircle2,
  Menu,
  Moon,
  X,
  Languages,
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
  useLocation,
  useNavigate,
} from "react-router-dom";

import { fetchWeather as fetchWeatherFromApi } from "../api/weather";
import { fetchTrips } from "../api/trips";
import { useAuthStore } from "../store/authStore.js";

import useTheme from "../components/recommendations/useTheme.js";
import "../styles/dashboard.css";

// Unsplash photo (free to use under the Unsplash License)
import heroPhoto from "../assets/dashboard/hero-alps.jpg";

// =========================================================
// CONSTANTS
// =========================================================

const GROUP_STORAGE_KEY =
  "roamio_family_members_v1";

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
    new Date(iso).toLocaleDateString("en-ZA", {
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

function loadGroupMembers(
  userName,
  initials
) {
  const defaults = getDefaultGroupMembers(
    userName,
    initials
  );

  try {
    const saved = localStorage.getItem(
      GROUP_STORAGE_KEY
    );

    if (!saved) {
      return defaults;
    }

    const parsed = JSON.parse(saved);

    if (
      !Array.isArray(parsed) ||
      parsed.length === 0
    ) {
      return defaults;
    }

    return parsed;
  } catch (error) {
    console.error(
      "Could not load travel group:",
      error
    );

    return defaults;
  }
}

// =========================================================
// NAVIGATION
// =========================================================

const NAV_SECTIONS = [
  {
    label: "Your space",
    links: [
      { to: "/dashboard", label: "Dashboard", icon: Home },
      { to: "/trips", label: "My Trips", icon: Map, showTripCount: true },
      { to: "/explore", label: "Explore destinations", icon: Compass },
      { to: "/family", label: "Travel Group", icon: Users },
    ],
  },
  {
    label: "Planning",
    links: [
      { to: "/calendar", label: "Calendar", icon: CalendarDays },
      { to: "/weather", label: "Weather", icon: CloudSun },
      { to: "/translator", label: "Travel Translator", icon: Languages },
      { to: "/settings", label: "Settings", icon: Settings },
    ],
  },
];

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
  const { theme, toggle: toggleTheme } = useTheme(); // app-wide theme, also set in Settings
  const navigate = useNavigate();
  const location = useLocation();
  const logout = useAuthStore((state) => state.logout);

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

  const [groupMembers, setGroupMembers] =
    useState(() =>
      loadGroupMembers(
        userName,
        initials
      )
    );

  const syncGroupMembers =
    useCallback(() => {
      const updatedMembers =
        loadGroupMembers(
          userName,
          initials
        );

      setGroupMembers(
        updatedMembers
      );
    }, [userName, initials]);

  useEffect(() => {
    if (
      location.pathname ===
      "/dashboard"
    ) {
      syncGroupMembers();
    }
  }, [
    location.pathname,
    syncGroupMembers,
  ]);

  useEffect(() => {
    const handleStorageChange = (
      event
    ) => {
      if (
        event.key ===
        GROUP_STORAGE_KEY
      ) {
        syncGroupMembers();
      }
    };

    window.addEventListener(
      "storage",
      handleStorageChange
    );

    return () => {
      window.removeEventListener(
        "storage",
        handleStorageChange
      );
    };
  }, [syncGroupMembers]);

  // =========================================================
  // WEATHER
  // =========================================================

  const fetchDashboardWeather =
    useCallback(async () => {
      try {
        setWeatherLoading(true);
        setWeatherError("");

        const nextTrip =
          getNextTrip(trips);

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
    }, [trips]);

  useEffect(() => {
    fetchDashboardWeather();
  }, [fetchDashboardWeather]);

  // =========================================================
  // DERIVED DATA
  // =========================================================

  const relevantTrips =
    getRelevantTrips(trips);

  const nextTrip =
    getNextTrip(trips);

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
      label: "Upcoming trips",
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

  const isActive = (path) => {
    if (path === "/dashboard") {
      return (
        location.pathname ===
        "/dashboard"
      );
    }

    return location.pathname.startsWith(
      path
    );
  };

  // =========================================================
  // ACTIONS
  // =========================================================

  // Goes through the auth store: clearing localStorage alone left the store
  // still "signed in", so "/" kept bouncing back to the dashboard.
  const handleLogout = () => {
    logout();

    setMobileMenu(false);

    navigate("/login", {
      replace: true,
    });
  };

  const handleCreateTrip = () => {
    navigate("/recommendations");
  };

  const handleOpenGroup = () => {
    navigate("/family");
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
                ? `${Math.round(windSpeed)} km/h`
                : "--"}
            </dd>
          </div>
        </dl>

        <Link
          to="/weather"
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

      <aside
        className={`dashboard-sidebar ${
          mobileMenu
            ? "sidebar-open"
            : ""
        }`}
      >

        <div className="sidebar-top">

          <Link
            to="/dashboard"
            className="dashboard-logo"
            onClick={closeMobileMenu}
          >
            <div className="dashboard-logo-icon">
              <Plane size={19} />
            </div>

            <span>Roamio</span>
          </Link>

          <button
            type="button"
            className="mobile-close"
            onClick={closeMobileMenu}
            aria-label="Close menu"
          >
            <X size={20} />
          </button>

        </div>

        {NAV_SECTIONS.map((section) => (
          <div
            className="sidebar-section"
            key={section.label}
          >

            <p className="sidebar-label">
              {section.label}
            </p>

            <nav className="sidebar-nav">

              {section.links.map(
                ({ to, label, icon: Icon, showTripCount }) => (
                  <Link
                    key={to}
                    to={to}
                    className={`sidebar-link ${
                      isActive(to)
                        ? "active"
                        : ""
                    }`}
                    aria-current={
                      isActive(to)
                        ? "page"
                        : undefined
                    }
                    onClick={closeMobileMenu}
                  >
                    <Icon size={18} />

                    <span>{label}</span>

                    {showTripCount && trips.length > 0 && (
                      <span className="nav-count">
                        {trips.length}
                      </span>
                    )}
                  </Link>
                )
              )}

            </nav>

          </div>
        ))}

        <div className="sidebar-bottom">

          <button
            type="button"
            className="sidebar-logout"
            onClick={handleLogout}
          >
            <LogOut size={17} />

            Sign out
          </button>

        </div>

      </aside>

      {/* =====================================================
          MOBILE OVERLAY
      ===================================================== */}

      {mobileMenu && (
        <div
          className="mobile-overlay"
          onClick={closeMobileMenu}
        />
      )}

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

            <button
              type="button"
              className="header-icon-button"
              onClick={toggleTheme}
              aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
              title={theme === "dark" ? "Light mode" : "Dark mode"}
            >
              {theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
            </button>

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
                  Next trip
                </span>

                <div className="spotlight-countdown">
                  {nextTripDays === null ? (
                    <strong className="spotlight-word">
                      Dates TBC
                    </strong>
                  ) : nextTripDays <= 0 ? (
                    <strong className="spotlight-word">
                      {nextTripDays === 0 ? "Today" : "Underway"}
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
                                  {start.toLocaleDateString("en-ZA", {
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
                    <h2>Travel group</h2>

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
                  to="/family"
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
