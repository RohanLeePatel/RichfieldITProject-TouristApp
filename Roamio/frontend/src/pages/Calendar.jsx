import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  Bell,
  Briefcase,
  ChevronLeft,
  ChevronRight,
  Clock,
  Compass,
  Edit2,
  Filter,
  Flag,
  Luggage,
  MapPin,
  Plane,
  PlaneLanding,
  PlaneTakeoff,
  Plus,
  Star,
  Sun,
  Ticket,
  Trash2,
  Users,
  X,
} from "lucide-react";
import { Link } from "react-router-dom";
import useTheme from "../components/recommendations/useTheme.js";
import PageTopBar from "../components/PageTopBar.jsx";
import { fetchTrip, fetchTrips } from "../api/trips";
import "../styles/Calendar.css";


// =========================================================
// CONSTANTS
// =========================================================

// Same key as before, so existing saved events carry over.
const EVENTS_STORAGE_KEY = "roamio_standalone_calendar_events";
// events live in localStorage, so keep each field short
const MAX_TITLE_CHARS = 100;
const MAX_LOCATION_CHARS = 150;

// South African public holidays (Sunday holidays observed on the Monday)
const PUBLIC_HOLIDAYS_SA = [
  { date: "2026-01-01", name: "New Year's Day" },
  { date: "2026-03-21", name: "Human Rights Day" },
  { date: "2026-04-03", name: "Good Friday" },
  { date: "2026-04-06", name: "Family Day" },
  { date: "2026-04-27", name: "Freedom Day" },
  { date: "2026-05-01", name: "Workers' Day" },
  { date: "2026-06-16", name: "Youth Day" },
  { date: "2026-08-09", name: "National Women's Day" },
  { date: "2026-08-10", name: "Women's Day (Observed)" },
  { date: "2026-09-24", name: "Heritage Day" },
  { date: "2026-12-16", name: "Day of Reconciliation" },
  { date: "2026-12-25", name: "Christmas Day" },
  { date: "2026-12-26", name: "Day of Goodwill" },
  { date: "2027-01-01", name: "New Year's Day" },
  { date: "2027-03-21", name: "Human Rights Day" },
  { date: "2027-03-22", name: "Human Rights Day (Observed)" },
  { date: "2027-03-26", name: "Good Friday" },
  { date: "2027-03-29", name: "Family Day" },
  { date: "2027-04-27", name: "Freedom Day" },
  { date: "2027-05-01", name: "Workers' Day" },
  { date: "2027-06-16", name: "Youth Day" },
  { date: "2027-08-09", name: "National Women's Day" },
  { date: "2027-09-24", name: "Heritage Day" },
  { date: "2027-12-16", name: "Day of Reconciliation" },
  { date: "2027-12-25", name: "Christmas Day" },
  { date: "2027-12-26", name: "Day of Goodwill" },
  { date: "2027-12-27", name: "Day of Goodwill (Observed)" },
];

const HOLIDAY_BY_DATE = new Map(PUBLIC_HOLIDAYS_SA.map((h) => [h.date, h]));

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const CATEGORIES = {
  Travel: { icon: Plane, tone: "teal" },
  Personal: { icon: Bell, tone: "blue" },
  Work: { icon: Briefcase, tone: "violet" },
  Family: { icon: Users, tone: "coral" },
  Important: { icon: Star, tone: "amber" },
};

const TRIP_TONES = ["teal", "coral", "violet", "amber", "blue"];

const DEFAULT_EVENTS = [
  {
    id: "1",
    date: "2026-08-28",
    title: "Family Dinner",
    time: "18:30",
    location: "Gateway",
    reminder: "1 hour before",
    category: "Family",
  },
];


// =========================================================
// DATE HELPERS
// =========================================================

