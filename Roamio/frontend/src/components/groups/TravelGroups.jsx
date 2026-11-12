import { useEffect, useState } from "react";
import { Copy, LoaderCircle, Plane, Plus, UserPlus, Users } from "lucide-react";
import { Link } from "react-router-dom";

import { createGroup, createInvite, fetchMyGroups, inviteLink, joinGroup } from "../../api/groups.js";
import { useAuthStore } from "../../store/authStore.js";
import { useTripStore } from "../../store/tripStore.js";
import { emailError, labelError, MAX_EMAIL } from "../../utils/validation.js";

const MANAGERS = ["OWNER", "ADMIN"];

// Real travel groups (accounts on the server): who's in them, their trips,
// and invites. Trips planned "for" a group in the wizard land here and every
// member can open them. Companions without an account are saved on the group as
// well, and the Family page manages them.
// onGroups(list) runs after every load, so the page's companion list follows
// groups created or joined here
// tripId (optional) narrows the list to the group(s) that own that trip
export default function TravelGroups({ onGroups, tripId }) {
  const userId = useAuthStore((state) => state.user?.id);
  const [groups, setGroups] = useState(null);
  const [error, setError] = useState("");
  const [newName, setNewName] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);

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

  const run = async (action) => {
    setBusy(true);
    setError("");
    try {
      await action();
      await load();
      // a joined group's trips now show in the trip switcher
      useTripStore.getState().load(true);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  };

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
        <p className="family-groups-note">You&apos;re not in a travel group yet. Create one, or join with a code from a friend.</p>
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

      <div className="family-groups-actions">
        <form
          onSubmit={(event) => {
            event.preventDefault();
            const problem = labelError(newName, "the group name");
            if (problem) return setError(problem);
            run(() => createGroup(newName.trim()).then(() => setNewName("")));
          }}
        >
          <input value={newName} onChange={(event) => { setNewName(event.target.value); setError(""); }} placeholder="New group name" aria-label="New group name" maxLength={60} />
          <button type="submit" className="family-button family-button-primary" disabled={busy || !newName.trim()}>
            <Plus size={15} /> Create group
          </button>
        </form>

        <form
          onSubmit={(event) => {
            event.preventDefault();
            if (!/^[A-Za-z0-9]{4,16}$/.test(code.trim())) {
              return setError("Join codes are 4-16 letters and numbers, like 9F2A1B8C - no spaces or symbols.");
            }
            run(() => joinGroup(code.trim()).then(() => setCode("")));
          }}
        >
          <input value={code} onChange={(event) => { setCode(event.target.value); setError(""); }} placeholder="Join code, e.g. 9F2A1B8C" aria-label="Group join code" maxLength={16} />
          <button type="submit" className="family-button family-button-secondary" disabled={busy || !code.trim()}>
            Join
          </button>
        </form>
      </div>

      {/* under the Create and Join fields, where the person who caused it is looking */}
      {error && <p className="family-groups-error" role="alert">{error}</p>}
    </section>
  );
}

function GroupCard({ group, canManage }) {
  const [email, setEmail] = useState("");
  const [link, setLink] = useState("");
  const [copied, setCopied] = useState(false);
  const [inviteError, setInviteError] = useState("");

  const invite = async (event) => {
    event.preventDefault();
    setInviteError("");
    setLink("");
    const problem = emailError(email);
    if (problem) return setInviteError(problem.replace("your email address", "their email address"));
    try {
      const token = await createInvite(group.id, email.trim());
      setLink(`${window.location.origin}/invite/${token}`);
      setEmail("");
    } catch (requestError) {
      setInviteError(requestError instanceof Error ? requestError.message : "Could not create the invite.");
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
          <form className="family-group-invite" onSubmit={invite} noValidate>
            <input type="email" value={email} onChange={(event) => { setEmail(event.target.value); setInviteError(""); }} placeholder="Their email" aria-label="Email to invite" maxLength={MAX_EMAIL} required />
            <button type="submit" className="family-button family-button-secondary">
              <UserPlus size={15} /> Invite
            </button>
          </form>
          {inviteError && <p className="family-groups-error">{inviteError}</p>}
          {link && (
            <p className="family-groups-note">
              Invites aren&apos;t emailed yet - send them this link (valid 7 days):{" "}
              <code>{link}</code>{" "}
              <button type="button" className="family-text-button" onClick={copy}>
                <Copy size={13} /> {copied ? "Copied" : "Copy"}
              </button>
            </p>
          )}
        </>
      )}
    </article>
  );
}
