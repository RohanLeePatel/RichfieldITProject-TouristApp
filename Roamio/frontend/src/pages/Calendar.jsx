import React, { useState, useEffect } from "react";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Plus,
  Bell,
  Trash2,
  Edit2,
  MapPin,
  Clock,
  X,
  Plane,
  Sparkles,
  ArrowLeft,
  CheckCircle2,
  Filter,
} from "lucide-react";
import { Link } from "react-router-dom";
import "../styles/Calendar.css";

// South African Public Holidays
const PUBLIC_HOLIDAYS_SA = [
  { date: "2026-01-01", name: "New Year's Day" },
  { date: "2026-03-21", name: "Human Rights Day" },
  { date: "2026-04-03", name: "Good Friday" },
  { date: "2026-04-06", name: "Family Day" },
  { date: "2026-04-27", name: "Freedom Day" },
  { date: "2026-05-01", name: "Workers' Day" },
  { date: "2026-06-16", name: "Youth Day" },
  { date: "2026-08-09", name: "National Women's Day" },
  { date: "2026-08-10", name: "Public Holiday (Women's Day Observed)" },
  { date: "2026-09-24", name: "Heritage Day" },
  { date: "2026-12-16", name: "Day of Reconciliation" },
  { date: "2026-12-25", name: "Christmas Day" },
  { date: "2026-12-26", name: "Day of Goodwill" },
];

