import { ArrowLeft, Moon, Plane, Sun } from "lucide-react";
import { Link } from "react-router-dom";

import "../styles/PageTopBar.css";

// Same top band as the trip-planning PageShell header (Travel Groups etc.):
// back link on the left, brand + theme toggle on the right, and an optional
// `hero` headline block inside the same band.
export default function PageTopBar({ theme, onToggleTheme, backTo = "/dashboard", backLabel = "Back to dashboard", hero }) {
  const isDark = theme === "dark";
  return (
    <div className="page-topbar">
      <header className="page-topbar-inner">
        <Link to={backTo} className="page-topbar-back">
          <ArrowLeft size={17} /> {backLabel}
        </Link>
        <div className="page-topbar-right">
          <div className="page-topbar-brand">
            <span><Plane size={17} /></span> Roamio
          </div>
          <button
            type="button"
            className="page-topbar-toggle"
            onClick={onToggleTheme}
            aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
            title={isDark ? "Light mode" : "Dark mode"}
          >
            {isDark ? <Sun size={17} /> : <Moon size={17} />}
          </button>
        </div>
      </header>
      {hero && <div className="page-topbar-hero">{hero}</div>}
    </div>
  );
}
