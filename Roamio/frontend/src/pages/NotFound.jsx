import { Link } from "react-router-dom";

import PageShell from "../components/recommendations/PageShell.jsx";
import { useAuthStore } from "../store/authStore.js";

// Any address the app doesn't know, instead of silently sending people home.
export default function NotFound() {
  const signedIn = useAuthStore((state) => state.isAuthenticated);
  const home = signedIn ? "/dashboard" : "/";
  return (
    <PageShell backTo={home} backLabel={signedIn ? "Back to dashboard" : "Back to home"}>
      <div className="results-empty">
        <h3>We can&apos;t find that page.</h3>
        <p>The link may be out of date, or the address may have a typo.</p>
        <Link to={home} className="recommendations-submit">{signedIn ? "Go to your dashboard" : "Go to the home page"}</Link>
      </div>
    </PageShell>
  );
}
