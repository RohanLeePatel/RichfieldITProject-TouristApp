import {
  ArrowRight,
  CheckCircle2,
  History,
  KeyRound,
  LogOut,
  Mail,
  Monitor,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  Smartphone,
  Tablet,
  XCircle,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { resetPassword, sendPasswordCode } from "../../api/account.js";
import {
  listLoginActivity,
  listSessions,
  revokeOtherSessions,
  revokeSession,
} from "../../api/settings.js";
import { passwordError } from "../../utils/validation.js";
import { CardHead, Field, Modal, Notice, PasswordInput, SettingsSection, Spinner } from "./SettingsUI.jsx";
import {
  describeDevice,
  deviceLabel,
  formatDateTime,
  passwordStrength,
  timeAgo,
} from "./settingsUtils.js";

const DEVICE_ICONS = { mobile: Smartphone, tablet: Tablet, desktop: Monitor };
const ACTIVITY_PREVIEW = 4;

/* ======================= password ======================= */

function PasswordCard({ email, notify }) {
  const [open, setOpen] = useState(false);
  const [resetCode, setResetCode] = useState("");
  const [codeSent, setCodeSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");

  const strength = passwordStrength(newPassword);
  const mismatch = confirmPassword.length > 0 && confirmPassword !== newPassword;

  const reset = () => {
    setError("");
    setResetCode("");
    setCodeSent(false);
    setNewPassword("");
    setConfirmPassword("");
  };

  const close = () => {
    setOpen(false);
    reset();
  };

  const handleSendCode = async () => {
    setError("");
    setBusy(true);
    try {
      await sendPasswordCode(email);
      setCodeSent(true);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "We couldn't send a code.");
    } finally {
      setBusy(false);
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");

    if (!/^\d{6}$/.test(resetCode.trim())) {
      setError("Enter the 6-digit code from your email.");
      return;
    }
    const passwordProblem = passwordError(newPassword, "new password");
    if (passwordProblem) {
      setError(passwordProblem);
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("The new passwords do not match.");
      return;
    }

    setBusy(true);
    try {
      await resetPassword({ email, otp: resetCode.trim(), newPassword });
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "We couldn't change your password.");
      setBusy(false);
      return;
    }
    setBusy(false);

    close();
    notify("Your password has been changed.");
  };

  if (!open) {
    return (
      <div className="st-card st-card--row">
        <CardHead
          icon={KeyRound}
          title="Password"
          description="Use a strong password you don't use anywhere else."
        />
        <button type="button" className="st-btn st-btn--secondary" onClick={() => setOpen(true)}>
          Change password
          <ArrowRight size={15} />
        </button>
      </div>
    );
  }

  return (
    <form className="st-card" onSubmit={handleSubmit} noValidate>
      <CardHead
        icon={KeyRound}
        title="Change your password"
        description={`We'll email a 6-digit code to ${email || "your account email"} to confirm it's you.`}
      />

      <ol className="st-steps">
        <li className={codeSent ? "is-done" : "is-current"}>
          <span className="st-step-marker">{codeSent ? <CheckCircle2 size={16} /> : "1"}</span>
          <div className="st-step-body">
            <h4>Get a code</h4>
            {codeSent ? (
              <p>
                Code sent. It can take a minute to arrive.{" "}
                <button type="button" className="st-text-button" onClick={handleSendCode} disabled={busy}>
                  Send a new code
                </button>
              </p>
            ) : (
              <>
                <p>We'll send it to your sign-in email.</p>
                <button
                  type="button"
                  className="st-btn st-btn--secondary st-btn--sm"
                  onClick={handleSendCode}
                  disabled={busy}
                >
                  {busy ? <Spinner size={15} /> : <Mail size={15} />}
                  Email me a code
                </button>
              </>
            )}
          </div>
        </li>

        <li className={codeSent ? "is-current" : "is-locked"}>
          <span className="st-step-marker">2</span>
          <div className="st-step-body">
            <h4>Choose a new password</h4>

            <fieldset className="st-step-fields" disabled={!codeSent}>
              <Field label="Code from your email">
                <div className="st-input st-input--code">
                  <Mail size={17} aria-hidden="true" />
                  <input
                    type="text"
                    inputMode="numeric"
                    value={resetCode}
                    placeholder="000000"
                    autoComplete="one-time-code"
                    maxLength={6}
                    onChange={(event) => setResetCode(event.target.value.replace(/\D/g, ""))}
                  />
                </div>
              </Field>

              <div className="st-grid-2">
                <Field label="New password">
                  <PasswordInput
                    value={newPassword}
                    onChange={setNewPassword}
                    placeholder="At least 8 characters"
                    describedBy="st-password-strength"
                  />
                  <div
                    id="st-password-strength"
                    className={`st-strength st-strength--${strength.score}`}
                    aria-live="polite"
                  >
                    <div className="st-strength-bars" aria-hidden="true">
                      {[1, 2, 3, 4].map((step) => (
                        <span key={step} className={strength.score >= step ? "is-filled" : ""} />
                      ))}
                    </div>
                    <span className="st-strength-label">
                      {strength.label || "Use 12+ characters with a mix of letters, numbers and symbols."}
                    </span>
                  </div>
                </Field>

                <Field
                  label="Confirm new password"
                  error={mismatch ? "Passwords don't match yet." : ""}
                  hint={confirmPassword && !mismatch ? "Passwords match." : ""}
                >
                  <PasswordInput
                    value={confirmPassword}
                    onChange={setConfirmPassword}
                    placeholder="Type it again"
                    invalid={mismatch}
                  />
                </Field>
              </div>
            </fieldset>
          </div>
        </li>
      </ol>

      {error && <Notice tone="error">{error}</Notice>}

      <div className="st-card-foot">
        <button type="button" className="st-btn st-btn--secondary" onClick={close}>
          Cancel
        </button>
        <button type="submit" className="st-btn st-btn--primary" disabled={busy || !codeSent}>
          {busy && codeSent ? <Spinner /> : <KeyRound size={16} />}
          Update password
        </button>
      </div>
    </form>
  );
}

/* ======================= sessions & activity ======================= */

function DeviceIcon({ type }) {
  const Icon = DEVICE_ICONS[type] || Monitor;
  return <Icon size={18} />;
}

function SessionsCard({ notify }) {
  const [sessions, setSessions] = useState([]);
  const [activity, setActivity] = useState([]);
  const [source, setSource] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState(null);
  const [confirmAll, setConfirmAll] = useState(false);
  const [showAllActivity, setShowAllActivity] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [sessionResult, activityResult] = await Promise.all([listSessions(), listLoginActivity()]);
      let list = Array.isArray(sessionResult.data) ? sessionResult.data : [];

      // no session data yet: at least show the device you're on
      if (!list.length) {
        list = [{ id: "this-device", ...describeDevice(), current: true, lastActiveAt: new Date().toISOString() }];
      }

      list.sort((a, b) => Number(Boolean(b.current)) - Number(Boolean(a.current)));
      setSessions(list);
      setActivity(Array.isArray(activityResult.data) ? activityResult.data : []);
      setSource(sessionResult.source);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const canManage = source === "server";
  const others = sessions.filter((session) => !session.current);

  const signOut = async (session) => {
    setBusyId(session.id);
    try {
      await revokeSession(session.id);
      setSessions((current) => current.filter((item) => item.id !== session.id));
      notify(`Signed out of ${deviceLabel(session)}.`);
    } catch (requestError) {
      notify(requestError.message, "error");
    } finally {
      setBusyId(null);
    }
  };

  const signOutOthers = async () => {
    setBusyId("all");
    try {
      await revokeOtherSessions();
      setSessions((current) => current.filter((item) => item.current));
      setConfirmAll(false);
      notify("Signed out of all other sessions.");
    } catch (requestError) {
      notify(requestError.message, "error");
    } finally {
      setBusyId(null);
    }
  };

  const failedRecently = activity.some(
    (item) => item.success === false && Date.now() - new Date(item.at).getTime() < 7 * 24 * 3600 * 1000
  );
  const visibleActivity = showAllActivity ? activity : activity.slice(0, ACTIVITY_PREVIEW);

  return (
    <>
      <div className="st-card">
        <CardHead
          icon={Monitor}
          title="Where you're signed in"
          description="Devices that are signed in to your Roamio account right now."
          actions={
            <button
              type="button"
              className="st-icon-button"
              onClick={load}
              disabled={loading}
              aria-label="Refresh sessions"
              title="Refresh"
            >
              <RefreshCw size={16} className={loading ? "st-spin" : ""} />
            </button>
          }
        />

        {error ? (
          <Notice tone="error">{error}</Notice>
        ) : loading && !sessions.length ? (
          <div className="st-skeleton-list" aria-label="Loading sessions">
            <span />
            <span />
          </div>
        ) : (
          <ul className="st-list">
            {sessions.map((session) => (
              <li key={session.id} className={`st-list-item${session.current ? " is-current" : ""}`}>
                <span className="st-list-icon" aria-hidden="true">
                  <DeviceIcon type={session.deviceType} />
                </span>

                <div className="st-list-copy">
                  <h4>
                    {deviceLabel(session)}
                    {session.current && <span className="st-tag st-tag--success">This device</span>}
                  </h4>
                  <p>
                    {[
                      session.location,
                      session.ipAddress,
                      session.current ? "Active now" : `Last active ${timeAgo(session.lastActiveAt).toLowerCase()}`,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                </div>

                {canManage && !session.current && (
                  <button
                    type="button"
                    className="st-btn st-btn--secondary st-btn--sm"
                    onClick={() => signOut(session)}
                    disabled={busyId !== null}
                  >
                    {busyId === session.id ? <Spinner size={14} /> : <LogOut size={14} />}
                    Sign out
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}

        {source === "device" && !error && (
          <p className="st-foot-note st-foot-note--block">
            Only this device is shown for now. Your other signed-in devices will appear here soon.
          </p>
        )}

        {canManage && others.length > 0 && (
          <div className="st-card-foot">
            <button
              type="button"
              className="st-btn st-btn--danger-soft"
              onClick={() => setConfirmAll(true)}
              disabled={busyId !== null}
            >
              <LogOut size={15} />
              Sign out of all other sessions
            </button>
          </div>
        )}
      </div>

      <div className="st-card">
        <CardHead
          icon={History}
          title="Recent login activity"
          description="Sign-ins and failed attempts on your account."
        />

        {failedRecently && (
          <Notice tone="warning">
            There were failed sign-in attempts this week. If they weren't you, change your password and
            sign out of other sessions.
          </Notice>
        )}

        {!loading && !error && activity.length === 0 ? (
          <div className="st-empty st-empty--compact">
            <ShieldCheck size={22} aria-hidden="true" />
            <p>Your recent sign-ins will appear here.</p>
          </div>
        ) : (
          <ul className="st-timeline">
            {visibleActivity.map((item) => (
              <li key={item.id || item.at} className={item.success === false ? "is-failed" : ""}>
                <span className="st-timeline-icon" aria-hidden="true">
                  {item.success === false ? <XCircle size={15} /> : <CheckCircle2 size={15} />}
                </span>

                <div className="st-timeline-copy">
                  <h4>{item.success === false ? "Failed sign-in attempt" : "Signed in"}</h4>
                  <p>
                    {[deviceLabel(item), item.location, item.ipAddress].filter(Boolean).join(" · ")}
                  </p>
                </div>

                <time dateTime={item.at} title={formatDateTime(item.at)}>
                  {timeAgo(item.at)}
                </time>
              </li>
            ))}
          </ul>
        )}

        {activity.length > ACTIVITY_PREVIEW && (
          <button
            type="button"
            className="st-text-button st-text-button--block"
            onClick={() => setShowAllActivity((current) => !current)}
          >
            {showAllActivity ? "Show less" : `Show all ${activity.length} events`}
          </button>
        )}
      </div>

      <Modal
        open={confirmAll}
        title="Sign out everywhere else?"
        description={`You'll stay signed in here. ${others.length} other ${
          others.length === 1 ? "session" : "sessions"
        } will be signed out and will need to sign in again.`}
        onClose={() => setConfirmAll(false)}
        size="sm"
        footer={
          <>
            <button type="button" className="st-btn st-btn--secondary" onClick={() => setConfirmAll(false)}>
              Cancel
            </button>
            <button
              type="button"
              className="st-btn st-btn--danger"
              onClick={signOutOthers}
              disabled={busyId === "all"}
            >
              {busyId === "all" ? <Spinner /> : <LogOut size={15} />}
              Sign out others
            </button>
          </>
        }
      >
        <ul className="st-modal-list">
          {others.map((session) => (
            <li key={session.id}>
              <DeviceIcon type={session.deviceType} />
              {deviceLabel(session)}
              {session.location && <span>{session.location}</span>}
            </li>
          ))}
        </ul>
      </Modal>
    </>
  );
}

/* ======================= section ======================= */

export default function SecuritySection({ email, notify }) {
  return (
    <SettingsSection
      id="security"
      icon={ShieldCheck}
      title="Security"
      description="Keep your account safe and see where it's being used."
      aside={
        <span className="st-pill">
          <ShieldAlert size={13} />
          Don't recognise something? Change your password.
        </span>
      }
    >
      <PasswordCard email={email} notify={notify} />
      <SessionsCard notify={notify} />
    </SettingsSection>
  );
}
