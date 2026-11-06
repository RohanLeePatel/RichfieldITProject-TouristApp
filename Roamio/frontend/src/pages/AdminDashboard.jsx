import { useState } from "react";
import { BarChart3, HeartPulse, MapPin, ShieldCheck, Users } from "lucide-react";

import PageTopBar from "../components/PageTopBar.jsx";
import useTheme from "../components/recommendations/useTheme.js";
import AnalyticsOverview from "../components/admin/AnalyticsOverview.jsx";
import DestinationsManager from "../components/admin/DestinationsManager.jsx";
import ServiceHealthCard from "../components/admin/ServiceHealthCard.jsx";
import TrackingConfigCard from "../components/admin/TrackingConfigCard.jsx";
import UserProfilesList from "../components/admin/UserProfilesList.jsx";
import "../styles/Admin.css";

// Admins only (AdminRoute). Each section fetches on its own, so one failing
// source - e.g. GA not configured - leaves the others working.
const TABS = [
  { id: "analytics", label: "Analytics", icon: BarChart3 },
  { id: "health", label: "Service health", icon: HeartPulse },
  { id: "destinations", label: "Destinations", icon: MapPin },
  { id: "users", label: "Users", icon: Users },
];

export default function AdminDashboard() {
  const { theme, toggle: toggleTheme } = useTheme();
  const [tab, setTab] = useState("analytics");

  return (
    <div className="admin-page" data-theme={theme}>
      <PageTopBar
        theme={theme}
        onToggleTheme={toggleTheme}
        hero={
          <>
            <p className="page-topbar-eyebrow">
              <ShieldCheck size={15} />
              Admin
            </p>
            <h1>
              Roamio at a
              <span> glance.</span>
            </h1>
            <p>Visitor numbers from Google Analytics, the live status of the services the app runs on, and the destinations it can recommend.</p>
          </>
        }
      />

      <main className="admin-content">
        <div className="admin-tabs" role="tablist" aria-label="Admin sections">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              role="tab"
              id={`admin-tab-${id}`}
              aria-selected={tab === id}
              aria-controls={`admin-panel-${id}`}
              className={`admin-tab${tab === id ? " active" : ""}`}
              onClick={() => setTab(id)}
            >
              <Icon size={16} />
              {label}
            </button>
          ))}
        </div>

        <div
          className="admin-tabpanel"
          role="tabpanel"
          id={`admin-panel-${tab}`}
          aria-labelledby={`admin-tab-${tab}`}
        >
          {tab === "analytics" && <AnalyticsOverview />}
          {tab === "health" && (
            <div className="admin-grid">
              <ServiceHealthCard />
              <TrackingConfigCard />
            </div>
          )}
          {tab === "destinations" && <DestinationsManager />}
          {tab === "users" && <UserProfilesList />}
        </div>
      </main>
    </div>
  );
}
