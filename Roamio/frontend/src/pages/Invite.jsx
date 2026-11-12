import { useEffect, useState } from "react";
import { LoaderCircle, Users } from "lucide-react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";

import { acceptInvite, emailInvitePath, previewInvite } from "../api/groups.js";
import PageShell from "../components/recommendations/PageShell.jsx";
import { useAuthStore } from "../store/authStore.js";
import { useTripStore } from "../store/tripStore.js";

// What each state the API reports means for the visitor. The server's own
// message is the fallback for anything else.
const PROBLEMS = {
  INVALID: { title: "This invite link isn't valid", text: "Check you copied the whole link, or ask the trip owner to send a new invite." },
  EXPIRED: { title: "This invite has expired", text: "Invites last 7 days. Ask the trip owner to send you a new one." },
  USED: { title: "This invite has already been used", text: "Each invite link works once. Ask the trip owner to send you a new invite." },
  WRONG_ACCOUNT: { title: "This invite is for a different account", text: "Sign in with the email address it was sent to, or ask the trip owner to invite this account." },
};

const openPath = ({ tripId, groupId } = {}) => (tripId ? `/trips/${encodeURIComponent(tripId)}` : groupId ? `/family?group=${encodeURIComponent(groupId)}` : "/family");

// Where an invite link lands (/invite/:token). Anyone can see what they're
// joining; joining needs an account with the invited email, and signing in
// or up from here comes straight back.
export default function Invite() {
  const { token } = useParams();
  const [searchParams] = useSearchParams();
  const tripId = searchParams.get("trip") || undefined;
  const navigate = useNavigate();
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const [invite, setInvite] = useState(null);
  const [problem, setProblem] = useState(null); // { code, message, tripId?, groupId? }
  const [busy, setBusy] = useState(false);

  const toProblem = (requestError, fallback) => ({
    code: requestError?.data?.code,
    message: requestError instanceof Error ? requestError.message : fallback,
    tripId: requestError?.data?.tripId,
    groupId: requestError?.data?.groupId,
  });

  useEffect(() => {
    previewInvite(token, isAuthenticated, tripId)
      .then(setInvite)
      .catch((requestError) => setProblem(toProblem(requestError, "This invite can't be opened.")));
  }, [token, isAuthenticated, tripId]);

  const join = async () => {
    setBusy(true);
    setProblem(null);
    try {
      const joined = await acceptInvite(token, tripId);
      useTripStore.getState().load(true);
      navigate(openPath(joined));
    } catch (requestError) {
      setProblem(toProblem(requestError, "Could not join this group."));
      setBusy(false);
    }
  };

  const back = encodeURIComponent(emailInvitePath(token, tripId));
  const known = PROBLEMS[problem?.code];
  const accepted = problem?.code === "ALREADY_ACCEPTED";

  return (
    <PageShell
      backTo={isAuthenticated ? "/dashboard" : "/"}
      backLabel={isAuthenticated ? "Back to dashboard" : "Roamio home"}
      hero={
        <>
          <p className="recommendations-eyebrow"><Users size={15} /> Group invite</p>
          <h1>{invite ? `Join ${invite.groupName}` : accepted ? "You're already in" : "You've been invited"}</h1>
          {invite && <p>{invite.inviterName} invited you to plan trips together on Roamio.</p>}
        </>
      }
    >
      <section className="recommendations-results trip-done">
        {!invite && !problem && (
          <p className="wizard-help"><LoaderCircle className="recommendations-spinner" size={16} /> Opening your invite...</p>
        )}

        {accepted && (
          <>
            <p className="wizard-help" role="status">You&apos;ve already accepted this invite.</p>
            <div className="wizard-actions">
              <Link to={openPath(problem)} className="recommendations-submit">{problem.tripId ? "Open the trip" : "Open your group"}</Link>
            </div>
          </>
        )}

        {problem && !accepted && (
          <div role="alert">
            <h2>{known?.title || "This invite can't be used"}</h2>
            <p className="wizard-help">{known?.text || problem.message}</p>
            {!isAuthenticated && problem.code === "USED" && (
              <p className="wizard-help">
                Already accepted it? <Link to={`/login?next=${back}`}>Log in</Link> to open the trip.
              </p>
            )}
          </div>
        )}

        {invite && !problem && (
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
