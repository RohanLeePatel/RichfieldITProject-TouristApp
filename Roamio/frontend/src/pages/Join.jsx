import { useEffect, useState } from "react";
import { LoaderCircle, Users } from "lucide-react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";

import { joinGroup, previewGroupCode } from "../api/groups.js";
import PageShell from "../components/recommendations/PageShell.jsx";
import { useAuthStore } from "../store/authStore.js";
import { useTripStore } from "../store/tripStore.js";

// Where a shared invite link lands (/join/:code?trip=id). Unlike /invite/:token
// it isn't tied to one email, so anyone with the link can join - after
// signing in, since a group's name is only shown to signed-in users. Joining
// opens the trip the link was shared from.
export default function Join() {
  const { code } = useParams();
  const [params] = useSearchParams();
  const tripId = params.get("trip");
  const navigate = useNavigate();
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const [group, setGroup] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const destination = tripId ? `/trips/${tripId}` : "/family";

  useEffect(() => {
    if (!isAuthenticated) return;
    previewGroupCode(code)
      .then(setGroup)
      .catch((requestError) => setError(requestError instanceof Error ? requestError.message : "This invite link can't be opened."));
  }, [code, isAuthenticated]);

  const join = async () => {
    setBusy(true);
    setError("");
    try {
      await joinGroup(code);
      useTripStore.getState().load(true);
      navigate(destination);
    } catch (requestError) {
      // joined already (e.g. in another tab): same as opening a link you've accepted
      if (/already a member/i.test(requestError?.message || "")) {
        setGroup((current) => ({ ...current, alreadyMember: true }));
      } else {
        setError(requestError instanceof Error ? requestError.message : "Could not join this group.");
      }
      setBusy(false);
    }
  };

  const back = encodeURIComponent(`/join/${code}${tripId ? `?trip=${tripId}` : ""}`);

  return (
    <PageShell
      backTo={isAuthenticated ? "/dashboard" : "/"}
      backLabel={isAuthenticated ? "Back to dashboard" : "Roamio home"}
      hero={
        <>
          <p className="recommendations-eyebrow"><Users size={15} /> Trip invite</p>
          <h1>{group ? `Join ${group.name}` : "You've been invited to a trip"}</h1>
          <p>Plan it together on Roamio: the itinerary, budget and documents in one place.</p>
        </>
      }
    >
      <section className="recommendations-results trip-done">
        {!isAuthenticated ? (
          <>
            <p className="wizard-help">Log in or create a free account to see the trip and join the group.</p>
            <div className="wizard-actions">
              <Link to={`/login?next=${back}`} className="recommendations-submit">Log in to join</Link>
              <Link to={`/register?next=${back}`} className="secondary-button">Create an account</Link>
            </div>
          </>
        ) : (
          <>
            {!group && !error && (
              <p className="wizard-help"><LoaderCircle className="recommendations-spinner" size={16} /> Opening your invite...</p>
            )}
            {error && <p className="recommendations-error" role="alert">{error}</p>}
            {group && group.alreadyMember && (
              <div className="wizard-actions">
                <p className="wizard-help" role="status">You&apos;ve already accepted this invite - you&apos;re in {group.name}.</p>
                <Link to={destination} className="recommendations-submit">{tripId ? "Open the trip" : "Open your groups"}</Link>
              </div>
            )}
            {group && !group.alreadyMember && (
              <>
                <p className="wizard-help">
                  {group.memberCount} {group.memberCount === 1 ? "person is" : "people are"} in this group. You&apos;ll see its trips once you join.
                </p>
                <div className="wizard-actions">
                  <button type="button" className="recommendations-submit" onClick={join} disabled={busy}>
                    {busy ? "Joining..." : `Join ${group.name}`}
                  </button>
                </div>
              </>
            )}
          </>
        )}
      </section>
    </PageShell>
  );
}
