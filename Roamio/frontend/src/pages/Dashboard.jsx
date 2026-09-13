import {
  Plane,
  Map,
  Users,
  Sparkles,
  MapPin,
  CalendarDays,
  Plus,
  ArrowRight,
  Heart,
  Bell,
  Settings,
  LogOut,
  Home,
  Compass,
  Camera,
  ChevronRight,
  MoreHorizontal,
  Clock3,
  CheckCircle2,
  Globe2,
  Menu,
  X,
  Languages,
  CloudSun,
  Droplets,
  Wind,
  RefreshCw,
} from "lucide-react";

import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import { fetchWeather as fetchWeatherFromApi } from "../api/weather";
import { TOKEN_KEY } from "../api/client";
import "../styles/dashboard.css";

// =========================================================
// WEATHER API
// =========================================================

// Default weather location for the dashboard.
// The full Weather page allows the user to search for
// other South African locations.
const DEFAULT_WEATHER_LOCATION = {
  name: "Durban",
  province: "KwaZulu-Natal",
  latitude: -29.8587,
  longitude: 31.0218,
};

// =========================================================
// WEATHER HELPER
// =========================================================

function getDashboardWeatherInfo(description) {
  const normalizedDescription = String(description || "").toLowerCase();

  if (normalizedDescription.includes("thunder")) {
    return { label: "Thunderstorm" };
  }

  if (
    normalizedDescription.includes("rain") ||
    normalizedDescription.includes("shower") ||
    normalizedDescription.includes("drizzle")
  ) {
    return { label: "Rain" };
  }

  if (normalizedDescription.includes("snow")) {
    return { label: "Snow" };
  }

  if (normalizedDescription.includes("cloud")) {
    return {
      label: normalizedDescription.includes("overcast")
        ? "Overcast"
        : "Partly cloudy",
    };
  }

  return {
    label: normalizedDescription.includes("clear")
      ? "Clear sky"
      : "Weather",
  };
}

// =========================================================
// DASHBOARD
// =========================================================

