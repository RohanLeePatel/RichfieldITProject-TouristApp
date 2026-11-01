import { Compass, Home, Languages, MapPinned, Plane } from "lucide-react";
import { Link, useLocation } from "react-router-dom";

import PageShell from "../components/recommendations/PageShell.jsx";
import { useAuthStore } from "../store/authStore.js";
import "../styles/notFound.css";

// Any address the app doesn't know, instead of silently sending people home.
export default function NotFound() {
  const signedIn = useAuthStore((state) => state.isAuthenticated);
  const { pathname } = useLocation();
  const home = signedIn ? "/dashboard" : "/";

  return (
    <PageShell backTo={home} backLabel={signedIn ? "Back to dashboard" : "Back to home"}>
      <section className="not-found" aria-labelledby="not-found-title">
        <p className="not-found-code" aria-hidden="true">
          4<Compass className="not-found-compass" strokeWidth={1.6} />4
        </p>
        <h1 id="not-found-title">Looks like you&apos;ve wandered off the map.</h1>
        <p className="not-found-text">
          We couldn&apos;t find <code className="not-found-path">{pathname}</code>. The page may have moved, or the
          link may have a typo.
        </p>

        <div className="not-found-actions">
          <Link to={home} className="recommendations-submit">
            <Home size={16} /> {signedIn ? "Go to your dashboard" : "Go to the home page"}
          </Link>
          {signedIn ? (
            <Link to="/recommendations" className="secondary-button">
              <Plane size={16} /> Plan a trip
            </Link>
          ) : (
            <Link to="/login" className="secondary-button">Log in</Link>
          )}
        </div>

        {signedIn && (
          <nav className="not-found-links" aria-label="Places you might want">
            <Link to="/trips"><MapPinned size={15} /> My trips</Link>
            <Link to="/translator"><Languages size={15} /> Travel Translator</Link>
            <Link to="/chat"><Compass size={15} /> Trip assistant</Link>
          </nav>
        )}
      </section>
    </PageShell>
  );
}
