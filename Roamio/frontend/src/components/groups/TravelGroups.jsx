import { useEffect, useState } from "react";
import { Copy, LoaderCircle, Plane, UserPlus, Users } from "lucide-react";
import { Link } from "react-router-dom";

import { createInvite, fetchMyGroups, inviteLink } from "../../api/groups.js";
import { useAuthStore } from "../../store/authStore.js";
import { emailError, MAX_EMAIL } from "../../utils/validation.js";

const MANAGERS = ["OWNER", "ADMIN"];

// Real travel groups (accounts on the server): who's in them, their trips,
// and invites. Trips planned "for" a group in the wizard land here and every
// member can open them. Companions without an account are saved on the group as
// well, and the Family page manages them.
// onGroups(list) gives the Family page the loaded groups for its companion list.
// tripId (optional) narrows the list to the group(s) that own that trip
export default function TravelGroups({ onGroups, tripId }) {
  const userId = useAuthStore((state) => state.user?.id);
  const [groups, setGroups] = useState(null);
  const [error, setError] = useState("");

  const load = () =>
    fetchMyGroups()
      .then((list) => {
        setGroups(list);
        onGroups?.(list);
      })
      .catch((requestError) => {
        setGroups([]);
        setError(requestError instanceof Error ? requestError.message : "Could not load your groups.");
      });

  useEffect(() => {
    load();
  }, []);

  const shown = tripId == null ? groups || [] : (groups || []).filter((group) => group.trips.some((trip) => trip.id === tripId));

  return (
    <section className="family-groups-section">
      <div className="family-section-heading-row">
        <div>
          <span className="family-section-eyebrow">
            <Users size={14} /> Travel groups
          </span>
          <h2>Plan together</h2>
          <p>People with a Roamio account who share your group trips.</p>
        </div>
      </div>

      {groups === null ? (
        <p className="family-groups-note"><LoaderCircle size={15} className="recommendations-spinner" /> Loading your groups...</p>
      ) : groups.length === 0 ? (
        <p className="family-groups-note">You&apos;re not in a travel group yet.</p>
      ) : shown.length === 0 ? (
        <p className="family-groups-note">This trip isn&apos;t planned with a travel group.</p>
      ) : (
        <div className="family-groups-grid">
          {shown.map((group) => (
            <GroupCard
              key={group.id}
              group={group}
              canManage={MANAGERS.includes(group.members.find((m) => m.userId === userId)?.role)}
            />
          ))}
        </div>
      )}

      {error && <p className="family-groups-error" role="alert">{error}</p>}
    </section>
  );
}

function GroupCard({ group, canManage }) {
  const [inviteOpen, setInviteOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [link, setLink] = useState("");
  const [copied, setCopied] = useState(false);
  const [emailed, setEmailed] = useState(false);
  const [inviteError, setInviteError] = useState("");

  const invite = async (event) => {
    event.preventDefault();
    if (sending) return;
    setInviteError("");
    setLink("");
    setCopied(false);
    const problem = emailError(email);
    if (problem) return setInviteError(problem.replace("your email address", "their email address"));
    setSending(true);
    try {
      const { token, emailed } = await createInvite(group.id, email.trim());
      setLink(`${window.location.origin}/invite/${token}`);
      setEmailed(emailed);
      setEmail("");
    } catch (requestError) {
      setInviteError(requestError instanceof Error ? requestError.message : "Could not create the invite.");
    } finally {
      setSending(false);
    }
  };

  const copy = () => {
    navigator.clipboard?.writeText(link).then(() => setCopied(true)).catch(() => {});
  };

  // anyone with this link can join (no email needed), unlike the invite below
  const [joinCopied, setJoinCopied] = useState(false);
  const copyJoinLink = () => {
    navigator.clipboard?.writeText(inviteLink(group.inviteCode)).then(() => setJoinCopied(true)).catch(() => {});
  };

  return (
    <article className="family-group-card">
      <h3>{group.name}</h3>

      <ul className="family-group-members">
        {group.members.map((member) => (
          <li key={member.id}>
            <strong>{member.user?.fullName || "Member"}</strong>
            <span>{member.role.toLowerCase()}</span>
          </li>
        ))}
      </ul>

      {group.trips.length > 0 && (
        <ul className="family-group-trips">
          {group.trips.map((trip) => (
            <li key={trip.id}>
              <Link to={`/trips/${trip.id}`}><Plane size={13} /> {trip.title}</Link>
            </li>
          ))}
        </ul>
      )}

      {canManage && (
        <>
          <p className="family-groups-note">
            Join code: <strong>{group.inviteCode}</strong>{" "}
            <button type="button" className="family-text-button" onClick={copyJoinLink}>
              <Copy size={13} /> {joinCopied ? "Link copied" : "Copy invite link"}
            </button>
          </p>
          <div>
            <button
              type="button"
              className="family-button family-button-secondary"
              aria-expanded={inviteOpen}
              onClick={() => setInviteOpen(!inviteOpen)}
            >
              <UserPlus size={15} /> Invite
            </button>
          </div>
          {inviteOpen && (
            <>
              <p className="family-groups-note">Enter the email address of a verified Roamio account.</p>
              <form className="family-group-invite" onSubmit={invite} noValidate>
                <input
                  type="email"
                  value={email}
                  onChange={(event) => { setEmail(event.target.value); setInviteError(""); }}
                  placeholder="Their email"
                  aria-label="Email to invite"
                  maxLength={MAX_EMAIL}
                  disabled={sending}
                  required
                />
                <button type="submit" className="family-button family-button-primary" disabled={sending}>
                  {sending ? "Sending…" : "Send invitation"}
                </button>
              </form>
              {inviteError && <p className="family-groups-error" role="alert">{inviteError}</p>}
              {link && (
                <div className="family-groups-note">
                  <span role="status">
                    {emailed ? "Invitation emailed. You can also share this link (valid for 7 days)." : "Email delivery failed. You can share this link (valid for 7 days)."}
                  </span>{" "}
                  <code>{link}</code>{" "}
                  <button type="button" className="family-text-button" onClick={copy}>
                    <Copy size={13} /> {copied ? "Copied" : "Copy"}
                  </button>
                </div>
              )}
            </>
          )}
        </>
      )}
    </article>
  );
}
