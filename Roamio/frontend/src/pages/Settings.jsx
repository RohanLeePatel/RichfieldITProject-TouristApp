
import {
  AlertTriangle,
  Bell,
  CheckCircle2,
  LifeBuoy,
  Lock,
  Settings as SettingsIcon,
  ShieldCheck,
  User,
  Users,
  X,
} from "lucide-react";

import { useCallback, useEffect, useRef, useState } from "react";

import PageTopBar from "../components/PageTopBar.jsx";
import useTheme from "../components/recommendations/useTheme.js";
import HelpSection from "../components/settings/HelpSection.jsx";
import NotificationsSection from "../components/settings/NotificationsSection.jsx";
import PrivacySection from "../components/settings/PrivacySection.jsx";
import ProfileSection from "../components/settings/ProfileSection.jsx";
import SecuritySection from "../components/settings/SecuritySection.jsx";
import TravellersSection from "../components/settings/TravellersSection.jsx";
import { initialsOf } from "../components/settings/settingsUtils.js";
import { useAuthStore } from "../store/authStore.js";
import "../styles/Settings.css";

const SECTIONS = [
  { id: "profile", label: "Profile", icon: User },
  { id: "notifications", label: "Notifications", icon: Bell },
  { id: "security", label: "Security", icon: ShieldCheck },
  { id: "travellers", label: "Travellers", icon: Users },
  { id: "privacy", label: "Privacy & data", icon: Lock },
  { id: "help", label: "Help & support", icon: LifeBuoy },
];

const prefersReducedMotion = () =>
  typeof window !== "undefined" &&
  window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

export default function Settings() {
  const storedUser = useAuthStore((state) => state.user) || {};
  const name = storedUser.name || storedUser.fullName || "";
  const email = storedUser.email || "";

  // App-wide theme
  const { theme, toggle: toggleTheme, setTheme } = useTheme();

  /* ---------------- toast ---------------- */

  const [toast, setToast] = useState(null);
  const toastTimer = useRef(null);

  const notify = useCallback((message, tone = "success") => {
    clearTimeout(toastTimer.current);
    setToast({ message, tone, key: Date.now() });
    toastTimer.current = setTimeout(
      () => setToast(null),
      tone === "error" ? 6000 : 3500
    );
  }, []);

  useEffect(() => () => clearTimeout(toastTimer.current), []);

  /* ---------------- section nav + scroll spy ---------------- */

  const [active, setActive] = useState(SECTIONS[0].id);
  const navRef = useRef(null);

  useEffect(() => {
    const elements = SECTIONS.map(({ id }) =>
      document.getElementById(id)
    ).filter(Boolean);

    if (!elements.length || typeof IntersectionObserver === "undefined") {
      return undefined;
    }

    // The active section is the topmost one visible in the band 20% to 35% down the
    // viewport, a line that reads as "where the reader is". The rootMargin sets that band.
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort(
            (a, b) =>
              a.boundingClientRect.top - b.boundingClientRect.top
          );

        if (visible[0]) setActive(visible[0].target.id);
      },
      { rootMargin: "-20% 0px -65% 0px" }
    );

    elements.forEach((element) => observer.observe(element));
    return () => observer.disconnect();
  }, []);

  // Keep the active chip in view on the mobile nav bar
  useEffect(() => {
    const chip = navRef.current?.querySelector(
      `[data-section="${active}"]`
    );
    const bar = navRef.current;

    if (!chip || !bar || bar.scrollWidth <= bar.clientWidth) return;

    bar.scrollTo({
      left:
        chip.offsetLeft -
        bar.clientWidth / 2 +
        chip.clientWidth / 2,
      behavior: prefersReducedMotion() ? "auto" : "smooth",
    });
  }, [active]);

  const goTo = (id) => (event) => {
    event.preventDefault();

    const element = document.getElementById(id);
    if (!element) return;

    element.scrollIntoView({
      behavior: prefersReducedMotion() ? "auto" : "smooth",
      block: "start",
    });

    // Keeps the URL hash in step, so a reload or a shared link lands in the same
    // place. Focus moves to the heading so keyboard and screen-reader users follow the jump.
    window.history.replaceState(null, "", `#${id}`);
    setActive(id);
    element.querySelector("h2")?.focus({ preventScroll: true });
  };

  // Deep links such as /settings#notifications
  useEffect(() => {
    const id = window.location.hash.slice(1);

    if (SECTIONS.some((section) => section.id === id)) {
      setTimeout(
        () =>
          document.getElementById(id)?.scrollIntoView({
            block: "start",
          }),
        60
      );
    }
  }, []);

  return (
    <div
      className="recommendations-page settings-page"
      data-theme={theme}
    >
      {/* ================= HERO / HEADER ================= */}

      <PageTopBar
        theme={theme}
        onToggleTheme={toggleTheme}
        hero={
          <>
            <p className="page-topbar-eyebrow">
              <SettingsIcon size={15} />
              Account settings
            </p>
            <h1>Settings</h1>
            <p className="page-topbar-lede">
              Your profile, notifications, security, travellers and
              privacy, all in one place.
            </p>
          </>
        }
      />

      {/* ================= MAIN ================= */}

      <main className="settings-content">
        <div className="st-layout">

          <aside
            className="st-rail"
            aria-label="Settings sections"
          >
            <div className="st-rail-profile">
              <span
                className="st-rail-avatar"
                aria-hidden="true"
              >
                {storedUser.photo ? (
                  <img src={storedUser.photo} alt="" />
                ) : (
                  initialsOf(name)
                )}
              </span>

              <div>
                <strong>{name || "Your name"}</strong>
                <span>{email || "you@example.com"}</span>
              </div>
            </div>

            <nav className="st-nav" ref={navRef}>
              {SECTIONS.map(({ id, label, icon: Icon }) => (
                <a
                  key={id}
                  href={`#${id}`}
                  data-section={id}
                  className={active === id ? "is-active" : ""}
                  aria-current={
                    active === id ? "true" : undefined
                  }
                  onClick={goTo(id)}
                >
                  <Icon size={17} aria-hidden="true" />
                  {label}
                </a>
              ))}
            </nav>

            <div className="st-rail-help">
              <LifeBuoy size={18} aria-hidden="true" />

              <p>
                Need a hand?{" "}
                <a
                  href="#help"
                  onClick={goTo("help")}
                >
                  Visit help &amp; support
                </a>
              </p>
            </div>
          </aside>

          <div className="st-sections">
            <ProfileSection
              theme={theme}
              setTheme={setTheme}
              notify={notify}
            />

            <NotificationsSection
              email={email}
              notify={notify}
            />

            <SecuritySection
              email={email}
              notify={notify}
            />

            <TravellersSection
              email={email}
              notify={notify}
            />

            <PrivacySection notify={notify} />

            <HelpSection
              email={email}
              notify={notify}
            />
          </div>

        </div>
      </main>

      {/* ================= TOAST ================= */}

      <div
        className="st-toast-region"
        aria-live="polite"
        aria-atomic="true"
      >
        {toast && (
          <div
            key={toast.key}
            className={`st-toast st-toast--${toast.tone}`}
            role={toast.tone === "error" ? "alert" : "status"}
          >
            {toast.tone === "error" ? (
              <AlertTriangle size={17} />
            ) : (
              <CheckCircle2 size={17} />
            )}

            <span>{toast.message}</span>

            <button
              type="button"
              aria-label="Dismiss"
              onClick={() => setToast(null)}
            >
              <X size={15} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