export default function Dashboard() {
  const navigate = useNavigate();

  const [mobileMenu, setMobileMenu] = useState(false);

  // =========================================================
  // WEATHER STATE
  // =========================================================

  const [weather, setWeather] = useState(null);

  const [weatherLoading, setWeatherLoading] =
    useState(true);

  const [weatherError, setWeatherError] =
    useState("");

  // =========================================================
  // USER
  // =========================================================

  let savedUser = {};

  try {
    const storedUser = localStorage.getItem("user");

    if (storedUser) {
      savedUser = JSON.parse(storedUser);
    }
  } catch (error) {
    console.error(
      "Could not read saved user:",
      error
    );
  }

  /*
   * Get the user's name.
   *
   * If no valid name is saved, use the default Roamio name.
   */
  let userName =
    savedUser?.name ||
    savedUser?.firstName ||
    "";

  if (!userName) {
    userName = "Roamio User";
  }

  userName = userName.trim();

  // First name for:
  // "Good morning, Duran!"
  const firstName =
    userName.split(/\s+/)[0] || "Roamio";

  // Create initials for profile avatar
  const initials =
    userName
      .split(/\s+/)
      .filter(Boolean)
      .map((word) => word.charAt(0))
      .join("")
      .substring(0, 2)
      .toUpperCase() || "R";

  // =========================================================
  // TRIPS
  // =========================================================

  const trips = [
    {
      id: 1,
      title: "Cape Town Family Escape",
      location: "Cape Town, South Africa",
      dates: "12 Dec — 18 Dec 2026",
      status: "Upcoming",
      image:
        "https://images.unsplash.com/photo-1580060839134-75a5edca2e99?auto=format&fit=crop&w=1000&q=80",
    },

    {
      id: 2,
      title: "Durban Beach Weekend",
      location: "Durban, South Africa",
      dates: "08 Jan — 11 Jan 2027",
      status: "Planning",
      image:
        "https://images.unsplash.com/photo-1569263979104-865ab7cd8d13?auto=format&fit=crop&w=1000&q=80",
    },

    {
      id: 3,
      title: "Kruger Family Adventure",
      location: "Kruger National Park",
      dates: "21 Mar — 27 Mar 2027",
      status: "Planning",
      image:
        "https://images.unsplash.com/photo-1516426122078-c23e76319801?auto=format&fit=crop&w=1000&q=80",
    },
  ];

  // =========================================================
  // FAMILY
  // =========================================================

  const familyMembers = [
    {
      id: 1,
      name: userName,
      role: "Trip organizer",
      initials,
    },

    {
      id: 2,
      name: "Family Member",
      role: "Traveler",
      initials: "F",
    },

    {
      id: 3,
      name: "Family Member",
      role: "Traveler",
      initials: "F",
    },

    {
      id: 4,
      name: "Family Member",
      role: "Traveler",
      initials: "F",
    },
  ];

  // =========================================================
  // WEATHER
  // =========================================================

  const fetchDashboardWeather = async () => {
    try {
      setWeatherLoading(true);
      setWeatherError("");

      const data = await fetchWeatherFromApi(
        DEFAULT_WEATHER_LOCATION.name
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
  };

  // Load weather when Dashboard opens.
  useEffect(() => {
    fetchDashboardWeather();
  }, []);

  // =========================================================
  // FUNCTIONS
  // =========================================================

  const closeMobileMenu = () => {
    setMobileMenu(false);
  };

  const handleLogout = () => {
    // Remove current user
    localStorage.removeItem("user");

    // Remove current Roamio token
    localStorage.removeItem(TOKEN_KEY);

    setMobileMenu(false);

    navigate("/login", {
      replace: true,
    });
  };

  const handleCreateTrip = () => {
    navigate("/recommendations");
  };

  const handleNotification = () => {
    console.log("Notifications");
  };

  const handleTripOptions = (tripTitle) => {
    console.log("Trip options:", tripTitle);
  };

  const handleAddFamily = () => {
    console.log("Add family member");
  };

  const handleInviteFamily = () => {
    console.log("Invite family member");
  };

  const handleViewMemories = () => {
    console.log("View memories");
  };

  // =========================================================
  // RETURN
  // =========================================================

  return (
    <div className="dashboard-page">

      {/* =====================================================
          SIDEBAR
      ===================================================== */}

      <aside
        className={`dashboard-sidebar ${
          mobileMenu ? "sidebar-open" : ""
        }`}
      >

        {/* SIDEBAR TOP */}

        <div className="sidebar-top">

          <div className="dashboard-logo">

            <div className="dashboard-logo-icon">
              <Plane size={20} />
            </div>

            <span>
              Roamio
            </span>

          </div>

          <button
            type="button"
            className="mobile-close"
            onClick={closeMobileMenu}
            aria-label="Close menu"
          >
            <X size={20} />
          </button>

        </div>

        {/* YOUR SPACE */}

        <div className="sidebar-section">

          <p className="sidebar-label">
            YOUR SPACE
          </p>

          <nav className="sidebar-nav">

            <Link
              to="/dashboard"
              className="sidebar-link active"
              onClick={closeMobileMenu}
            >
              <Home size={18} />
              <span>Dashboard</span>
            </Link>

            <Link
              to="/dashboard"
              className="sidebar-link"
              onClick={closeMobileMenu}
            >
              <Map size={18} />
              <span>My Trips</span>

              <span className="nav-count">
                2
              </span>
            </Link>

            <Link
              to="/dashboard"
              className="sidebar-link"
              onClick={closeMobileMenu}
            >
              <Compass size={18} />
              <span>Explore</span>
            </Link>

            <Link
              to="/dashboard"
              className="sidebar-link"
              onClick={closeMobileMenu}
            >
              <Users size={18} />
              <span>Family</span>
            </Link>

          </nav>

        </div>

        {/* PLANNING */}

        <div className="sidebar-section">

          <p className="sidebar-label">
            PLANNING
          </p>

          <nav className="sidebar-nav">

            <Link
              to="/dashboard"
              className="sidebar-link"
              onClick={closeMobileMenu}
            >
              <CalendarDays size={18} />
              <span>Calendar</span>
            </Link>

            <Link
              to="/dashboard"
              className="sidebar-link"
              onClick={closeMobileMenu}
            >
              <Heart size={18} />
              <span>Memories</span>
            </Link>

            {/* WEATHER */}

            <Link
              to="/weather"
              className="sidebar-link"
              onClick={closeMobileMenu}
            >
              <CloudSun size={18} />
              <span>Weather</span>
            </Link>

            {/* RECOMMENDATIONS */}

            <Link
              to="/recommendations"
              className="sidebar-link"
              onClick={closeMobileMenu}
            >
              <Sparkles size={18} />
              <span>Recommendations</span>
            </Link>

            {/* TRANSLATOR */}

            <Link
              to="/translator"
              className="sidebar-link"
              onClick={closeMobileMenu}
            >
              <Languages size={18} />
              <span>Travel Translator</span>
            </Link>

            {/* SETTINGS */}

            <Link
              to="/settings"
              className="sidebar-link"
              onClick={closeMobileMenu}
            >
              <Settings size={18} />
              <span>Settings</span>
            </Link>

          </nav>

        </div>

        {/* SIDEBAR BOTTOM */}

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
                Keep your family plans in one place.
              </p>

            </div>

          </div>

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

        {/* ===================================================
            HEADER
        =================================================== */}

        <header className="dashboard-header">

          <button
            type="button"
            className="mobile-menu-button"
            onClick={() => setMobileMenu(true)}
            aria-label="Open menu"
          >
            <Menu size={21} />
          </button>

          <div className="header-date">

            <CalendarDays size={16} />

            <span>
              Friday, August 28, 2026
            </span>

          </div>

          <div className="header-actions">

            {/* NOTIFICATIONS */}

            <button
              type="button"
              className="header-icon-button"
              title="Notifications"
              aria-label="Notifications"
              onClick={handleNotification}
            >
              <Bell size={19} />

              <span className="notification-dot" />
            </button>

            {/* PROFILE */}

            <div className="header-profile">

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

            </div>

          </div>

        </header>

        {/* ===================================================
            DASHBOARD CONTENT
        =================================================== */}

        <div className="dashboard-content">

          {/* =================================================
              HERO
          ================================================= */}

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

                SMART FAMILY TRAVEL

              </div>

              <h1>

                Good morning,
                <br />

                <span>
                  {firstName}!
                </span>

              </h1>

              <p className="hero-subtitle">
                Ready to plan your next family adventure?
              </p>

              <p className="hero-description">
                Start planning an unforgettable adventure
                together. Everything you need, all in one place.
              </p>

              <button
                type="button"
                className="hero-button"
                onClick={handleCreateTrip}
              >

                <Plus size={18} />

                Create a new trip

                <ArrowRight size={16} />

              </button>

            </div>

            {/* HERO VISUAL */}

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

            {/* NEXT DESTINATION */}

            <div className="stat-card">

              <div className="stat-icon blue">
                <Plane size={20} />
              </div>

              <div className="stat-info">

                <span>
                  Next destination
                </span>

                <strong>
                  Anywhere
                </strong>

              </div>

              <div className="stat-decoration">
                <MapPin size={45} />
              </div>

            </div>

            {/* TOTAL TRIPS */}

            <div className="stat-card">

              <div className="stat-icon teal">
                <Compass size={20} />
              </div>

              <div className="stat-info">

                <span>
                  Total trips
                </span>

                <strong>
                  8
                </strong>

                <small>
                  +2 this year
                </small>

              </div>

              <div className="stat-decoration">
                <Plane size={42} />
              </div>

            </div>

            {/* PLACES */}

            <div className="stat-card">

              <div className="stat-icon purple">
                <Map size={20} />
              </div>

              <div className="stat-info">

                <span>
                  Places visited
                </span>

                <strong>
                  14
                </strong>

                <small>
                  Across 5 countries
                </small>

              </div>

              <div className="stat-decoration">
                <Globe2 size={45} />
              </div>

            </div>

            {/* FAMILY */}

            <div className="stat-card">

              <div className="stat-icon orange">
                <Users size={20} />
              </div>

              <div className="stat-info">

                <span>
                  Family members
                </span>

                <strong>
                  5
                </strong>

                <small>
                  Planning together
                </small>

              </div>

              <div className="stat-decoration">
                <Heart size={43} />
              </div>

            </div>

          </section>

          {/* =================================================
              MAIN GRID
          ================================================= */}

          <div className="dashboard-grid">

            {/* =================================================
                TRIPS
            ================================================= */}

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
                  to="/dashboard"
                  className="view-all"
                >
                  View all
                  <ArrowRight size={15} />
                </Link>

              </div>

              <div className="trip-list">

                {trips.map((trip) => (

                  <article
                    className="trip-card"
                    key={trip.id}
                  >

                    {/* IMAGE */}

                    <div className="trip-image">

                      <img
                        src={trip.image}
                        alt={trip.title}
                      />

                      <span
                        className={`trip-status ${
                          trip.status === "Upcoming"
                            ? "upcoming"
                            : "planning"
                        }`}
                      >

                        {trip.status === "Upcoming" ? (
                          <CheckCircle2 size={13} />
                        ) : (
                          <Clock3 size={13} />
                        )}

                        {trip.status}

                      </span>

                    </div>

                    {/* INFO */}

                    <div className="trip-info">

                      <div className="trip-title-row">

                        <div>

                          <h3>
                            {trip.title}
                          </h3>

                          <div className="trip-location">

                            <MapPin size={14} />

                            {trip.location}

                          </div>

                        </div>

                        <button
                          type="button"
                          className="trip-more"
                          aria-label={`More options for ${trip.title}`}
                          onClick={() =>
                            handleTripOptions(
                              trip.title
                            )
                          }
                        >

                          <MoreHorizontal size={19} />

                        </button>

                      </div>

                      <div className="trip-footer">

                        <div className="trip-date">

                          <CalendarDays size={14} />

                          {trip.dates}

                        </div>

                        <ArrowRight size={16} />

                      </div>

                    </div>

                  </article>

                ))}

              </div>

            </section>

            {/* =================================================
                RIGHT COLUMN
            ================================================= */}

            <aside className="dashboard-right-column">

              {/* =================================================
                  FAMILY
              ================================================= */}

              <section className="family-card">

                <div className="section-heading compact">

                  <div>

                    <span className="section-eyebrow">
                      YOUR CREW
                    </span>

                    <h2>
                      Family
                    </h2>

                  </div>

                  <button
                    type="button"
                    className="small-add"
                    aria-label="Add family member"
                    onClick={handleAddFamily}
                  >

                    <Plus size={16} />

                  </button>

                </div>

                <div className="family-list">

                  {familyMembers.map((member) => (

                    <div
                      className="family-member"
                      key={member.id}
                    >

                      <div
                        className={`family-avatar avatar-${member.id}`}
                      >
                        {member.initials}
                      </div>

                      <div className="family-member-info">

                        <strong>
                          {member.name}
                        </strong>

                        <span>
                          {member.role}
                        </span>

                      </div>

                      {member.id === 1 && (
                        <span className="organizer-badge">
                          You
                        </span>
                      )}

                    </div>

                  ))}

                </div>

                <button
                  type="button"
                  className="invite-family"
                  onClick={handleInviteFamily}
                >

                  <Users size={16} />

                  Invite family member

                  <ArrowRight size={15} />

                </button>

              </section>

              {/* =================================================
                  WEATHER
              ================================================= */}

              <section className="dashboard-weather-card">

                <div className="weather-card-header">

                  <div>

                    <span className="section-eyebrow">
                      TRAVEL WEATHER
                    </span>

                    <h2>
                      Today's weather
                    </h2>

                  </div>

                  <button
                    type="button"
                    className="weather-refresh-button"
                    onClick={fetchDashboardWeather}
                    disabled={weatherLoading}
                    aria-label="Refresh weather"
                  >

                    <RefreshCw
                      size={16}
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

                    <RefreshCw
                      size={22}
                      className="weather-refresh-spin"
                    />

                    <span>
                      Loading weather...
                    </span>

                  </div>

                ) : weatherError ? (

                  <div className="dashboard-weather-error">

                    <CloudSun size={24} />

                    <p>
                      {weatherError}
                    </p>

                    <button
                      type="button"
                      onClick={fetchDashboardWeather}
                    >
                      Try again
                    </button>

                  </div>

                ) : weather ? (

                  <>

                    <div className="dashboard-weather-main">

                      <div className="dashboard-weather-icon">
                        <CloudSun size={42} />
                      </div>

                      <div className="dashboard-weather-temperature">

                        <strong>
                          {Math.round(
                            weather.current.temp
                          )}
                          °
                        </strong>

                        <span>
                          {
                            getDashboardWeatherInfo(
                              weather.current.description
                            ).label
                          }
                        </span>

                      </div>

                    </div>

                    <div className="dashboard-weather-location">

                      <MapPin size={15} />

                      <span>
                        Durban, KwaZulu-Natal
                      </span>

                    </div>

                    <div className="dashboard-weather-stats">

                      <div>

                        <Droplets size={15} />

                        <span>
                          Humidity
                        </span>

                        <strong>
                          {
                            weather.current.humidity
                          }
                          %
                        </strong>

                      </div>

                      <div>

                        <Wind size={15} />

                        <span>
                          Wind
                        </span>

                        <strong>
                          {Math.round(
                            weather.current.wind_speed
                          )}{" "}
                          km/h
                        </strong>

                      </div>

                    </div>

                    <Link
                      to="/weather"
                      className="dashboard-weather-button"
                    >

                      View full forecast

                      <ArrowRight size={15} />

                    </Link>

                  </>

                ) : null}

              </section>

              {/* =================================================
                  MEMORIES
              ================================================= */}

              <section className="memory-card">

                <div className="memory-content">

                  <div className="memory-icon">
                    <Camera size={19} />
                  </div>

                  <span className="section-eyebrow">
                    MEMORIES
                  </span>

                  <h3>
                    36 beautiful moments
                  </h3>

                  <p>
                    Your family's adventures are
                    worth remembering.
                  </p>

                  <button
                    type="button"
                    className="memory-button"
                    onClick={handleViewMemories}
                  >

                    View memories

                    <ArrowRight size={14} />

                  </button>

                </div>

                <div className="memory-decoration">

                  <Heart
                    size={80}
                    strokeWidth={1}
                  />

                </div>

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
                Every great adventure starts with a plan.
              </strong>

              <span>
                Make your next family memory unforgettable.
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