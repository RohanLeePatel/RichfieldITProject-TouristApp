import { useEffect, useMemo, useState } from "react";
import {
  CalendarDays,
  ChevronRight,
  Baby,
  MapPin,
  Plus,
  Sparkles,
  UserRound,
  Users,
  Plane,
} from "lucide-react";
import { Link, useNavigate } from "react-router-dom";

import TravelGroups from "../components/groups/TravelGroups.jsx";
import Hint from "../components/onboarding/Hint.jsx";
import PageShell from "../components/recommendations/PageShell.jsx";
import { fetchTrips } from "../api/trips";
import useActiveTrip from "../hooks/useActiveTrip.js";
import { getTripStatus, localTripDay } from "../utils/tripStatus.js";
import "../styles/Family.css";

function normalizeTrip(trip) {
  return {
    ...trip,
    id: trip.id,
    title:
      trip.title ||
      trip.name ||
      "Untitled trip",
    destination:
      trip.destination ||
      "Destination not specified",
    startDate: trip.startDate || null,
    endDate: trip.endDate || null,
    status: trip.status || null,
  };
}

function formatTripDates(startDate, endDate) {
  if (!startDate && !endDate) {
    return "Dates not set";
  }

  const formatDate = (value) => {
    if (!value) return null;

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return null;
    }

    // "9 Nov 2026" like the other pages; UTC because trip dates are stored as UTC midnight
    return date.toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
      timeZone: "UTC",
    });
  };

  const start = formatDate(startDate);
  const end = formatDate(endDate);

  if (start && end) {
    return `${start} – ${end}`;
  }

  return start || end || "Dates not set";
}

function getTripColor(index) {
  const colors = ["teal", "blue", "purple"];

  return colors[index % colors.length];
}


// Who is travelling on a trip, from what the trip wizard saved:
// { adults, childAges }. Older trips have none, so the numbers are unknown.
function getTravellerStats(trip) {
  const travellers = trip.travellers;

  if (!travellers || typeof travellers !== "object") return null;

  const adults = Number(travellers.adults) || 0;
  const childAges = Array.isArray(travellers.childAges)
    ? travellers.childAges
    : [];

  return {
    adults,
    children: childAges.length,
    childAges,
    members: adults + childAges.length,
  };
}

// the status shown to people: a trip that has started is "In progress" on every other page too
const statusLabel = (status) => (status === "Ongoing" ? "In progress" : status);

