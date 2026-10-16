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
  Globe2,
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
} from "lucide-react";

import { useCallback, useEffect, useState } from "react";
import {
  Link,
  useLocation,
  useNavigate,
} from "react-router-dom";

import { fetchWeather as fetchWeatherFromApi } from "../api/weather";
import { fetchTrips } from "../api/trips";
import { TOKEN_KEY } from "../api/client";

import useTheme from "../components/recommendations/useTheme.js";
import "../styles/dashboard.css";

// =========================================================
// CONSTANTS
// =========================================================

const GROUP_STORAGE_KEY =
  "roamio_family_members_v1";

// =========================================================
// TRIP HELPERS
// =========================================================

function tripStatus(trip) {
  if (!trip.startDate) return "Planning";

  const start = new Date(trip.startDate);
  const end = trip.endDate
    ? new Date(trip.endDate)
    : start;

  const now = new Date();

  if (now > end) return "Completed";
  if (now >= start) return "Upcoming";

  return "Planning";
}

function tripDateLabel(trip) {
  if (!trip.startDate) return "Dates not set";

  const format = (iso) =>
    new Date(iso).toLocaleDateString("en-ZA", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });

  return trip.endDate
    ? `${format(trip.startDate)} — ${format(trip.endDate)}`
    : format(trip.startDate);
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
// DATE
// =========================================================