function toKey(d) {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function parseKey(key) {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function addDays(date, amount) {
  const d = new Date(date);
  d.setDate(d.getDate() + amount);
  return d;
}

function diffDays(fromKey, toKeyValue) {
  return Math.round((parseKey(toKeyValue) - parseKey(fromKey)) / 86400000);
}

// Take the calendar date straight from an ISO string so time zones can't shift it a day.
function isoToKey(value) {
  if (!value) return null;
  const match = String(value).match(/^\d{4}-\d{2}-\d{2}/);
  if (match) return match[0];
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : toKey(d);
}

function formatShort(key) {
  return parseKey(key).toLocaleDateString("en-ZA", { day: "numeric", month: "short" });
}

// A Monday or Friday holiday makes a three-day weekend.
function isLongWeekend(key) {
  const day = parseKey(key).getDay();
  return day === 1 || day === 5;
}

// Fri holiday -> Fri-Sun, Mon holiday -> Sat-Mon: the dates the wizard opens with.
function longWeekendRange(key) {
  const day = parseKey(key);
  const start = day.getDay() === 5 ? day : addDays(day, -2);
  return { start: toKey(start), end: toKey(addDays(start, 2)) };
}

function plural(count, word) {
  return `${count} ${word}${count === 1 ? "" : "s"}`;
}


// =========================================================
// DATA HELPERS
// =========================================================

function loadEvents() {
  try {
    const saved = localStorage.getItem(EVENTS_STORAGE_KEY);
    if (!saved) return DEFAULT_EVENTS;
    const parsed = JSON.parse(saved);
    return Array.isArray(parsed) ? parsed : DEFAULT_EVENTS;
  } catch (error) {
    console.error("Could not load calendar events:", error);
    return DEFAULT_EVENTS;
  }
}

function normalizeTrips(data) {
  if (!Array.isArray(data)) return [];

  return data
    .map((trip) => {
      const startKey = isoToKey(trip.startDate);
      if (!startKey) return null;

      let endKey = isoToKey(trip.endDate) || startKey;
      if (endKey < startKey) endKey = startKey;

      return {
        id: trip.id,
        title: trip.title || "Untitled trip",
        destination: trip.destination || "Destination not set",
        startKey,
        endKey,
      };
    })
    .filter(Boolean)
    .sort((a, b) => a.startKey.localeCompare(b.startKey))
    .map((trip, index) => ({ ...trip, tone: TRIP_TONES[index % TRIP_TONES.length] }));
}

function tripDayLabel(trip, key) {
  if (trip.startKey === trip.endKey) return "Travel day";
  if (key === trip.startKey) return "Departure day";
  if (key === trip.endKey) return "Return day";
  return `Day ${diffDays(trip.startKey, key) + 1} of ${diffDays(trip.startKey, trip.endKey) + 1}`;
}

function categoryOf(event) {
  return CATEGORIES[event.category] || CATEGORIES.Personal;
}


// =========================================================
// CALENDAR
// =========================================================

export default function Calendar() {
  const { theme, toggle: toggleTheme } = useTheme(); // app-wide theme, also set in Settings

  const today = useMemo(() => new Date(), []);
  const todayKey = toKey(today);

  const [currentDate, setCurrentDate] = useState(
    () => new Date(today.getFullYear(), today.getMonth(), 1)
  );
  const [selectedDate, setSelectedDate] = useState(today);
  const [viewMode, setViewMode] = useState("month"); // 'month' | 'week'

  // Filters
  const [showTrips, setShowTrips] = useState(true);
  const [showHolidays, setShowHolidays] = useState(true);
  const [showEvents, setShowEvents] = useState(true);

  // Data
  const [events, setEvents] = useState(loadEvents);
  const [trips, setTrips] = useState([]);
  const [tripsError, setTripsError] = useState("");

  // Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState(null);
  const [modalDateKey, setModalDateKey] = useState(todayKey);
  const [formTitle, setFormTitle] = useState("");
  const [formError, setFormError] = useState("");
  const [formTime, setFormTime] = useState("09:00");
  const [formLocation, setFormLocation] = useState("");
  const [formCategory, setFormCategory] = useState("Travel");
  const [formReminder, setFormReminder] = useState("30 mins before");
  // optional: which trip a personal event belongs to
  const [formTripId, setFormTripId] = useState("");

  // full trips (with itinerary) for the selected day's stops, fetched on demand
  const [tripDetails, setTripDetails] = useState({});


  // ---------- effects ----------

  useEffect(() => {
    try {
      localStorage.setItem(EVENTS_STORAGE_KEY, JSON.stringify(events));
    } catch (error) {
      console.error("Could not save calendar events:", error);
    }
  }, [events]);

  useEffect(() => {
    let active = true;

    fetchTrips()
      .then((data) => {
        if (active) setTrips(normalizeTrips(data));
      })
      .catch(() => {
        if (active) setTripsError("Couldn't load your trips — showing holidays and events only.");
      });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!isModalOpen) return undefined;

    const onKeyDown = (event) => {
      if (event.key === "Escape") setIsModalOpen(false);
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isModalOpen]);


  // ---------- lookups ----------

  const tripsOn = useCallback(
    (key) => (showTrips ? trips.filter((t) => key >= t.startKey && key <= t.endKey) : []),
    [trips, showTrips]
  );

  const holidayOn = (key) => (showHolidays ? HOLIDAY_BY_DATE.get(key) : undefined);

  const eventsOn = (key) =>
    showEvents
      ? events
          .filter((e) => e.date === key)
          .sort((a, b) => (a.time || "").localeCompare(b.time || ""))
      : [];


  // ---------- derived ----------

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const selectedKey = toKey(selectedDate);

  const monthStartKey = toKey(new Date(year, month, 1));
  const monthEndKey = toKey(new Date(year, month + 1, 0));

  const monthTrips = trips.filter((t) => t.startKey <= monthEndKey && t.endKey >= monthStartKey);
  const monthHolidays = PUBLIC_HOLIDAYS_SA.filter(
    (h) => h.date >= monthStartKey && h.date <= monthEndKey
  );
  const monthLongWeekends = monthHolidays.filter((h) => isLongWeekend(h.date));

  const activeTrip = trips.find((t) => todayKey >= t.startKey && todayKey <= t.endKey);
  const nextTrip = trips.find((t) => t.startKey > todayKey);
  const passTrip = activeTrip || nextTrip;

  const upcomingHolidays = PUBLIC_HOLIDAYS_SA.filter((h) => h.date >= todayKey).slice(0, 4);

  const weekStart = addDays(selectedDate, -selectedDate.getDay());
  const weekDates = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  const toolbarTitle =
    viewMode === "month"
      ? `${MONTH_NAMES[month]} ${year}`
      : `${formatShort(toKey(weekDates[0]))} – ${formatShort(toKey(weekDates[6]))} ${weekDates[6].getFullYear()}`;

  const selectedTrips = tripsOn(selectedKey);
  const selectedHoliday = holidayOn(selectedKey);
  const selectedEvents = eventsOn(selectedKey);
  // the selected day's stops for each trip on it, once that trip's itinerary is loaded
  const selectedTripIds = selectedTrips.map((trip) => trip.id).join(",");
  useEffect(() => {
    selectedTrips
      .filter((trip) => !tripDetails[trip.id])
      .forEach((trip) => {
        fetchTrip(trip.id)
          .then((full) => setTripDetails((current) => ({ ...current, [trip.id]: full })))
          .catch(() => setTripDetails((current) => ({ ...current, [trip.id]: { itinerary: [] } })));
      });
  }, [selectedTripIds]); // eslint-disable-line react-hooks/exhaustive-deps

  const stopsOn = (trip, key) =>
    (tripDetails[trip.id]?.itinerary || []).filter((item) => item.dayNumber === diffDays(trip.startKey, key) + 1);

  const nextLongWeekend = PUBLIC_HOLIDAYS_SA.find((h) => h.date >= todayKey && isLongWeekend(h.date));
  const getawayLink = nextLongWeekend
    ? `/recommendations?start=${longWeekendRange(nextLongWeekend.date).start}&end=${longWeekendRange(nextLongWeekend.date).end}`
    : "/recommendations";

  const selectedIsEmpty =
    selectedTrips.length === 0 && !selectedHoliday && selectedEvents.length === 0;


  // ---------- navigation ----------

  const selectDate = (date) => {
    setSelectedDate(date);
    setCurrentDate(new Date(date.getFullYear(), date.getMonth(), 1));
  };

  const shift = (direction) => {
    if (viewMode === "week") {
      selectDate(addDays(selectedDate, 7 * direction));
    } else {
      setCurrentDate(new Date(year, month + direction, 1));
    }
  };

  const goToToday = () => selectDate(new Date());


  // ---------- modal ----------

  const openAddModal = () => {
    setEditingEvent(null);
    setModalDateKey(selectedKey);
    setFormTitle("");
    setFormTime("09:00");
    setFormLocation("");
    setFormCategory("Travel");
    setFormReminder("30 mins before");
    setFormTripId(selectedTrips[0] ? String(selectedTrips[0].id) : "");
    setFormError("");
    setIsModalOpen(true);
  };

  const openEditModal = (event) => {
    setEditingEvent(event);
    setModalDateKey(event.date);
    setFormTitle(event.title);
    setFormTime(event.time || "09:00");
    setFormLocation(event.location || "");
    setFormCategory(CATEGORIES[event.category] ? event.category : "Personal");
    setFormReminder(event.reminder || "30 mins before");
    setFormTripId(event.tripId ? String(event.tripId) : "");
    setFormError("");
    setIsModalOpen(true);
  };

  const handleSaveEvent = (e) => {
    e.preventDefault();
    const title = formTitle.trim();
    const location = formLocation.trim();
    let problem = "";
    if (!title) problem = "Give the event a title.";
    else if (title.length > MAX_TITLE_CHARS) problem = `Keep the title under ${MAX_TITLE_CHARS} characters.`;
    else if (location.length > MAX_LOCATION_CHARS) problem = `Keep the location under ${MAX_LOCATION_CHARS} characters.`;
    else if (formTime && !/^([01]\d|2[0-3]):[0-5]\d$/.test(formTime)) problem = "Enter a valid time, like 14:30.";
    setFormError(problem);
    if (problem) return;

    const fields = {
      title,
      time: formTime,
      location,
      category: formCategory,
      reminder: formReminder,
      tripId: formTripId || null,
    };

    if (editingEvent) {
      setEvents((prev) => prev.map((ev) => (ev.id === editingEvent.id ? { ...ev, ...fields } : ev)));
    } else {
      setEvents((prev) => [...prev, { id: Date.now().toString(), date: modalDateKey, ...fields }]);
    }

    setIsModalOpen(false);
  };

  const handleDeleteEvent = (id) => {
    setEvents((prev) => prev.filter((ev) => ev.id !== id));
  };


  // =========================================================
  // RENDER PIECES
  // =========================================================

  const renderTripBar = (trip, key, weekday) => {
    const isStart = key === trip.startKey;
    const isEnd = key === trip.endKey;
    const capStart = isStart || weekday === 0;
    const capEnd = isEnd || weekday === 6;

    return (
      <span
        key={trip.id}
        className={`cal-trip-bar tone-${trip.tone}${capStart ? " cap-start" : ""}${capEnd ? " cap-end" : ""}`}
        title={`${trip.title} · ${trip.destination}`}
      >
        {capStart && (
          <>
            {isStart && <PlaneTakeoff size={11} />}
            <span className="cal-trip-bar-label">{trip.destination}</span>
          </>
        )}
        {isEnd && !isStart && <PlaneLanding size={11} className="cal-trip-bar-end" />}
      </span>
    );
  };

  const renderMonthGrid = () => {
    const firstWeekday = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const totalCells = Math.ceil((firstWeekday + daysInMonth) / 7) * 7;
    const gridStart = new Date(year, month, 1 - firstWeekday);

    return Array.from({ length: totalCells }, (_, i) => {
      const date = addDays(gridStart, i);
      const key = toKey(date);
      const weekday = date.getDay();
      const dayTrips = tripsOn(key);
      const holiday = holidayOn(key);
      const dayEvents = eventsOn(key);

      const classes = [
        "cal-day",
        date.getMonth() !== month && "outside",
        (weekday === 0 || weekday === 6) && "weekend",
        holiday && "has-holiday",
        key === todayKey && "today",
        key === selectedKey && "selected",
      ]
        .filter(Boolean)
        .join(" ");

      return (
        <button
          type="button"
          key={key}
          className={classes}
          onClick={() => selectDate(date)}
          aria-pressed={key === selectedKey}
          aria-label={date.toLocaleDateString("en-ZA", { weekday: "long", day: "numeric", month: "long" })}
        >
          <span className="cal-day-top">
            <span className="cal-day-number">{date.getDate()}</span>
            {holiday && <Flag size={12} className="cal-day-flag" />}
          </span>

          {dayTrips.length > 0 && (
            <span className="cal-day-trips">
              {dayTrips.slice(0, 2).map((trip) => renderTripBar(trip, key, weekday))}
              {dayTrips.length > 2 && <span className="cal-day-more">+{dayTrips.length - 2} more</span>}
            </span>
          )}

          {holiday && <span className="cal-day-holiday">{holiday.name}</span>}

          {dayEvents.length > 0 && (
            <span className="cal-day-dots">
              {dayEvents.slice(0, 4).map((ev) => (
                <span key={ev.id} className={`cal-dot tone-${categoryOf(ev).tone}`} />
              ))}
            </span>
          )}
        </button>
      );
    });
  };

  const renderWeekGrid = () =>
    weekDates.map((date) => {
      const key = toKey(date);
      const dayTrips = tripsOn(key);
      const holiday = holidayOn(key);
      const dayEvents = eventsOn(key);

      return (
        <button
          type="button"
          key={key}
          className={`cal-week-day${key === selectedKey ? " selected" : ""}${key === todayKey ? " today" : ""}`}
          onClick={() => selectDate(date)}
          aria-pressed={key === selectedKey}
        >
          <span className="cal-week-head">
            <span>{WEEKDAYS[date.getDay()]}</span>
            <strong>{date.getDate()}</strong>
          </span>

          <span className="cal-week-items">
            {dayTrips.map((trip) => (
              <span key={trip.id} className={`cal-pill tone-${trip.tone}`} title={trip.title}>
                <Plane size={11} />
                {trip.destination}
              </span>
            ))}

            {holiday && (
              <span className="cal-pill tone-amber" title={holiday.name}>
                <Flag size={11} />
                {holiday.name}
              </span>
            )}

            {dayEvents.map((ev) => (
              <span key={ev.id} className={`cal-pill tone-${categoryOf(ev).tone}`} title={ev.title}>
                {ev.time && <b>{ev.time}</b>}
                {ev.title}
              </span>
            ))}
          </span>
        </button>
      );
    });

  const renderBoardingPass = () => {
    if (!passTrip) {
      return (
        <div className="cal-pass cal-pass-empty">
          <div className="cal-pass-main">
            <span className="cal-pass-label">
              <Ticket size={13} /> NEXT DEPARTURE
            </span>
            <strong className="cal-pass-empty-title">No trips booked yet</strong>
            <p>Your next boarding pass shows up here once a trip has dates.</p>
            <Link to="/recommendations" className="cal-pass-link">
              Plan a getaway <ArrowRight size={14} />
            </Link>
          </div>
          <div className="cal-pass-stub">
            <Luggage size={30} />
          </div>
        </div>
      );
    }

    const isActive = passTrip === activeTrip;
    const daysAway = diffDays(todayKey, passTrip.startKey);
    const totalDays = diffDays(passTrip.startKey, passTrip.endKey) + 1;

    return (
      <div className={`cal-pass tone-${passTrip.tone}`}>
        <div className="cal-pass-main">
          <span className="cal-pass-label">
            <Ticket size={13} /> {isActive ? "NOW TRAVELLING" : "NEXT DEPARTURE"}
          </span>

          <div className="cal-pass-route">
            <div>
              <small>TRIP</small>
              <strong>{passTrip.title}</strong>
            </div>
            <Plane size={16} className="cal-pass-plane" />
            <div className="cal-pass-to">
              <small>TO</small>
              <strong>{passTrip.destination}</strong>
            </div>
          </div>

          <div className="cal-pass-dates">
            <div>
              <small>DEPARTS</small>
              <strong>{formatShort(passTrip.startKey)}</strong>
            </div>
            <div>
              <small>RETURNS</small>
              <strong>{formatShort(passTrip.endKey)}</strong>
            </div>
          </div>

          <Link to={`/trips/${passTrip.id}`} className="cal-pass-link">
            View trip <ArrowRight size={14} />
          </Link>
        </div>

        <div className="cal-pass-stub">
          {isActive ? (
            <>
              <small>DAY</small>
              <strong>{diffDays(passTrip.startKey, todayKey) + 1}</strong>
              <small>of {totalDays}</small>
            </>
          ) : (
            <>
              <small>IN</small>
              <strong>{daysAway}</strong>
              <small>{daysAway === 1 ? "day" : "days"}</small>
            </>
          )}
        </div>
      </div>
    );
  };


  // =========================================================
  // RETURN
  // =========================================================

  return (
    <div className="calendar-page" data-theme={theme}>

      {/* HEADER */}
      <PageTopBar
        theme={theme}
        onToggleTheme={toggleTheme}
        hero={
          <div className="cal-band-hero">
            <div className="cal-band-copy">
              <p className="page-topbar-eyebrow">
                <Compass size={15} /> Travel calendar
              </p>
              <h1>
                {MONTH_NAMES[month]} <span>{year}</span>
              </h1>
              <p className="page-topbar-lede">Trips, long weekends and reminders, mapped across your month.</p>

              <div className="cal-hero-stats">
                <span><Plane size={14} /> {plural(monthTrips.length, "trip")}</span>
                <span><Flag size={14} /> {plural(monthHolidays.length, "holiday")}</span>
                <span><Luggage size={14} /> {plural(monthLongWeekends.length, "long weekend")}</span>
              </div>
            </div>

            {renderBoardingPass()}
          </div>
        }
      />


      <main className="cal-layout">




        <div className="cal-body">

          {/* CALENDAR CARD */}
          <section className="cal-card cal-main">
            <Compass className="cal-card-watermark" size={180} aria-hidden="true" />

            <div className="cal-toolbar">
              <div className="cal-toolbar-title">
                <h2>{toolbarTitle}</h2>
                <button type="button" className="cal-today-btn" onClick={goToToday}>
                  Today
                </button>
              </div>

              <div className="cal-toolbar-controls">
                <div className="cal-tabs" role="tablist">
                  {["month", "week"].map((mode) => (
                    <button
                      key={mode}
                      type="button"
                      role="tab"
                      aria-selected={viewMode === mode}
                      className={viewMode === mode ? "active" : ""}
                      onClick={() => setViewMode(mode)}
                    >
                      {mode === "month" ? "Month" : "Week"}
                    </button>
                  ))}
                </div>

                <div className="cal-nav">
                  <button type="button" onClick={() => shift(-1)} aria-label={`Previous ${viewMode}`}>
                    <ChevronLeft size={18} />
                  </button>
                  <button type="button" onClick={() => shift(1)} aria-label={`Next ${viewMode}`}>
                    <ChevronRight size={18} />
                  </button>
                </div>
              </div>
            </div>

            {tripsError && <p className="cal-notice">{tripsError}</p>}

            {viewMode === "month" ? (
              <>
                <div className="cal-weekdays">
                  {WEEKDAYS.map((day) => (
                    <span key={day}>{day}</span>
                  ))}
                </div>
                <div className="cal-month-grid">{renderMonthGrid()}</div>
              </>
            ) : (
              <div className="cal-week-scroll">
                <div className="cal-week-grid">{renderWeekGrid()}</div>
              </div>
            )}

            {/* FILTERS */}
            <div className="cal-filters">
              <span className="cal-filter-label">
                <Filter size={14} /> Show
              </span>

              <label className={`cal-filter${showTrips ? " on" : ""}`}>
                <input type="checkbox" checked={showTrips} onChange={(e) => setShowTrips(e.target.checked)} />
                <span className="cal-swatch swatch-trip" /> Trips
              </label>

              <label className={`cal-filter${showHolidays ? " on" : ""}`}>
                <input type="checkbox" checked={showHolidays} onChange={(e) => setShowHolidays(e.target.checked)} />
                <span className="cal-swatch swatch-holiday" /> Public holidays
              </label>

              <label className={`cal-filter${showEvents ? " on" : ""}`}>
                <input type="checkbox" checked={showEvents} onChange={(e) => setShowEvents(e.target.checked)} />
                <span className="cal-swatch swatch-event" /> Events & reminders
              </label>
            </div>
          </section>


          {/* SIDEBAR */}
          <aside className="cal-side">

            {/* AGENDA */}
            <section className="cal-card cal-agenda">
              <div className="cal-agenda-header">
                <div>
                  <span className="cal-eyebrow">ITINERARY</span>
                  <h3>
                    {selectedDate.toLocaleDateString("en-ZA", {
                      weekday: "long",
                      day: "numeric",
                      month: "short",
                    })}
                  </h3>
                </div>

                <button type="button" className="cal-add-btn" onClick={openAddModal} aria-label="Add event" title="Add event">
                  <Plus size={18} />
                </button>
              </div>

              <div className="cal-agenda-list">
                {selectedTrips.map((trip) => (
                  <Link key={trip.id} to={`/trips/${trip.id}`} className={`cal-ticket tone-${trip.tone}`}>
                    <div className="cal-ticket-main">
                      <span className="cal-ticket-label">
                        <Plane size={12} /> {tripDayLabel(trip, selectedKey)}
                      </span>
                      <strong>{trip.title}</strong>
                      <span className="cal-ticket-dest">
                        <MapPin size={12} /> {trip.destination}
                      </span>
                    </div>
                    <div className="cal-ticket-stub">
                      <small>{formatShort(trip.startKey)}</small>
                      <ArrowRight size={12} />
                      <small>{formatShort(trip.endKey)}</small>
                    </div>
                  </Link>
                ))}

                {selectedTrips.map((trip) =>
                  stopsOn(trip, selectedKey).length > 0 ? (
                    <ul key={`stops-${trip.id}`} className="cal-day-stops" aria-label={`${trip.title} stops`}>
                      {stopsOn(trip, selectedKey).map((item) => (
                        <li key={item.id}>
                          <span>{item.startTime}</span> {item.title}
                        </li>
                      ))}
                    </ul>
                  ) : null
                )}

                {selectedHoliday && (
                  <div className="cal-agenda-holiday">
                    <span className="cal-stamp">
                      <Flag size={16} />
                    </span>
                    <div>
                      <strong>{selectedHoliday.name}</strong>
                      <span>Public holiday</span>
                      {isLongWeekend(selectedHoliday.date) && (
                        <em className="cal-chip">Long weekend</em>
                      )}
                    </div>
                  </div>
                )}

                {selectedEvents.map((ev) => {
                  const { icon: Icon, tone } = categoryOf(ev);

                  return (
                    <div key={ev.id} className={`cal-agenda-event tone-${tone}`}>
                      <span className="cal-event-icon">
                        <Icon size={15} />
                      </span>

                      <div className="cal-event-details">
                        <strong>{ev.title}</strong>
                        <div className="cal-event-meta">
                          {ev.time && <span><Clock size={12} /> {ev.time}</span>}
                          {ev.location && <span><MapPin size={12} /> {ev.location}</span>}
                          {ev.tripId && trips.find((t) => String(t.id) === String(ev.tripId)) && (
                            <span><Plane size={12} /> {trips.find((t) => String(t.id) === String(ev.tripId)).title}</span>
                          )}
                        </div>
                        {ev.reminder && <small>Reminder: {ev.reminder}</small>}
                      </div>

                      <div className="cal-event-actions">
                        <button type="button" onClick={() => openEditModal(ev)} aria-label={`Edit ${ev.title}`} title="Edit">
                          <Edit2 size={14} />
                        </button>
                        <button type="button" onClick={() => handleDeleteEvent(ev.id)} aria-label={`Delete ${ev.title}`} title="Delete">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  );
                })}

                {selectedIsEmpty && (
                  <div className="cal-agenda-empty">
                    <span className="cal-empty-icon">
                      <Luggage size={26} />
                    </span>
                    <strong>Nothing packed for this day</strong>
                    <p>Add a reminder, a booking or a flight time.</p>
                    <button type="button" onClick={openAddModal}>
                      <Plus size={15} /> Add event
                    </button>
                  </div>
                )}
              </div>
            </section>


            {/* UPCOMING HOLIDAYS */}
            <section className="cal-card cal-getaways">
              <div className="cal-getaways-header">
                <span className="cal-eyebrow">PLAN AHEAD</span>
                <h3>Upcoming holidays</h3>
              </div>

              {upcomingHolidays.length === 0 ? (
                <p className="cal-muted">No more holidays on file for now.</p>
              ) : (
                <ul className="cal-getaway-list">
                  {upcomingHolidays.map((h) => {
                    const date = parseKey(h.date);
                    const inDays = diffDays(todayKey, h.date);

                    return (
                      <li key={h.date}>
                        <button type="button" onClick={() => selectDate(date)}>
                          <span className="cal-date-badge">
                            <small>{MONTH_NAMES[date.getMonth()].slice(0, 3)}</small>
                            <strong>{date.getDate()}</strong>
                          </span>
                          <span className="cal-getaway-info">
                            <strong>{h.name}</strong>
                            <span>
                              {inDays === 0 ? "Today" : inDays === 1 ? "Tomorrow" : `In ${inDays} days`}
                              {" · "}
                              {date.toLocaleDateString("en-ZA", { weekday: "long" })}
                            </span>
                          </span>
                          {isLongWeekend(h.date) && <em className="cal-chip">Long weekend</em>}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}

              <Link to={getawayLink} className="cal-getaway-cta">
                <span>
                  <Sun size={15} /> Find a getaway for the next long weekend
                </span>
                <ArrowRight size={15} />
              </Link>
            </section>

          </aside>
        </div>
      </main>


      {/* ADD / EDIT MODAL */}
      {isModalOpen && (
        <div
          className="cal-modal-overlay"
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsModalOpen(false);
          }}
        >
          <div className="cal-modal" role="dialog" aria-modal="true" aria-labelledby="cal-modal-title">
            <div className="cal-modal-header">
              <div>
                <h3 id="cal-modal-title">{editingEvent ? "Edit event" : "Add event or reminder"}</h3>
                <span>
                  {parseKey(modalDateKey).toLocaleDateString("en-ZA", {
                    weekday: "long",
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                  })}
                </span>
              </div>
              <button type="button" className="cal-modal-close" onClick={() => setIsModalOpen(false)} aria-label="Close">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveEvent} className="cal-form">
              <label>
                Title
                <input
                  type="text"
                  placeholder="e.g. Flight to Cape Town, Hotel check-in"
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  maxLength={MAX_TITLE_CHARS}
                  required
                  autoFocus
                />
              </label>

              <div className="cal-form-group">
                <span>Category</span>
                <div className="cal-category-picker">
                  {Object.entries(CATEGORIES).map(([name, { icon: Icon, tone }]) => (
                    <button
                      key={name}
                      type="button"
                      className={`cal-category tone-${tone}${formCategory === name ? " active" : ""}`}
                      onClick={() => setFormCategory(name)}
                      aria-pressed={formCategory === name}
                    >
                      <Icon size={14} />
                      {name}
                    </button>
                  ))}
                </div>
              </div>

              <div className="cal-form-row">
                <label>
                  Time
                  <input type="time" value={formTime} onChange={(e) => setFormTime(e.target.value)} />
                </label>

                <label>
                  Trip
                  <select value={formTripId} onChange={(e) => setFormTripId(e.target.value)}>
                    <option value="">Not part of a trip</option>
                    {trips.map((trip) => (
                      <option key={trip.id} value={String(trip.id)}>{trip.title}</option>
                    ))}
                  </select>
                </label>

                <label>
                  Reminder
                  <select value={formReminder} onChange={(e) => setFormReminder(e.target.value)}>
                    <option value="At time of event">At time of event</option>
                    <option value="15 mins before">15 mins before</option>
                    <option value="30 mins before">30 mins before</option>
                    <option value="1 hour before">1 hour before</option>
                    <option value="1 day before">1 day before</option>
                  </select>
                </label>
              </div>

              <label>
                Location
                <input
                  type="text"
                  placeholder="Optional — airport, hotel, address"
                  value={formLocation}
                  onChange={(e) => setFormLocation(e.target.value)}
                  maxLength={MAX_LOCATION_CHARS}
                />
              </label>

              {formError && <p className="cal-form-error" role="alert">{formError}</p>}

              <div className="cal-modal-actions">
                <button type="button" className="cal-btn-ghost" onClick={() => setIsModalOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="cal-btn-primary">
                  {editingEvent ? "Save changes" : "Add event"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
