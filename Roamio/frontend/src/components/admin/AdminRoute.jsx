import { useQuery } from "@tanstack/react-query";
import { Loader2, RefreshCw, ShieldAlert } from "lucide-react";
import { Navigate } from "react-router-dom";

import { retryUnlessForbidden, trackingConfigQuery } from "../../api/admin.js";
import useTheme from "../recommendations/useTheme.js";
import "../../styles/Admin.css";

// The user object carries no role - the API decides who is an admin
// (ADMIN_USER_IDS). So ask it: a 403 sends the user back to the dashboard.
// A 401 never gets here, authedFetch already redirects to /login.
export default function AdminRoute({ children }) {
  const { theme } = useTheme();
  const { isPending, error, refetch, isFetching } = useQuery({
    ...trackingConfigQuery,
    retry: retryUnlessForbidden,
  });

  if (error?.status === 403) {
    return <Navigate to="/dashboard" replace />;
  }

  if (isPending || error) {
    return (
      <div className="admin-page admin-gate" data-theme={theme}>
        {isPending ? (
          <p className="admin-gate-message">
            <Loader2 size={18} className="admin-spin" /> Checking access…
          </p>
        ) : (
          // not a "no": a server hiccup shouldn't bounce a real admin away
          <div className="admin-gate-message" role="alert">
            <ShieldAlert size={18} />
            <span>Couldn't confirm admin access. {error.message}</span>
            <button type="button" className="admin-button" onClick={() => refetch()} disabled={isFetching}>
              <RefreshCw size={15} /> Retry
            </button>
          </div>
        )}
      </div>
    );
  }

  return children;
}
