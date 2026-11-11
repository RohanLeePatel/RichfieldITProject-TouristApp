import { useState } from "react";
import { BarChart3, Flag, HeartPulse, LayoutDashboard, MapPin, ShieldCheck, Users } from "lucide-react";

import PageTopBar from "../components/PageTopBar.jsx";
import useTheme from "../components/recommendations/useTheme.js";
import AnalyticsOverview from "../components/admin/AnalyticsOverview.jsx";
import AudienceReport from "../components/admin/AudienceReport.jsx";
import AuditLog from "../components/admin/AuditLog.jsx";
import DestinationsManager from "../components/admin/DestinationsManager.jsx";
import OverviewInsights from "../components/admin/OverviewInsights.jsx";
import PlaceReports from "../components/admin/PlaceReports.jsx";
import SafetyReport from "../components/admin/SafetyReport.jsx";
import ServiceHealthCard from "../components/admin/ServiceHealthCard.jsx";
import SpendingReport from "../components/admin/SpendingReport.jsx";
import TrackingConfigCard from "../components/admin/TrackingConfigCard.jsx";
import UserProfilesList from "../components/admin/UserProfilesList.jsx";
import "../styles/Admin.css";

// Admins only (AdminRoute). Each section fetches on its own, so one failing
// source - e.g. GA not configured - leaves the others working. "Content" is the
// destination catalogue.
const TABS = [
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "analytics", label: "Visitors", icon: BarChart3 },
  { id: "health", label: "Service health", icon: HeartPulse },
  { id: "destinations", label: "Content", icon: MapPin },
  { id: "reports", label: "Reports", icon: Flag },
  { id: "users", label: "Users", icon: Users },
];

export default function AdminDashboard() {
  const { theme, toggle: toggleTheme } = useTheme();
  const [tab, setTab] = useState("overview");

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
            <p>What travellers do in the app, visitor numbers from Google Analytics, the services it runs on, the destinations it can recommend and the people who use it.</p>
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
          {tab === "overview" && <OverviewInsights />}
          {tab === "analytics" && <AnalyticsOverview />}
          {tab === "audience" && <AudienceReport />}
          {tab === "spending" && <SpendingReport />}
          {tab === "safety" && <SafetyReport />}
          {tab === "audit" && <AuditLog />}
          {tab === "health" && (
            <div className="admin-grid">
              <ServiceHealthCard />
              <TrackingConfigCard />
            </div>
          )}
          {tab === "destinations" && <DestinationsManager />}
          {tab === "reports" && <PlaceReports onOpenContent={() => setTab("destinations")} />}
          {tab === "users" && <UserProfilesList />}
        </div>
      </main>
    </div>
  );
}