function getDashboardDate() {
  return new Date().toLocaleDateString(
    "en-ZA",
    {
      weekday: "long",
      day: "2-digit",
      month: "long",
      year: "numeric",
    }
  );
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
// DASHBOARD
// =========================================================

export default function Dashboard() {
  const { theme, toggle: toggleTheme } = useTheme(); // app-wide theme, also set in Settings
  const navigate = useNavigate();
  const location = useLocation();

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

  let savedUser = {};

  try {
    const storedUser =
      localStorage.getItem("user");

    if (storedUser) {
      savedUser = JSON.parse(storedUser);
    }
  } catch (error) {
    console.error(
      "Could not read saved user:",
      error
    );
  }

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

  const completedTrips =
    trips.filter(
      (trip) =>
        tripStatus(trip) ===
        "Completed"
    );

  const displayedTrips =
    relevantTrips.slice(0, 3);

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

  const handleLogout = () => {
    localStorage.removeItem("user");
    localStorage.removeItem(
      TOKEN_KEY
    );

    setMobileMenu(false);

    navigate("/login", {
      replace: true,
    });
  };

  const handleCreateTrip = () => {
    navigate("/recommendations");
  };

  const handleAddGroup = () => {
    navigate("/family");
  };

  const handleInviteGroup = () => {
    navigate("/family");
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
            onClick={
              closeMobileMenu
            }
          >
            <div className="dashboard-logo-icon">
              <Plane size={20} />
            </div>

            <span>
              Roamio
            </span>
          </Link>

          <button
            type="button"
            className="mobile-close"
            onClick={
              closeMobileMenu
            }
            aria-label="Close menu"
          >
            <X size={20} />
          </button>

        </div>

        <div className="sidebar-section">

          <p className="sidebar-label">
            YOUR SPACE
          </p>

          <nav className="sidebar-nav">

            <Link
              to="/dashboard"
              className={`sidebar-link ${
                isActive(
                  "/dashboard"
                )
                  ? "active"
                  : ""
              }`}
              onClick={
                closeMobileMenu
              }
            >
              <Home size={18} />

              <span>
                Dashboard
              </span>
            </Link>

            <Link
              to="/trips"
              className={`sidebar-link ${
                isActive("/trips")
                  ? "active"
                  : ""
              }`}
              onClick={
                closeMobileMenu
              }
            >
              <Map size={18} />

              <span>
                My Trips
              </span>

              <span className="nav-count">
                {trips.length}
              </span>
            </Link>

            <Link
              to="/explore"
              className={`sidebar-link ${
                isActive(
                  "/explore"
                )
                  ? "active"
                  : ""
              }`}
              onClick={
                closeMobileMenu
              }
            >
              <Compass size={18} />

              <span>
                Explore destinations
              </span>
            </Link>

            <Link
              to="/family"
              className={`sidebar-link ${
                isActive(
                  "/family"
                )
                  ? "active"
                  : ""
              }`}
              onClick={
                closeMobileMenu
              }
            >
              <Users size={18} />

              <span>
                Travel Group
              </span>
            </Link>

          </nav>

        </div>

        <div className="sidebar-section">

          <p className="sidebar-label">
            PLANNING
          </p>

          <nav className="sidebar-nav">

            <Link
              to="/calendar"
              className={`sidebar-link ${
                isActive(
                  "/calendar"
                )
                  ? "active"
                  : ""
              }`}
              onClick={
                closeMobileMenu
              }
            >
              <CalendarDays size={18} />

              <span>
                Calendar
              </span>
            </Link>

            <Link
              to="/weather"
              className={`sidebar-link ${
                isActive(
                  "/weather"
                )
                  ? "active"
                  : ""
              }`}
              onClick={
                closeMobileMenu
              }
            >
              <CloudSun size={18} />

              <span>
                Weather
              </span>
            </Link>

            <Link
              to="/translator"
              className={`sidebar-link ${
                isActive(
                  "/translator"
                )
                  ? "active"
                  : ""
              }`}
              onClick={
                closeMobileMenu
              }
            >
              <Languages size={18} />

              <span>
                Travel Translator
              </span>
            </Link>

            <Link
              to="/settings"
              className={`sidebar-link ${
                isActive(
                  "/settings"
                )
                  ? "active"
                  : ""
              }`}
              onClick={
                closeMobileMenu
              }
            >
              <Settings size={18} />

              <span>
                Settings
              </span>
            </Link>

          </nav>

        </div>

        <div className="sidebar-bottom">

          <div className="sidebar-tip">

            <div className="tip-icon">
              <Sparkles size={17} />
            </div>

            <div>

              <strong>
                Travel smarter
              </strong>

              <p>
                Keep your group plans
                in one place.
              </p>

            </div>

          </div>

          <button
            type="button"
            className="sidebar-logout"
            onClick={
              handleLogout
            }
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
          onClick={
            closeMobileMenu
          }
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
            <Menu size={21} />
          </button>

          <div className="header-date">

            <CalendarDays size={16} />

            <span>
              {getDashboardDate()}
            </span>

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
            >

              <div className="profile-avatar">
                {initials}
              </div>

              <div className="profile-details">

                <strong>
                  {userName}
                </strong>

                <span>
                  Roamio
                </span>

              </div>

              <ChevronRight size={16} />

            </Link>

          </div>

        </header>

        {/* ===================================================
            DASHBOARD CONTENT
        =================================================== */}

        <div className="dashboard-content">

          {/* HERO */}

          <section className="hero-section">

            <div className="hero-background" />

            <div className="hero-glow hero-glow-one" />

            <div className="hero-glow hero-glow-two" />

            <div className="hero-flight-path">

              <span />
              <span />
              <span />

            </div>

            <div className="hero-content">

              <div className="hero-badge">

                <Sparkles size={14} />

                SMART GROUP TRAVEL

              </div>

              <h1>

                Good morning,
                <br />

                <span>
                  {firstName}!
                </span>

              </h1>

              <p className="hero-subtitle">
                Ready to plan your next
                group adventure?
              </p>

              <p className="hero-description">
                Start planning an
                unforgettable adventure
                together. Everything you
                need, all in one place.
              </p>

              <button
                type="button"
                className="hero-button"
                onClick={
                  handleCreateTrip
                }
              >

                <Plus size={18} />

                Create a new trip

                <ArrowRight size={16} />

              </button>

            </div>

            <div className="hero-visual">

              <div className="floating-pin floating-pin-one">
                <MapPin size={18} />
              </div>

              <div className="floating-pin floating-pin-two">
                <MapPin size={18} />
              </div>

              <div className="floating-pin floating-pin-three">
                <MapPin size={18} />
              </div>

              <div className="dashboard-plane">
                <Plane size={35} />
              </div>

              <div className="hero-globe">
                <Globe2 size={150} />
              </div>

            </div>

          </section>

          {/* =================================================
              STATS
          ================================================= */}

          <section className="stats-grid">

            <div className="stat-card">

              <div className="stat-icon blue">
                <Plane size={20} />
              </div>

              <div className="stat-info">

                <span>
                  Next destination
                </span>

                <strong>
                  {nextTrip?.destination ||
                    "Anywhere"}
                </strong>

              </div>

              <div className="stat-decoration">
                <MapPin size={45} />
              </div>

            </div>

            {/* TOTAL TRIPS - CLICKABLE */}

            <Link
              to="/trips"
              className="stat-card"
            >

              <div className="stat-icon teal">
                <Compass size={20} />
              </div>

              <div className="stat-info">

                <span>
                  Total trips
                </span>

                <strong>
                  {trips.length}
                </strong>

              </div>

              <div className="stat-decoration">
                <Plane size={42} />
              </div>

            </Link>

            {/* COMPLETED TRIPS - CLICKABLE */}

            <Link
              to="/trips?status=completed"
              className="stat-card"
            >

              <div className="stat-icon purple">
                <Map size={20} />
              </div>

              <div className="stat-info">

                <span>
                  Trips completed
                </span>

                <strong>
                  {completedTrips.length}
                </strong>

                <small>
                  Adventures completed
                </small>

              </div>

              <div className="stat-decoration">
                <Globe2 size={45} />
              </div>

            </Link>

            {/* GROUP MEMBERS */}

            <Link
              to="/family"
              className="stat-card"
            >

              <div className="stat-icon orange">
                <Users size={20} />
              </div>

              <div className="stat-info">

                <span>
                  Group members
                </span>

                <strong>
                  {groupMembers.length}
                </strong>

                <small>
                  Planning together
                </small>

              </div>

              <div className="stat-decoration">
                <Users size={43} />
              </div>

            </Link>

          </section>

          {/* =================================================
              MAIN GRID
          ================================================= */}

          <div className="dashboard-grid">

            {/* TRIPS */}

            <section className="trips-section">

              <div className="section-heading">

                <div>

                  <span className="section-eyebrow">
                    YOUR JOURNEYS
                  </span>

                  <h2>
                    Upcoming trips
                  </h2>

                </div>

                <Link
                  to="/trips"
                  className="view-all"
                >
                  View all

                  <ArrowRight size={15} />
                </Link>

              </div>

              {tripsLoading ? (

                <p className="trips-empty-note">
                  Loading your trips...
                </p>

              ) : tripsError ? (

                <p className="trips-empty-note">
                  {tripsError}
                </p>

              ) : displayedTrips.length ===
                0 ? (

                <p className="trips-empty-note">
                  No upcoming trips yet —
                  use "Create a new trip"
                  above to plan your
                  next adventure.
                </p>

              ) : (

                <div className="trip-list">

                  {displayedTrips.map(
                    (trip) => {

                      const status =
                        tripStatus(
                          trip
                        );

                      return (

                        <Link
                          to={`/trips/${trip.id}`}
                          className="trip-card"
                          key={
                            trip.id
                          }
                        >

                          <div className="trip-image trip-image-fallback">

                            <MapPin
                              size={26}
                            />

                            <span
                              className={`trip-status ${
                                status ===
                                "Upcoming"
                                  ? "upcoming"
                                  : "planning"
                              }`}
                            >

                              {status ===
                              "Upcoming" ? (
                                <CheckCircle2
                                  size={
                                    13
                                  }
                                />
                              ) : (
                                <Clock3
                                  size={
                                    13
                                  }
                                />
                              )}

                              {status}

                            </span>

                          </div>

                          <div className="trip-info">

                            <div className="trip-title-row">

                              <div>

                                <h3>
                                  {
                                    trip.title ||
                                    "Untitled trip"
                                  }
                                </h3>

                                <div className="trip-location">

                                  <MapPin
                                    size={
                                      14
                                    }
                                  />

                                  {trip.destination ||
                                    "Destination not set"}

                                </div>

                              </div>

                            </div>

                            <div className="trip-footer">

                              <div className="trip-date">

                                <CalendarDays
                                  size={
                                    14
                                  }
                                />

                                {tripDateLabel(
                                  trip
                                )}

                              </div>

                              <ArrowRight
                                size={
                                  16
                                }
                              />

                            </div>

                          </div>

                        </Link>

                      );
                    }
                  )}

                </div>

              )}

            </section>

            {/* RIGHT COLUMN */}

            <aside className="dashboard-right-column">

              {/* TRAVEL GROUP */}

              <section className="family-card">

                <div className="section-heading compact">

                  <div>

                    <span className="section-eyebrow">
                      YOUR TRAVEL GROUP
                    </span>

                    <h2>
                      Travel Group
                    </h2>

                  </div>

                  <button
                    type="button"
                    className="small-add"
                    aria-label="Add group member"
                    onClick={
                      handleAddGroup
                    }
                  >

                    <Plus size={16} />

                  </button>

                </div>

                <div className="family-list">

                  {groupMembers.map(
                    (member) => (
                      <div
                        className="family-member"
                        key={
                          member.id
                        }
                      >

                        <div
                          className={`family-avatar avatar-${String(
                            member.id
                          ).replace(
                            "member-",
                            ""
                          )}`}
                        >
                          {member.initials}
                        </div>

                        <div className="family-member-info">

                          <strong>
                            {
                              member.name
                            }
                          </strong>

                          <span>
                            {member.role ||
                              member.relationship ||
                              "Group member"}
                          </span>

                        </div>

                        {member.status ===
                          "Organizer" && (
                          <span className="organizer-badge">
                            You
                          </span>
                        )}

                      </div>
                    )
                  )}

                </div>

                <button
                  type="button"
                  className="invite-family"
                  onClick={
                    handleInviteGroup
                  }
                >

                  <Users size={16} />

                  Invite group member

                  <ArrowRight
                    size={15}
                  />

                </button>

              </section>

              {/* =================================================
                  PREMIUM WEATHER
              ================================================= */}

              <section className="dashboard-weather-card">

                <div className="weather-card-glow weather-card-glow-one" />

                <div className="weather-card-glow weather-card-glow-two" />

                <div className="weather-cloud-decoration weather-cloud-one">
                  <CloudSun size={72} />
                </div>

                <div className="weather-cloud-decoration weather-cloud-two">
                  <Cloud size={48} />
                </div>

                <div className="weather-card-header">

                  <div>

                    <span className="section-eyebrow">
                      TRAVEL WEATHER
                    </span>

                    <h2>
                      Today's conditions
                    </h2>

                  </div>

                  <button
                    type="button"
                    className="weather-refresh-button"
                    onClick={
                      fetchDashboardWeather
                    }
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

                {weatherLoading ? (

                  <div className="dashboard-weather-loading">

                    <div className="weather-loading-icon">
                      <RefreshCw
                        size={25}
                        className="weather-refresh-spin"
                      />
                    </div>

                    <div>

                      <strong>
                        Checking the skies...
                      </strong>

                      <span>
                        Getting the latest weather for your next trip.
                      </span>

                    </div>

                  </div>

                ) : weatherError ? (

                  <div className="dashboard-weather-error">

                    <div className="weather-error-icon">
                      <CloudSun size={24} />
                    </div>

                    <div className="weather-error-content">

                      <strong>
                        Weather unavailable
                      </strong>

                      <p>
                        {weatherError}
                      </p>

                      <button
                        type="button"
                        onClick={
                          fetchDashboardWeather
                        }
                      >
                        Try again
                        <ArrowRight size={14} />
                      </button>

                    </div>

                  </div>

                ) : weather ? (

                  (() => {

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

                        <div className="dashboard-weather-destination">

                          <div className="weather-destination-icon">
                            <MapPin size={15} />
                          </div>

                          <div>

                            <span>
                              NEXT TRIP
                            </span>

                            <strong>
                              {nextTrip?.destination ||
                                "Destination"}
                            </strong>

                          </div>

                          <div className="weather-live-badge">

                            <span />

                            Live

                          </div>

                        </div>

                        <div className="dashboard-weather-main">

                          <div
                            className={`dashboard-weather-icon weather-icon-${weatherInfo.className}`}
                          >

                            <WeatherIcon
                              size={54}
                              strokeWidth={1.6}
                            />

                            <div className="weather-icon-ring" />

                          </div>

                          <div className="dashboard-weather-temperature">

                            <div className="weather-temperature-row">

                              <strong>
                                {temperature}
                              </strong>

                              <span className="weather-degree">
                                °
                              </span>

                            </div>

                            <span className="weather-condition">
                              {weatherInfo.label}
                            </span>

                            <span className="weather-updated">
                              Current conditions
                            </span>

                          </div>

                        </div>

                        <div className="dashboard-weather-stats">

                          <div className="weather-stat">

                            <div className="weather-stat-icon weather-stat-humidity">
                              <Droplets size={17} />
                            </div>

                            <div className="weather-stat-copy">

                              <span>
                                Humidity
                              </span>

                              <strong>
                                {humidity ?? "--"}%
                              </strong>

                            </div>

                          </div>

                          <div className="weather-stat">

                            <div className="weather-stat-icon weather-stat-wind">
                              <Wind size={17} />
                            </div>

                            <div className="weather-stat-copy">

                              <span>
                                Wind
                              </span>

                              <strong>
                                {windSpeed != null
                                  ? `${Math.round(
                                      windSpeed
                                    )} km/h`
                                  : "--"}
                              </strong>

                            </div>

                          </div>

                        </div>

                        <Link
                          to="/weather"
                          className="dashboard-weather-button"
                        >

                          <span>
                            Open full weather forecast
                          </span>

                          <span className="weather-button-arrow">
                            <ArrowRight size={15} />
                          </span>

                        </Link>

                      </>

                    );

                  })()

                ) : (

                  <div className="dashboard-weather-empty">

                    <div className="weather-empty-icon">
                      <CloudSun size={30} />
                    </div>

                    <div>

                      <strong>
                        Your trip weather awaits
                      </strong>

                      <p>
                        Create a trip with a destination
                        and we'll show its current weather here.
                      </p>

                      <button
                        type="button"
                        onClick={
                          handleCreateTrip
                        }
                      >
                        Plan a trip
                        <ArrowRight size={14} />
                      </button>

                    </div>

                  </div>

                )}

              </section>

            </aside>

          </div>

          {/* =================================================
              BOTTOM MESSAGE
          ================================================= */}

          <section className="bottom-message">

            <div className="bottom-message-icon">
              <Sparkles size={18} />
            </div>

            <div>

              <strong>
                Every great adventure
                starts with a plan.
              </strong>

              <span>
                Make your next group
                memory unforgettable.
              </span>

            </div>

            <Plane
              className="bottom-plane"
              size={23}
            />

          </section>

        </div>

      </main>

    </div>
  );
}