export default function Calendar() {
  const [currentDate, setCurrentDate] = useState(new Date(2026, 7, 1)); // Default August 2026
  const [selectedDate, setSelectedDate] = useState(new Date(2026, 7, 28));
  const [viewMode, setViewMode] = useState("month"); // 'month' | 'week' | 'day'

  // Event Filters
  const [showHolidays, setShowHolidays] = useState(true);
  const [showEvents, setShowEvents] = useState(true);

  // Local Storage for User Events & Reminders
  const [events, setEvents] = useState(() => {
    const saved = localStorage.getItem("roamio_standalone_calendar_events");
    return saved
      ? JSON.parse(saved)
      : [
          {
            id: "1",
            date: "2026-08-28",
            title: "Family Dinner",
            time: "18:30",
            location: "Durban Central",
            reminder: "1 hour before",
            category: "Personal",
          },
        ];
  });

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState(null);

  // Modal Form Inputs
  const [formTitle, setFormTitle] = useState("");
  const [formTime, setFormTime] = useState("09:00");
  const [formLocation, setFormLocation] = useState("");
  const [formCategory, setFormCategory] = useState("Personal");
  const [formReminder, setFormReminder] = useState("30 mins before");

  useEffect(() => {
    localStorage.setItem("roamio_standalone_calendar_events", JSON.stringify(events));
  }, [events]);

  // Date Calculations
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const firstDayOfMonth = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];

  const prevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
  const nextMonth = () => setCurrentDate(new Date(year, month + 1, 1));
  const goToToday = () => {
    const today = new Date();
    setCurrentDate(today);
    setSelectedDate(today);
  };

  const formatDateKey = (d) => {
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  };

  const selectedKey = formatDateKey(selectedDate);

  // Agenda / Selected Day Items
  const selectedHolidays = showHolidays
    ? PUBLIC_HOLIDAYS_SA.filter((h) => h.date === selectedKey)
    : [];
  const selectedCustomEvents = showEvents
    ? events.filter((e) => e.date === selectedKey)
    : [];

  // Modal Handlers
  const handleOpenAddModal = () => {
    setEditingEvent(null);
    setFormTitle("");
    setFormTime("09:00");
    setFormLocation("");
    setFormCategory("Personal");
    setFormReminder("30 mins before");
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (event) => {
    setEditingEvent(event);
    setFormTitle(event.title);
    setFormTime(event.time || "09:00");
    setFormLocation(event.location || "");
    setFormCategory(event.category || "Personal");
    setFormReminder(event.reminder || "30 mins before");
    setIsModalOpen(true);
  };

  const handleSaveEvent = (e) => {
    e.preventDefault();
    if (!formTitle.trim()) return;

    if (editingEvent) {
      setEvents((prev) =>
        prev.map((ev) =>
          ev.id === editingEvent.id
            ? {
                ...ev,
                title: formTitle,
                time: formTime,
                location: formLocation,
                category: formCategory,
                reminder: formReminder,
              }
            : ev
        )
      );
    } else {
      const newEv = {
        id: Date.now().toString(),
        date: selectedKey,
        title: formTitle,
        time: formTime,
        location: formLocation,
        category: formCategory,
        reminder: formReminder,
      };
      setEvents((prev) => [...prev, newEv]);
    }
    setIsModalOpen(false);
  };

  const handleDeleteEvent = (id) => {
    setEvents((prev) => prev.filter((ev) => ev.id !== id));
  };

  // Render Month Grid Cells
  const renderMonthGrid = () => {
    const calendarCells = [];
    for (let i = 0; i < firstDayOfMonth; i++) {
      calendarCells.push(<div key={`empty-${i}`} className="calendar-day empty" />);
    }

    for (let day = 1; day <= daysInMonth; day++) {
      const cellDate = new Date(year, month, day);
      const dateKey = formatDateKey(cellDate);
      const isSelected = dateKey === selectedKey;
      const isToday = formatDateKey(new Date()) === dateKey;

      const hasHoliday = showHolidays && PUBLIC_HOLIDAYS_SA.some((h) => h.date === dateKey);
      const hasCustom = showEvents && events.some((e) => e.date === dateKey);

      calendarCells.push(
        <button
          type="button"
          key={day}
          className={`calendar-day ${isSelected ? "selected" : ""} ${isToday ? "today" : ""}`}
          onClick={() => setSelectedDate(cellDate)}
        >
          <span className="day-number">{day}</span>
          <div className="dots-container">
            {hasHoliday && <span className="dot holiday-dot" title="Holiday" />}
            {hasCustom && <span className="dot event-dot" title="Event" />}
          </div>
        </button>
      );
    }
    return calendarCells;
  };

  // Render Week Grid Cells
  const renderWeekGrid = () => {
    const startOfWeek = new Date(selectedDate);
    startOfWeek.setDate(selectedDate.getDate() - selectedDate.getDay());

    const weekDays = [];
    for (let i = 0; i < 7; i++) {
      const dayDate = new Date(startOfWeek);
      dayDate.setDate(startOfWeek.getDate() + i);
      const dateKey = formatDateKey(dayDate);
      const isSelected = dateKey === selectedKey;

      const dayHolidays = showHolidays ? PUBLIC_HOLIDAYS_SA.filter((h) => h.date === dateKey) : [];
      const dayEvents = showEvents ? events.filter((e) => e.date === dateKey) : [];

      weekDays.push(
        <div
          key={i}
          className={`week-day-column ${isSelected ? "selected" : ""}`}
          onClick={() => setSelectedDate(dayDate)}
        >
          <div className="week-day-header">
            <span>{dayDate.toLocaleDateString("en-US", { weekday: "short" })}</span>
            <strong>{dayDate.getDate()}</strong>
          </div>
          <div className="week-events-list">
            {dayHolidays.map((h, idx) => (
              <div key={idx} className="mini-event holiday">{h.name}</div>
            ))}
            {dayEvents.map((e) => (
              <div key={e.id} className="mini-event custom">{e.title}</div>
            ))}
          </div>
        </div>
      );
    }
    return weekDays;
  };

  return (
    <div className="calendar-page">
      {/* Header */}
      <header className="calendar-header">
        <div className="calendar-brand">
          <div className="calendar-logo">
            <Plane size={19} strokeWidth={2.2} />
          </div>
          <div className="calendar-brand-text">
            <h2>Roamio</h2>
            <span>Calendar</span>
          </div>
        </div>
        <Link to="/dashboard" className="calendar-back-button">
          <ArrowLeft size={16} />
          Back to Dashboard
        </Link>
      </header>

      <main className="calendar-container">
        {/* Left Column: Calendar Main Box */}
        <div className="calendar-main-card">
          <div className="calendar-toolbar">
            <div className="month-year-title">
              <h2>{monthNames[month]} {year}</h2>
              <button className="today-btn" onClick={goToToday}>Today</button>
            </div>

            {/* View Mode Toggle */}
            <div className="view-mode-tabs">
              <button
                className={viewMode === "month" ? "active" : ""}
                onClick={() => setViewMode("month")}
              >
                Month
              </button>
              <button
                className={viewMode === "week" ? "active" : ""}
                onClick={() => setViewMode("week")}
              >
                Week
              </button>
            </div>

            <div className="month-nav-buttons">
              <button onClick={prevMonth} aria-label="Previous"><ChevronLeft size={20} /></button>
              <button onClick={nextMonth} aria-label="Next"><ChevronRight size={20} /></button>
            </div>
          </div>

          {viewMode === "month" ? (
            <>
              <div className="weekdays-grid">
                <span>Sun</span><span>Mon</span><span>Tue</span><span>Wed</span>
                <span>Thu</span><span>Fri</span><span>Sat</span>
              </div>
              <div className="days-grid">{renderMonthGrid()}</div>
            </>
          ) : (
            <div className="week-grid-container">{renderWeekGrid()}</div>
          )}

          {/* Filters & Legend */}
          <div className="calendar-filter-bar">
            <span className="filter-label"><Filter size={14} /> Filter:</span>
            <label className="filter-toggle">
              <input
                type="checkbox"
                checked={showHolidays}
                onChange={(e) => setShowHolidays(e.target.checked)}
              />
              <span className="dot holiday-dot" /> Public Holidays
            </label>
            <label className="filter-toggle">
              <input
                type="checkbox"
                checked={showEvents}
                onChange={(e) => setShowEvents(e.target.checked)}
              />
              <span className="dot event-dot" /> Events & Reminders
            </label>
          </div>
        </div>

        {/* Right Column: Selected Day Schedule */}
        <aside className="calendar-sidebar">
          <div className="agenda-header">
            <div>
              <span className="agenda-eyebrow">AGENDA</span>
              3<h3>
                {selectedDate.toLocaleDateString("en-ZA", {
                  weekday: "long",
                  month: "short",
                  day: "numeric",
                })}
              </h3>
            </div>
            <button className="add-event-btn" onClick={handleOpenAddModal} title="Add Event">
              <Plus size={18} />
            </button>
          </div>

          <div className="agenda-list">
            {/* Public Holidays */}
            {selectedHolidays.map((h, i) => (
              <div key={`hol-${i}`} className="agenda-item holiday">
                <div className="item-icon"><Sparkles size={16} /></div>
                <div className="item-details">
                  <strong>{h.name}</strong>
                  <span>Public Holiday</span>
                </div>
              </div>
            ))}

            {/* Custom Events */}
            {selectedCustomEvents.map((e) => (
              <div key={e.id} className="agenda-item custom">
                <div className="item-icon"><Bell size={16} /></div>
                <div className="item-details">
                  <strong>{e.title}</strong>
                  <div className="item-meta">
                    {e.time && <span><Clock size={12} /> {e.time}</span>}
                    {e.location && <span><MapPin size={12} /> {e.location}</span>}
                  </div>
                  {e.reminder && <small className="reminder-tag">Reminder: {e.reminder}</small>}
                </div>
                <div className="item-actions">
                  <button onClick={() => handleOpenEditModal(e)} title="Edit"><Edit2 size={14} /></button>
                  <button onClick={() => handleDeleteEvent(e.id)} title="Delete"><Trash2 size={14} /></button>
                </div>
              </div>
            ))}

            {selectedHolidays.length === 0 && selectedCustomEvents.length === 0 && (
              <div className="agenda-empty">
                <CalendarDays size={32} />
                <p>No events or holidays for this day.</p>
                <button onClick={handleOpenAddModal}>+ Add Event / Reminder</button>
              </div>
            )}
          </div>
        </aside>
      </main>

      {/* Add / Edit Event Modal */}
      {isModalOpen && (
        <div className="modal-overlay">
          <div className="modal-card">
            <div className="modal-header">
              <h3>{editingEvent ? "Edit Event" : "Add Event / Reminder"}</h3>
              <button onClick={() => setIsModalOpen(false)}><X size={18} /></button>
            </div>
            <form onSubmit={handleSaveEvent} className="modal-form">
              <label>
                Event Title
                <input
                  type="text"
                  placeholder="e.g. Doctor's appointment, Meeting"
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  required
                />
              </label>

              <div className="form-row">
                <label>
                  Time
                  <input
                    type="time"
                    value={formTime}
                    onChange={(e) => setFormTime(e.target.value)}
                  />
                </label>

                <label>
                  Category
                  <select
                    value={formCategory}
                    onChange={(e) => setFormCategory(e.target.value)}
                  >
                    <option value="Personal">Personal</option>
                    <option value="Work">Work</option>
                    <option value="Family">Family</option>
                    <option value="Important">Important</option>
                  </select>
                </label>
              </div>

              <div className="form-row">
                <label>
                  Reminder
                  <select
                    value={formReminder}
                    onChange={(e) => setFormReminder(e.target.value)}
                  >
                    <option value="At time of event">At time of event</option>
                    <option value="15 mins before">15 mins before</option>
                    <option value="30 mins before">30 mins before</option>
                    <option value="1 hour before">1 hour before</option>
                    <option value="1 day before">1 day before</option>
                  </select>
                </label>

                <label>
                  Location
                  <input
                    type="text"
                    placeholder="Optional"
                    value={formLocation}
                    onChange={(e) => setFormLocation(e.target.value)}
                  />
                </label>
              </div>

              <div className="modal-actions">
                <button type="button" className="cancel-btn" onClick={() => setIsModalOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="save-btn">
                  {editingEvent ? "Save Changes" : "Add Event"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}