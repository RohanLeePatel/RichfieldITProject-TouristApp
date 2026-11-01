import { ShieldCheck } from "lucide-react";

import PageTopBar from "../components/PageTopBar.jsx";
import useTheme from "../components/recommendations/useTheme.js";
import AnalyticsOverview from "../components/admin/AnalyticsOverview.jsx";
import ServiceHealthCard from "../components/admin/ServiceHealthCard.jsx";
import TrackingConfigCard from "../components/admin/TrackingConfigCard.jsx";
import UserProfilesList from "../components/admin/UserProfilesList.jsx";
import "../styles/Admin.css";

// Admins only (AdminRoute). Each section fetches on its own, so one failing
// source - e.g. GA not configured - leaves the others working.
export default function AdminDashboard() {
  const { theme, toggle: toggleTheme } = useTheme();

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
            <p>Visitor numbers from Google Analytics and the live status of the services the app runs on.</p>
          </>
        }
      />

      <main className="admin-content">
        <AnalyticsOverview />

        <div className="admin-grid">
          <ServiceHealthCard />
          <TrackingConfigCard />
        </div>

        <UserProfilesList />
      </main>
    </div>
  );
}
