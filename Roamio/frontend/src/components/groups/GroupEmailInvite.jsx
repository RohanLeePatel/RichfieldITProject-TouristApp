import { useState } from "react";
import { Copy, UserPlus } from "lucide-react";

import { createInvite, emailInvitePath } from "../../api/groups.js";
import { emailError, MAX_EMAIL } from "../../utils/validation.js";
import "../../styles/Family.css";

export default function GroupEmailInvite({ groupId, tripId }) {
  const [email, setEmail] = useState("");
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  const invite = async (event) => {
    event.preventDefault();
    setError("");
    setResult(null);
    setCopied(false);
    const problem = emailError(email);
    if (problem) return setError(problem.replace("your email address", "their email address"));

    setBusy(true);
    try {
      const { token, emailed } = await createInvite(groupId, email.trim(), tripId);
      setResult({ link: `${window.location.origin}${emailInvitePath(token, tripId)}`, emailed });
      setEmail("");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Could not create the invite.");
    } finally {
      setBusy(false);
    }
  };

  const copy = () => {
    navigator.clipboard?.writeText(result.link).then(() => setCopied(true)).catch(() => {});
  };

  return (
    <>
      <form className="family-group-invite" onSubmit={invite} noValidate>
        <input
          type="email"
          value={email}
          onChange={(event) => { setEmail(event.target.value); setError(""); }}
          placeholder="Their email"
          aria-label="Email to invite"
          maxLength={MAX_EMAIL}
          disabled={busy}
          required
        />
        <button type="submit" className={`family-button family-button-${tripId ? "primary" : "secondary"}`} disabled={busy}>
          <UserPlus size={15} /> {busy ? "Sending..." : tripId ? "Send invitation" : "Invite"}
        </button>
      </form>
      {error && <p className="family-groups-error" role="alert">{error}</p>}
      {result && (
        <p className="family-groups-note" role="status">
          {result.emailed ? "Invite emailed. You can also share this link (valid 7 days):" : "Email delivery failed. Share this link instead (valid 7 days):"}{" "}
          <code>{result.link}</code>{" "}
          <button type="button" className="family-text-button" onClick={copy}>
            <Copy size={13} /> {copied ? "Copied" : "Copy"}
          </button>
        </p>
      )}
    </>
  );
}
