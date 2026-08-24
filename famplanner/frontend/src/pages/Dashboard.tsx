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
  Star,
  Menu,
  X,
} from "lucide-react";

import { useState } from "react";
import { Link } from "react-router-dom";

import "../styles/dashboard.css";

export default function Dashboard() {
  const [mobileMenu, setMobileMenu] = useState(false);

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

  const familyMembers = [
    {
      name: "Savaan",
      role: "Trip organizer",
      initials: "S",
    },
    {
      name: "Family Member",
      role: "Traveler",
      initials: "F",
    },
    {
      name: "Family Member",
      role: "Traveler",
      initials: "F",
    },
    {
      name: "Family Member",
      role: "Traveler",
      initials: "F",
    },
  ];

  return (
    <div className="dashboard-page">

      {/* =====================================================
          SIDEBAR
      ===================================================== */}

      <aside className={`dashboard-sidebar ${mobileMenu ? "sidebar-open" : ""}`}>

        <div className="sidebar-top">

          <div className="dashboard-logo">
            <div className="dashboard-logo-icon">
              <Plane size={20} />
            </div>

            <span>
              Fam<span>Planner</span>
            </span>
          </div>

          <button
            className="mobile-close"
            onClick={() => setMobileMenu(false)}
            aria-label="Close menu"
          >
            <X size={20} />
          </button>

        </div>


        {/* MAIN NAVIGATION */}

        <div className="sidebar-section">

          <p className="sidebar-label">
            YOUR SPACE
          </p>

          <nav className="sidebar-nav">

            <Link
              to="/dashboard"
              className="sidebar-link active"
            >
              <Home size={18} />
              <span>Dashboard</span>
            </Link>

            <Link
              to="/dashboard"
              className="sidebar-link"
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
            >
              <Compass size={18} />
              <span>Explore</span>
            </Link>

            <Link
              to="/dashboard"
              className="sidebar-link"
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
            >
              <CalendarDays size={18} />
              <span>Calendar</span>
            </Link>

            <Link
              to="/dashboard"
              className="sidebar-link"
            >
              <Heart size={18} />
              <span>Memories</span>
            </Link>

            <Link
              to="/dashboard"
              className="sidebar-link"
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
              <strong>Travel smarter</strong>
              <p>
                Keep your family plans in one place.
              </p>
            </div>

          </div>


          <Link
            to="/"
            className="sidebar-logout"
          >
            <LogOut size={17} />
            Sign out
          </Link>

        </div>

      </aside>


      {/* MOBILE OVERLAY */}

      {mobileMenu && (
        <div
          className="mobile-overlay"
          onClick={() => setMobileMenu(false)}
        />
      )}


      {/* =====================================================
          MAIN AREA
      ===================================================== */}

      <main className="dashboard-main">

        {/* HEADER */}

        <header className="dashboard-header">

          <button
            className="mobile-menu-button"
            onClick={() => setMobileMenu(true)}
            aria-label="Open menu"
          >
            <Menu size={21} />
          </button>


          <div className="header-date">

            <CalendarDays size={16} />

            <span>
              Friday, August 14, 2026
            </span>

          </div>


          <div className="header-actions">

            <button
              className="header-icon-button"
              title="Notifications"
            >
              <Bell size={19} />
              <span className="notification-dot" />
            </button>

            <div className="header-profile">

              <div className="profile-avatar">
                S
              </div>

              <div className="profile-details">
                <strong>Savaan</strong>
                <span>Family planner</span>
              </div>

              <ChevronRight size={16} />

            </div>

          </div>

        </header>


        {/* =====================================================
            PAGE CONTENT
        ===================================================== */}

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


            {/* HERO CONTENT */}

            <div className="hero-content">

              <div className="hero-badge">
                <Sparkles size={14} />
                SMART FAMILY TRAVEL
              </div>

              <h1>
                Good morning,
                <br />
                <span>Savaan!</span>
              </h1>

              <p className="hero-subtitle">
                Ready to plan your next family adventure?
              </p>

              <p className="hero-description">
                Start planning an unforgettable adventure together.
                Everything you need, all in one place.
              </p>

              <button className="hero-button">

                <Plus size={18} />

                Create a new trip

                <ArrowRight size={16} />

              </button>

            </div>


            {/* HERO DECORATION */}

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
                <span>Next destination</span>
                <strong>Anywhere</strong>
              </div>

              <div className="stat-decoration">
                <MapPin size={45} />
              </div>

            </div>


            <div className="stat-card">

              <div className="stat-icon teal">
                <Compass size={20} />
              </div>

              <div className="stat-info">
                <span>Total trips</span>
                <strong>8</strong>
                <small>
                  +2 this year
                </small>
              </div>

              <div className="stat-decoration">
                <Plane size={42} />
              </div>

            </div>


            <div className="stat-card">

              <div className="stat-icon purple">
                <Map size={20} />
              </div>

              <div className="stat-info">
                <span>Places visited</span>
                <strong>14</strong>
                <small>
                  Across 5 countries
                </small>
              </div>

              <div className="stat-decoration">
                <Globe2 size={45} />
              </div>

            </div>


            <div className="stat-card">

              <div className="stat-icon orange">
                <Users size={20} />
              </div>

              <div className="stat-info">
                <span>Family members</span>
                <strong>5</strong>
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
              CONTENT GRID
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

                        <button className="trip-more">
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


              {/* FAMILY CARD */}

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

                  <button className="small-add">
                    <Plus size={16} />
                  </button>

                </div>


                <div className="family-list">

                  {familyMembers.map((member, index) => (

                    <div
                      className="family-member"
                      key={index}
                    >

                      <div
                        className={`family-avatar avatar-${index + 1}`}
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

                      {index === 0 && (
                        <span className="organizer-badge">
                          You
                        </span>
                      )}

                    </div>

                  ))}

                </div>


                <button className="invite-family">
                  <Users size={16} />
                  Invite family member
                  <ArrowRight size={15} />
                </button>

              </section>


              {/* MEMORIES CARD */}

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

                  <button className="memory-button">
                    View memories
                    <ArrowRight size={14} />
                  </button>

                </div>


                <div className="memory-decoration">

                  <Heart
                    size={80}
                    strokeWidth={1}
                  />

                  <Star
                    className="memory-star"
                    size={22}
                    fill="currentColor"
                  />

                </div>

              </section>

            </aside>

          </div>


          {/* =================================================
              BOTTOM MOTIVATION
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