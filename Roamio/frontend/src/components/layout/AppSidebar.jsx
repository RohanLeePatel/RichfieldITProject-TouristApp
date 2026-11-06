import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Bell, CalendarDays, CircleHelp, CloudSun, Compass, Home, Languages, LogOut, Map, MessageCircle, Plane, Settings, ShieldCheck, Users, X,
} from "lucide-react";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router-dom";

import { fetchMe } from "../../api/account.js";
import { fetchNotifications, markAllNotificationsRead } from "../../api/notifications.js";
import useActiveTrip from "../../hooks/useActiveTrip.js";
import { useAuthStore } from "../../store/authStore.js";
import "../../styles/appShell.css";

// Only shown when the API says the signed-in user is an admin
const ADMIN_SECTION = {
  label: "Admin",
  links: [{ to: "/admin", label: "Admin dashboard", icon: ShieldCheck }],
};

const NAV_SECTIONS = [
  {
    label: "Your space",
    links: [
      { to: "/dashboard", label: "Dashboard", icon: Home },
      { to: "/trips", label: "My Trips", icon: Map, showTripCount: true },
      { to: "/recommendations", label: "Plan a trip", icon: Compass },
      { to: "/family", label: "Travel groups", icon: Users },
    ],
  },
  {
    label: "For this trip",
    links: [
      { to: "/calendar", label: "Calendar", icon: CalendarDays },
      { to: "/weather", label: "Weather", icon: CloudSun, tripAware: true },
      { to: "/translator", label: "Travel Translator", icon: Languages, tripAware: true },
      { to: "/chat", label: "Trip assistant", icon: MessageCircle },
      { to: "/settings", label: "Settings", icon: Settings },
    ],
  },
];

// The one navigation sidebar, shared by the Dashboard and every page inside
// AppShell. Markup and classes are the Dashboard's original sidebar
// (styles/dashboard.css), plus the active-trip switcher and notifications.
export default function AppSidebar({ open, onClose }) {
  const location = useLocation();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const logout = useAuthStore((state) => state.logout);
  const userId = useAuthStore((state) => state.user?.id);
  const { trip, trips, setActiveTrip } = useActiveTrip();

  // GET /users/me carries isAdmin (decided server-side from ADMIN_USER_IDS)
  const { data: me } = useQuery({ queryKey: ["me", userId], queryFn: fetchMe, enabled: userId != null, staleTime: 5 * 60_000 });
  const sections = me?.isAdmin ? [...NAV_SECTIONS, ADMIN_SECTION] : NAV_SECTIONS;

  const [inbox, setInbox] = useState({ notifications: [], unreadCount: 0 });
  const [inboxOpen, setInboxOpen] = useState(false);

  useEffect(() => {
    fetchNotifications()
      .then((data) => setInbox({ notifications: data?.notifications || [], unreadCount: data?.unreadCount || 0 }))
      .catch(() => {
        // the bell just stays empty
      });
  }, []);

  // Opening the bell marks everything as read. Closing it does nothing, and nothing
  // is sent when there are no unread items.
  const toggleInbox = () => {
    const opening = !inboxOpen;
    setInboxOpen(opening);
    if (opening && inbox.unreadCount > 0) {
      markAllNotificationsRead()
        .then(() => setInbox((current) => ({ ...current, unreadCount: 0 })))
        .catch(() => {});
    }
  };

  const isActive = (path) =>
    path === "/dashboard" ? location.pathname === "/dashboard" : location.pathname.startsWith(path);

  const switchTrip = (event) => {
    setActiveTrip(event.target.value || null);
    // a trip's own pages take the trip from the URL, so go to the same
    // section of the newly picked trip
    const onTripPage = location.pathname.match(/^\/trips\/\d+(\/.*)?$/);
    if (onTripPage) {
      navigate(`/trips/${event.target.value}${onTripPage[1] || ""}${location.search}`);
      return;
    }
    // a ?trip= in the address bar would otherwise win straight back
    if (params.has("trip")) {
      const next = new URLSearchParams(params);
      next.set("trip", event.target.value);
      setParams(next, { replace: true });
    }
  };

  const handleLogout = () => {
    logout();
    setActiveTrip(null);
    onClose?.();
    navigate("/login", { replace: true });
  };

  return (
    <>
      <aside className={`dashboard-sidebar ${open ? "sidebar-open" : ""}`}>
        <div className="sidebar-top">
          <Link to="/dashboard" className="dashboard-logo" onClick={onClose}>
            <div className="dashboard-logo-icon">
              <Plane size={19} />
            </div>
            <span>Roamio</span>
          </Link>

          <button type="button" className="mobile-close" onClick={onClose} aria-label="Close menu">
            <X size={20} />
          </button>
        </div>

        {trips.length > 0 && (
          <label className="sidebar-trip-switcher">
            <span className="sidebar-label">Active trip</span>
            <select value={trip ? String(trip.id) : ""} onChange={switchTrip}>
              {trips.map((t) => (
                <option key={t.id} value={String(t.id)}>
                  {t.title}
                </option>
              ))}
            </select>
          </label>
        )}

        {sections.map((section) => (
          <div className="sidebar-section" key={section.label}>
            <p className="sidebar-label">{section.label}</p>
            <nav className="sidebar-nav">
              {section.links.map(({ to, label, icon: Icon, showTripCount, tripAware }) => (
                <Link
                  key={to}
                  to={tripAware && trip ? `${to}?trip=${trip.id}` : to}
                  className={`sidebar-link ${isActive(to) ? "active" : ""}`}
                  aria-current={isActive(to) ? "page" : undefined}
                  onClick={onClose}
                >
                  <Icon size={18} />
                  <span>{label}</span>
                  {showTripCount && trips.length > 0 && <span className="nav-count">{trips.length}</span>}
                </Link>
              ))}
            </nav>
          </div>
        ))}

        <div className="sidebar-bottom">
          <button
            type="button"
            className="sidebar-logout sidebar-inbox-button"
            onClick={toggleInbox}
            aria-expanded={inboxOpen}
          >
            <Bell size={17} />
            Notifications
            {inbox.unreadCount > 0 && <span className="nav-count">{inbox.unreadCount}</span>}
          </button>

          {inboxOpen && (
            <ul className="sidebar-inbox" aria-label="Notifications">
              {inbox.notifications.length === 0 ? (
                <li className="sidebar-inbox-empty">Nothing new.</li>
              ) : (
                inbox.notifications.map((item) => (
                  <li key={item.id}>
                    <strong>{item.title}</strong>
                    <span>{item.message}</span>
                  </li>
                ))
              )}
            </ul>
          )}

          <Link to="/settings#help" className="sidebar-logout" onClick={onClose}>
            <CircleHelp size={17} />
            Help &amp; tips
          </Link>

          <button type="button" className="sidebar-logout" onClick={handleLogout}>
            <LogOut size={17} />
            Sign out
          </button>
        </div>
      </aside>

      {open && <div className="mobile-overlay" onClick={onClose} />}
    </>
  );
}
