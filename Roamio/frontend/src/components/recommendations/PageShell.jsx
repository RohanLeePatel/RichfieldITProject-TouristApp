import { ArrowLeft, Plane } from "lucide-react";
import { Link } from "react-router-dom";

import ThemeToggle from "./ThemeToggle.jsx";
import useTheme from "./useTheme.js";
import "../../styles/recommendations.css";

// Shared frame for every trip-planning page (wizard, trips list, trip detail):
// themed root + hero band with back link, brand and theme toggle. `hero`
// is the big headline block rendered inside the band.
export default function PageShell({ backTo = "/dashboard", backLabel = "Back to dashboard", hero, children }) {
  const { theme, toggle } = useTheme();
  return (
    <main className="recommendations-page" data-theme={theme}>
      <div className="rx-hero">
        <header className="recommendations-header print-hide">
          <Link to={backTo} className="recommendations-back-link">
            <ArrowLeft size={17} /> {backLabel}
          </Link>
          <div className="rx-header-right">
            <div className="recommendations-brand">
              <span><Plane size={17} /></span> Roamio
            </div>
            <ThemeToggle theme={theme} onToggle={toggle} />
          </div>
        </header>
        {hero && <div className="rx-hero-body">{hero}</div>}
      </div>
      <div className="recommendations-content">{children}</div>
    </main>
  );
}
