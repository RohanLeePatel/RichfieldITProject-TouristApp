import {
  BedDouble,
  Bell,
  BellRing,
  CalendarClock,
  Mail,
  MonitorSmartphone,
  PlaneTakeoff,
  RotateCcw,
  Save,
  ShieldAlert,
  ShieldCheck,
  Ticket,
  Users,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { disablePush, enablePush, pushSupported, sendTestPush } from "../../services/push.js";

import {
  DEFAULT_NOTIFICATIONS,
  getNotificationPrefs,
  saveNotificationPrefs,
} from "../../api/settings.js";
import { Notice, SettingsSection, Spinner, Switch } from "./SettingsUI.jsx";

const TOPIC_GROUPS = [
  {
    title: "Bookings & trips",
    items: [
      {
        key: "bookingConfirmations",
        icon: Ticket,
        label: "Booking confirmations",
        description: "Receipts when a booking is made, paid for or cancelled.",
      },
      {
        key: "travelUpdates",
        icon: CalendarClock,
        label: "Travel updates",
        description: "Check-in reminders, trip countdowns and itinerary changes from your group.",
      },
    ],
  },
  {
    title: "Safety",
    recommended: true,
    items: [
      {
        key: "safetyAlerts",
        icon: ShieldAlert,
        label: "Safety alerts",
        description: "When the travel advisory for a destination on your trip rises to level 3 or 4.",
      },
    ],
  },
  {
    title: "Account security",
    recommended: true,
    items: [
      {
        key: "securityAlerts",
        icon: ShieldCheck,
        label: "New sign-ins",
        description: "When your account is signed in from a browser or device we haven't seen before.",
      },
    ],
  },
  {
    title: "Group activity",
    items: [
      {
        key: "groupActivity",
        icon: Users,
        label: "Invites and trip changes",
        description: "When you're invited to a trip group, or someone in your group edits a shared trip.",
      },
    ],
  },
  {
    title: "Changes to your plans",
    recommended: true,
    items: [
      {
        key: "flightChanges",
        icon: PlaneTakeoff,
        label: "Flight changes",
        description: "Delays, gate and schedule changes, and cancellations.",
      },
      {
        key: "accommodationChanges",
        icon: BedDouble,
        label: "Accommodation changes",
        description: "New check-in times, room changes and cancellations from your stay.",
      },
    ],
  },
];

const CHANNELS = [
  { key: "email", label: "Email", icon: Mail },
  { key: "browser", label: "Browser", icon: MonitorSmartphone },
];

const browserSupported = pushSupported;

export default function NotificationsSection({ email, notify }) {
  const [prefs, setPrefs] = useState(DEFAULT_NOTIFICATIONS);
  const [baseline, setBaseline] = useState(DEFAULT_NOTIFICATIONS);
  const [source, setSource] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [saving, setSaving] = useState(false);
  const [sendingTest, setSendingTest] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [permission, setPermission] = useState(() =>
    browserSupported() ? Notification.permission : "unsupported"
  );

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError("");
    try {
      const { data, source: from } = await getNotificationPrefs(email);
      setPrefs(data);
      setBaseline(data);
      setSource(from);
    } catch (error) {
      setLoadError(error.message);
    } finally {
      setLoading(false);
    }
  }, [email]);

  useEffect(() => {
    load();
  }, [load]);

  const dirty = useMemo(() => JSON.stringify(prefs) !== JSON.stringify(baseline), [prefs, baseline]);

  // browser alerts only work while the browser allows them
  const browserBlocked = permission === "denied" || permission === "unsupported";
  const channelOn = (channel) =>
    channel === "browser" ? prefs.channels.browser && permission === "granted" : prefs.channels[channel];

  const setChannel = async (channel, on) => {
    if (channel === "browser" && on) {
      if (!browserSupported()) return;

      let result;
      try {
        result = await enablePush(); // asks permission, subscribes this browser, saves it
      } catch (error) {
        setPermission(Notification.permission);
        notify(error.message || "Couldn't turn on browser notifications. Please try again.", "error");
        return;
      }
      setPermission(Notification.permission);
      if (result !== "granted") return;
    }
    if (channel === "browser" && !on) disablePush().catch(() => {});

    setPrefs((current) => ({ ...current, channels: { ...current.channels, [channel]: on } }));
  };

  const setTopic = (topic, channel, on) =>
    setPrefs((current) => ({
      ...current,
      topics: { ...current.topics, [topic]: { ...current.topics[topic], [channel]: on } },
    }));

  const sendTest = async () => {
    setSendingTest(true);
    try {
      await sendTestPush();
      notify("Test notification sent. Check this device’s notifications.");
    } catch (error) {
      notify(error.message || "Couldn't send a test notification.", "error");
    } finally {
      setSendingTest(false);
    }
  };

  const save = async () => {
    setSaving(true);
    setSaveError("");
    try {
      const { data, source: from } = await saveNotificationPrefs(email, prefs);
      setPrefs(data);
      setBaseline(data);
      setSource(from);
      notify("Notification preferences saved.");
    } catch (error) {
      setSaveError(error.message);
    } finally {
      setSaving(false);
    }
  };

  // A topic is unreachable when no channel that is switched on carries it. Then the
  // user would never hear about a flight or stay change, so we warn them.
  const missingChanges = ["flightChanges", "accommodationChanges"].filter(
    (topic) => !CHANNELS.some(({ key }) => channelOn(key) && prefs.topics[topic][key])
  );

  return (
    <SettingsSection
      id="notifications"
      icon={Bell}
      title="Notifications"
      description="Choose what we tell you about and where. Security alerts about your account are always sent by email."
    >
      {loadError ? (
        <Notice
          tone="error"
          action={
            <button type="button" className="st-btn st-btn--secondary st-btn--sm" onClick={load}>
              Try again
            </button>
          }
        >
          {loadError}
        </Notice>
      ) : (
        <>
          {/* ---------- channels ---------- */}

          <div className="st-channel-grid" aria-busy={loading}>
            <div className={`st-channel${prefs.channels.email ? " is-on" : ""}`}>
              <span className="st-channel-icon" aria-hidden="true">
                <Mail size={19} />
              </span>
              <div className="st-channel-copy">
                <h3>Email</h3>
                <p>{email ? `Sent to ${email}` : "Sent to your account email"}</p>
              </div>
              <Switch
                checked={prefs.channels.email}
                onChange={(on) => setChannel("email", on)}
                label="Email notifications"
                disabled={loading}
              />
            </div>

            <div className={`st-channel${channelOn("browser") ? " is-on" : ""}`}>
              <span className="st-channel-icon" aria-hidden="true">
                <BellRing size={19} />
              </span>
              <div className="st-channel-copy">
                <h3>Browser</h3>
                <p>
                  {permission === "unsupported"
                    ? "This browser doesn't support notifications."
                    : permission === "denied"
                      ? "Blocked in your browser settings."
                      : channelOn("browser")
                        ? "Pop-up alerts on this device."
                        : "Get pop-up alerts on this device."}
                </p>
                {channelOn("browser") && (
                  <button type="button" className="st-text-button" onClick={sendTest} disabled={loading || sendingTest}>
                    {sendingTest ? "Sending test…" : "Send a test notification"}
                  </button>
                )}
              </div>
              <Switch
                checked={channelOn("browser")}
                onChange={(on) => setChannel("browser", on)}
                label="Browser notifications"
                disabled={loading || browserBlocked || sendingTest}
              />
            </div>
          </div>

          {permission === "denied" && (
            <Notice tone="warning">
              Your browser is blocking notifications from Roamio. Click the padlock next to the web
              address, allow <strong>Notifications</strong>, then reload this page.
            </Notice>
          )}

          {/* ---------- topics ---------- */}

          <div className="st-card st-card--flush">
            {TOPIC_GROUPS.map((group) => (
              <div className="st-topic-group" key={group.title}>
                <div className="st-topic-group-head">
                  <h3>
                    {group.title}
                    {group.recommended && <span className="st-tag">Recommended</span>}
                  </h3>
                  <div className="st-topic-columns" aria-hidden="true">
                    {CHANNELS.map(({ key, label }) => (
                      <span key={key}>{label}</span>
                    ))}
                  </div>
                </div>

                {group.items.map(({ key, icon: Icon, label, description }) => (
                  <div className="st-topic" key={key}>
                    <span className="st-topic-icon" aria-hidden="true">
                      <Icon size={17} />
                    </span>

                    <div className="st-topic-copy">
                      <h4>{label}</h4>
                      <p>{description}</p>
                    </div>

                    <div className="st-topic-toggles">
                      {CHANNELS.map(({ key: channel, label: channelLabel }) => {
                        const available = channelOn(channel);
                        return (
                          <div className="st-topic-toggle" key={channel}>
                            <span className="st-topic-toggle-label">{channelLabel}</span>
                            <Switch
                              size="sm"
                              checked={available && prefs.topics[key][channel]}
                              onChange={(on) => setTopic(key, channel, on)}
                              label={`${label} by ${channelLabel.toLowerCase()}`}
                              disabled={loading || !available}
                              title={available ? undefined : `Turn on ${channelLabel.toLowerCase()} notifications first`}
                            />
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            ))}

            {!loading && missingChanges.length > 0 && (
              <div className="st-card-inset">
                <Notice tone="warning">
                  You won't be told about{" "}
                  {missingChanges.length === 2
                    ? "flight or accommodation changes"
                    : missingChanges[0] === "flightChanges"
                      ? "flight changes"
                      : "accommodation changes"}
                  . You could miss a delay or cancellation.
                </Notice>
              </div>
            )}

            {saveError && (
              <div className="st-card-inset">
                <Notice tone="error">{saveError}</Notice>
              </div>
            )}

            <div className="st-card-foot st-card-foot--padded">
              {source === "device" && (
                <span className="st-foot-note">Saved in this browser for now.</span>
              )}

              <button
                type="button"
                className="st-btn st-btn--secondary"
                onClick={() => setPrefs(baseline)}
                disabled={!dirty || saving}
              >
                <RotateCcw size={15} />
                Discard
              </button>

              <button
                type="button"
                className="st-btn st-btn--primary"
                onClick={save}
                disabled={!dirty || saving || loading}
              >
                {saving ? <Spinner /> : <Save size={16} />}
                {saving ? "Saving…" : "Save preferences"}
              </button>
            </div>
          </div>
        </>
      )}
    </SettingsSection>
  );
}
