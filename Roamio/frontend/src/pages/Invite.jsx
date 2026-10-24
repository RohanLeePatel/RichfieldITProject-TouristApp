import { useEffect, useState } from "react";
import { LoaderCircle, Users } from "lucide-react";
import { Link, useNavigate, useParams } from "react-router-dom";

import { acceptInvite, previewInvite } from "../api/groups.js";
import PageShell from "../components/recommendations/PageShell.jsx";
import { useAuthStore } from "../store/authStore.js";
import { useTripStore } from "../store/tripStore.js";

// Where an invite link lands (/invite/:token). Anyone can see what they're
// joining; joining needs an account with the invited email, and signing in
// or up from here comes straight back.
export default function Invite() {
  const { token } = useParams();
  const navigate = useNavigate();
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const [invite, setInvite] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    previewInvite(token)
      .then(setInvite)
      .catch((requestError) => setError(requestError instanceof Error ? requestError.message : "This invite can't be opened."));
  }, [token]);

  const join = async () => {
    setBusy(true);
    setError("");
    try {
      await acceptInvite(token);
      useTripStore.getState().load(true);
      navigate("/family");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Could not join this group.");
      setBusy(false);
    }
  };

  const back = encodeURIComponent(`/invite/${token}`);

  return (
    <PageShell
      backTo={isAuthenticated ? "/dashboard" : "/"}
      backLabel={isAuthenticated ? "Back to dashboard" : "Roamio home"}
      hero={
        <>
          <p className="recommendations-eyebrow"><Users size={15} /> Group invite</p>
          <h1>{invite ? `Join ${invite.groupName}` : "You've been invited"}</h1>
          {invite && <p>{invite.inviterName} invited you to plan trips together on Roamio.</p>}
        </>
      }
    >
      <section className="recommendations-results trip-done">
        {!invite && !error && (
          <p className="wizard-help"><LoaderCircle className="recommendations-spinner" size={16} /> Opening your invite...</p>
        )}
        {error && <p className="recommendations-error" role="alert">{error}</p>}
        {invite && (
          <>
            <p className="wizard-help">
              You&apos;ll join as a {invite.role.toLowerCase()}. The invite is valid until{" "}
              {new Date(invite.expiresAt).toLocaleDateString("en-GB", { day: "numeric", month: "long" })}.
            </p>
            <div className="wizard-actions">
              {isAuthenticated ? (
                <button type="button" className="recommendations-submit" onClick={join} disabled={busy}>
                  {busy ? "Joining..." : `Join ${invite.groupName}`}
                </button>
              ) : (
                <>
                  <Link to={`/login?next=${back}`} className="recommendations-submit">Log in to join</Link>
                  <Link to={`/register?next=${back}`} className="secondary-button">Create an account</Link>
                </>
              )}
            </div>
          </>
        )}
      </section>
    </PageShell>
  );
}