export default function Family() {
  const navigate = useNavigate();
  const { trip: sidebarTrip } = useActiveTrip();

  const [trips, setTrips] = useState([]);

  const [tripsLoading, setTripsLoading] =
    useState(true);

  const [tripsError, setTripsError] =
    useState("");

  const [activeTripId, setActiveTripId] =
    useState(null);

  // loaded by TravelGroups, used for the group trip's traveller counts
  const [groups, setGroups] = useState([]);

  /*
   * Load real trips from the Roamio API.
   */
  useEffect(() => {
    let cancelled = false;

    async function loadTrips() {
      setTripsLoading(true);
      setTripsError("");

      try {
        const result = await fetchTrips();

        if (!cancelled) {
          const normalized = Array.isArray(result)
            ? result.map(normalizeTrip)
            : [];

          setTrips(normalized);
        }
      } catch (error) {
        if (!cancelled) {
          setTripsError(
            error?.message ||
              "Unable to load your trips."
          );

          setTrips([]);
        }
      } finally {
        if (!cancelled) {
          setTripsLoading(false);
        }
      }
    }

    loadTrips();

    return () => {
      cancelled = true;
    };
  }, []);

  const today = localTripDay();
  const tripsByStatus = useMemo(() => {
    const groups = { Ongoing: [], Planning: [], Completed: [], Cancelled: [] };
    const startTime = (trip) => {
      const time = Date.parse(trip.startDate);
      return Number.isNaN(time) ? Number.MAX_SAFE_INTEGER : time;
    };
    for (const trip of [...trips].sort((a, b) => startTime(a) - startTime(b))) {
      const calculatedStatus = getTripStatus(trip, today);
      groups[calculatedStatus].push({ ...trip, calculatedStatus });
    }
    return groups;
  }, [trips, today]);
  const { Ongoing: activeTrips, Planning: upcomingTrips, Completed: completedTrips, Cancelled: cancelledTrips } = tripsByStatus;
  const overviewTrips = [...activeTrips, ...upcomingTrips, ...completedTrips, ...cancelledTrips];

  // a tab picked on this page wins, then the trip picked in the sidebar, then the first one
  const activeTrip =
    overviewTrips.find(
      (trip) => trip.id === activeTripId
    ) ||
    overviewTrips.find(
      (trip) => String(trip.id) === String(sidebarTrip?.id)
    ) ||
    overviewTrips[0] ||
    null;

  // a group trip counts the group's accounts + saved companions; otherwise
  // fall back to what the wizard saved
  const activeGroup = activeTrip
    ? groups.find((g) => g.trips.some((t) => t.id === activeTrip.id))
    : null;

  let activeStats = activeTrip
    ? getTravellerStats(activeTrip)
    : null;

  if (activeGroup) {
    const companions = activeGroup.companions || [];
    const childAges = companions
      .filter((c) => c.type === "Child")
      .map((c) => c.age)
      .filter((age) => age != null);
    const children = companions.filter((c) => c.type === "Child").length;
    const adults = activeGroup.members.length + companions.length - children;

    activeStats = { adults, children, childAges, members: adults + children };
  }

  const renderTripsSection = ({
    sectionTrips,
    title,
    subtitle,
    emptyTitle,
    emptyText,
  }) => (
        <section className="family-trips-section" key={title}>

          <div className="family-section-heading-row">

            <div>

              <span className="family-section-eyebrow">
                <CalendarDays size={14} />
                SHARED ADVENTURES
              </span>

              <h2>
                {title}
              </h2>

              <p>
                {subtitle}
              </p>

            </div>

            <Link
              to="/trips"
              className="family-outline-link"
            >
              View all trips
              <ChevronRight size={15} />
            </Link>

          </div>

          {tripsLoading ? (
            <div className="family-empty-state">
              <div className="family-empty-icon">
                <CalendarDays size={24} />
              </div>

              <h3>
                Loading your trips
              </h3>

              <p>
                Your Roamio trips are being loaded.
              </p>
            </div>
          ) : tripsError ? (
            <div className="family-empty-state">
              <div className="family-empty-icon">
                <CalendarDays size={24} />
              </div>

              <h3>
                Unable to load trips
              </h3>

              <p>
                {tripsError}
              </p>

              <Link
                to="/trips"
                className="family-button family-button-secondary"
              >
                Open My Trips
              </Link>
            </div>
          ) : sectionTrips.length === 0 ? (
            <div className="family-empty-state">
              <div className="family-empty-icon">
                <Plane size={24} />
              </div>

              <h3>
                {emptyTitle}
              </h3>

              <p>
                {emptyText}
              </p>

              <Link
                to="/trips"
                className="family-button family-button-primary"
              >
                <Plus size={16} />
                Create a trip
              </Link>
            </div>
          ) : (
            <div className="family-trip-grid">

              {sectionTrips.map(
                (trip, index) => {
                  const color =
                    getTripColor(index);

                  return (
                    <Link
                      to="/trips"
                      className={`family-trip-card family-trip-${color}`}
                      key={trip.id}
                    >

                      <div className="family-trip-cover">

                        <div className="family-trip-cover-glow" />

                        <div className="family-trip-icon">
                          <Plane size={22} />
                        </div>

                        <span className="family-trip-status">
                          {statusLabel(trip.calculatedStatus)}
                        </span>

                      </div>

                      <div className="family-trip-body">

                        <h3>
                          {trip.title}
                        </h3>

                        <p>
                          <MapPin size={14} />
                          {
                            trip.destination
                          }
                        </p>

                        <div className="family-trip-details">

                          <span>
                            <CalendarDays
                              size={14}
                            />

                            {formatTripDates(
                              trip.startDate,
                              trip.endDate
                            )}
                          </span>

                          {trip.members && (
                            <span>
                              <Users
                                size={14}
                              />

                              {
                                trip.members
                              }{" "}
                              members
                            </span>
                          )}

                        </div>

                        <div className="family-trip-link">
                          Open trip
                          <ChevronRight size={15} />
                        </div>

                      </div>

                    </Link>
                  );
                }
              )}

            </div>
          )}

        </section>
  );

  const hero = (
    <>
      <p className="recommendations-eyebrow family-hero-eyebrow">
        <Sparkles size={15} />
        Your travel group
      </p>

      <h1>
        Adventures are better
        <span> together.</span>
      </h1>

      <p>
        Keep your travel group organised, remember
        everyone's interests, and plan trips that work
        for everyone.
      </p>
    </>
  );

  return (
    <PageShell
      backLabel="Back to dashboard"
      onBack={() => navigate("/dashboard")}
      hero={hero}
    >
      <div className="family-page-content">

        <Hint id="groups">
          A travel group is the people you plan with. Add them here, share trips with the group, and the trip suggestions will take everyone&apos;s preferences into account.
        </Hint>

        {/* TRAVEL GROUP OVERVIEW - one tab per trip */}

        <section className="family-overview">
          <div className="family-overview-heading">
            <div>
              <span className="family-section-eyebrow">
                <Users size={14} />
                TRAVEL GROUP OVERVIEW
              </span>

              <h2>
                Your travel group at a glance
              </h2>

              <p>
                Who is travelling on each of your
                trips.
              </p>
            </div>
          </div>

          {tripsLoading ? (
            <div className="family-empty-state">
              <div className="family-empty-icon">
                <Users size={24} />
              </div>

              <h3>Loading your trips</h3>

              <p>
                Your Roamio trips are being loaded.
              </p>
            </div>
          ) : overviewTrips.length === 0 ? (
            <div className="family-empty-state">
              <div className="family-empty-icon">
                <Plane size={24} />
              </div>

              <h3>No trips yet</h3>

              <p>
                Create a trip and the people
                travelling on it will show up here.
              </p>

              <Link
                to="/trips"
                className="family-button family-button-primary"
              >
                <Plus size={16} />
                Create a trip
              </Link>
            </div>
          ) : (
            <>
              <div
                className="family-trip-tabs"
                role="tablist"
                aria-label="Choose a trip"
              >
                {overviewTrips.map((trip) => (
                  <button
                    type="button"
                    role="tab"
                    key={trip.id}
                    id={`family-trip-tab-${trip.id}`}
                    aria-selected={
                      trip.id === activeTrip.id
                    }
                    aria-controls="family-trip-panel"
                    className={
                      trip.id === activeTrip.id
                        ? "active"
                        : ""
                    }
                    onClick={() =>
                      setActiveTripId(trip.id)
                    }
                  >
                    {trip.title}
                  </button>
                ))}
              </div>

              <div
                className="family-trip-panel"
                role="tabpanel"
                id="family-trip-panel"
                aria-labelledby={`family-trip-tab-${activeTrip.id}`}
              >
                <div className="family-trip-panel-head">
                  <div>
                    <h3>{activeTrip.title}</h3>

                    <p>
                      <span>
                        <MapPin size={14} />
                        {activeTrip.destination}
                      </span>

                      <span>
                        <CalendarDays size={14} />
                        {formatTripDates(
                          activeTrip.startDate,
                          activeTrip.endDate
                        )}
                      </span>

                      <span className="family-trip-panel-status">
                        {statusLabel(activeTrip.calculatedStatus)}
                      </span>
                    </p>
                  </div>

                  <Link
                    to="/trips"
                    className="family-outline-link"
                  >
                    Open trip
                    <ChevronRight size={15} />
                  </Link>
                </div>

                <div className="family-stat-grid family-stat-grid-3">

                  <div className="family-stat-card family-stat-primary">
                    <div className="family-stat-icon">
                      <Users size={20} />
                    </div>

                    <div>
                      <span>Group members</span>

                      <strong>
                        {activeStats
                          ? activeStats.members
                          : "—"}
                      </strong>

                      <small>
                        {activeStats
                          ? "Everyone on this trip"
                          : "Not recorded for this trip"}
                      </small>
                    </div>

                    <div className="family-stat-decoration">
                      <Users size={64} />
                    </div>
                  </div>

                  <div className="family-stat-card">
                    <div className="family-stat-icon family-stat-icon-teal">
                      <UserRound size={20} />
                    </div>

                    <div>
                      <span>Adults</span>

                      <strong>
                        {activeStats
                          ? activeStats.adults
                          : "—"}
                      </strong>

                      <small>
                        Including you
                      </small>
                    </div>
                  </div>

                  <div className="family-stat-card">
                    <div className="family-stat-icon family-stat-icon-purple">
                      <Baby size={20} />
                    </div>

                    <div>
                      <span>Children</span>

                      <strong>
                        {activeStats
                          ? activeStats.children
                          : "—"}
                      </strong>

                      <small>
                        {activeStats &&
                        activeStats.childAges.length > 0
                          ? `Ages ${activeStats.childAges.join(", ")}`
                          : "Little explorers"}
                      </small>
                    </div>
                  </div>

                </div>
              </div>
            </>
          )}
        </section>

        {/* REAL GROUPS - accounts on the server, shared trips, invites */}
        <TravelGroups onGroups={setGroups} tripId={activeTrip?.id} />

        {/* REAL ACTIVE TRIPS - only shown once a trip has begun */}
        {!tripsLoading &&
          !tripsError &&
          activeTrips.length > 0 &&
          renderTripsSection({
            sectionTrips: activeTrips,
            title: "Your active trips",
            subtitle:
              "Trips that have already begun and are under way.",
          })}

        {/* REAL UPCOMING TRIPS */}
        {renderTripsSection({
          sectionTrips: upcomingTrips,
          title: "Your upcoming trips",
          subtitle:
            "Trips you're planning, solo or with your group.",
          emptyTitle: "No upcoming trips",
          emptyText:
            "Create a trip to start planning your next adventure.",
        })}

        {/* REAL COMPLETED TRIPS - only shown once a trip has finished */}
        {!tripsLoading &&
          !tripsError &&
          completedTrips.length > 0 &&
          renderTripsSection({
            sectionTrips: completedTrips,
            title: "Your completed trips",
            subtitle: "Trips you've already taken.",
          })}

      </div>

    </PageShell>
  );
}
