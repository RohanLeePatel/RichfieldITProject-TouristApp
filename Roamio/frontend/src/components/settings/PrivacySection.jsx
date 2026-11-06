import { ArrowRight, Download, FileText, Lock, ShieldOff, Trash2, TriangleAlert } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";

import { fetchMe } from "../../api/account.js";
import {
  deleteAccount,
  downloadMyData,
  getNotificationPrefs,
  listTravellers,
} from "../../api/settings.js";
import { useAuthStore } from "../../store/authStore.js";
import { LEGAL_LAST_UPDATED, PRIVACY_POLICY } from "./settingsContent.js";
import { CardHead, Field, LegalDocument, Modal, Notice, SettingsSection, Spinner } from "./SettingsUI.jsx";
import { formatDate } from "./settingsUtils.js";

const CONFIRM_WORD = "DELETE";

function DeleteAccountModal({ open, email, onClose, onDeleted }) {
  const [typed, setTyped] = useState("");
  const [password, setPassword] = useState("");
  const [understood, setUnderstood] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const close = () => {
    if (busy) return;
    setTyped("");
    setPassword("");
    setUnderstood(false);
    setError("");
    onClose();
  };

  const ready = typed.trim() === CONFIRM_WORD && Boolean(password) && understood;

  const confirm = async (event) => {
    event.preventDefault();
    if (!ready) return;
    setBusy(true);
    setError("");
    try {
      await deleteAccount(email, password);
      onDeleted();
    } catch (requestError) {
      setError(requestError.message);
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      title="Delete your Roamio account?"
      description="This permanently deletes your account. It can't be undone."
      onClose={close}
      size="md"
      tone="danger"
    >
      <form onSubmit={confirm} className="st-form">
        <div className="st-danger-summary">
          <h3>What will be deleted</h3>
          <ul>
            <li>Your profile, photo and preferences</li>
            <li>Saved travellers and their details</li>
            <li>Trips you own, including itineraries and expenses</li>
            <li>Your notification settings and sign-in history</li>
          </ul>
          <p>
            You'll be removed from trips other people own. Records we must keep by law, such as
            payments, are kept only as long as required.
          </p>
        </div>

        <p className="st-form-help">
          Want a copy first? Close this and choose <strong>Download my data</strong>.
        </p>

        <Field label={`Type ${CONFIRM_WORD} to confirm`}>
          <div className="st-input">
            <input
              value={typed}
              onChange={(event) => setTyped(event.target.value.toUpperCase())}
              autoComplete="off"
              spellCheck={false}
              placeholder={CONFIRM_WORD}
              aria-label={`Type ${CONFIRM_WORD} to confirm`}
            />
          </div>
        </Field>

        <Field label="Your password" hint="So only you can delete your account.">
          <div className="st-input">
            <Lock size={17} aria-hidden="true" />
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="current-password"
              aria-label="Your password"
            />
          </div>
        </Field>

        <label className="st-check">
          <input type="checkbox" checked={understood} onChange={(event) => setUnderstood(event.target.checked)} />
          <span>I understand my account and data will be permanently deleted.</span>
        </label>

        {error && <Notice tone="error">{error}</Notice>}

        <div className="st-modal-foot st-modal-foot--inline">
          <button type="button" className="st-btn st-btn--secondary" onClick={close} disabled={busy}>
            Keep my account
          </button>
          <button type="submit" className="st-btn st-btn--danger" disabled={!ready || busy}>
            {busy ? <Spinner /> : <Trash2 size={15} />}
            Delete account permanently
          </button>
        </div>
      </form>
    </Modal>
  );
}

export default function PrivacySection({ notify }) {
  const navigate = useNavigate();
  const storedUser = useAuthStore((state) => state.user) || {};
  const logout = useAuthStore((state) => state.logout);
  const email = storedUser.email || "";

  const [policyOpen, setPolicyOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [exporting, setExporting] = useState(false);

  // Builds the export file in the browser. Each part is fetched on its own, and a part
  // that fails is left empty rather than failing the whole download. The profile
  // photo and name also come from this browser's stored copy, so they are included
  // even when the server can't be reached.
  const buildExport = async () => {
    const account = await fetchMe().catch(() => null);

    const [notifications, travellers] = await Promise.all([
      getNotificationPrefs(email).then((result) => result.data).catch(() => null),
      listTravellers(email).then((result) => result.data).catch(() => []),
    ]);

    return {
      exportedAt: new Date().toISOString(),
      format: "Roamio personal data export (v1)",
      account: account || { fullName: storedUser.name || storedUser.fullName, email },
      profileOnThisDevice: {
        name: storedUser.name || storedUser.fullName || "",
        email,
        photo: storedUser.photo || null,
      },
      notificationPreferences: notifications,
      savedTravellers: travellers,
    };
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      await downloadMyData(buildExport);
      notify("Your data has been downloaded. Keep the file somewhere safe.");
    } catch (error) {
      notify(error.message, "error");
    } finally {
      setExporting(false);
    }
  };

  // The account is gone on the server, so clear this browser's session too. logout()
  // also turns off push here and drops the refresh cookie.
  const handleDeleted = () => {
    setDeleteOpen(false);
    try {
      if (typeof logout === "function") logout();
      else useAuthStore.setState?.({ user: null, token: null });
    } catch {
      // already signed out
    }
    navigate("/", { replace: true, state: { accountDeleted: true } });
  };

  return (
    <SettingsSection
      id="privacy"
      icon={Lock}
      title="Privacy & data"
      description="See how we use your information, take a copy of it, or close your account."
    >
      <div className="st-card st-card--stack">
        <div className="st-action-row">
          <CardHead
            icon={FileText}
            title="Privacy policy"
            description={`What we collect, why, and your rights under POPIA. Updated ${formatDate(LEGAL_LAST_UPDATED)}.`}
          />
          <button type="button" className="st-btn st-btn--secondary" onClick={() => setPolicyOpen(true)}>
            Read policy
            <ArrowRight size={15} />
          </button>
        </div>

        <div className="st-action-row">
          <CardHead
            icon={Download}
            title="Download your data"
            description="A file with your profile, preferences, notification settings and saved travellers."
          />
          <button type="button" className="st-btn st-btn--secondary" onClick={handleExport} disabled={exporting}>
            {exporting ? <Spinner /> : <Download size={15} />}
            {exporting ? "Preparing…" : "Download my data"}
          </button>
        </div>
      </div>

      <div className="st-card st-card--danger">
        <div className="st-action-row">
          <CardHead
            icon={ShieldOff}
            title="Delete account"
            description="Permanently delete your account and everything in it. This can't be undone."
          />
          <button type="button" className="st-btn st-btn--danger-soft" onClick={() => setDeleteOpen(true)}>
            <TriangleAlert size={15} />
            Delete account
          </button>
        </div>
      </div>

      <Modal
        open={policyOpen}
        title="Privacy policy"
        onClose={() => setPolicyOpen(false)}
        size="lg"
        footer={
          <button type="button" className="st-btn st-btn--primary" onClick={() => setPolicyOpen(false)}>
            Done
          </button>
        }
      >
        <LegalDocument sections={PRIVACY_POLICY} updated={formatDate(LEGAL_LAST_UPDATED)} />
      </Modal>

      <DeleteAccountModal
        open={deleteOpen}
        email={email}
        onClose={() => setDeleteOpen(false)}
        onDeleted={handleDeleted}
      />
    </SettingsSection>
  );
}
