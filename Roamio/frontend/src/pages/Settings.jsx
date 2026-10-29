import {
  AlertTriangle,
  ArrowLeft,
<<<<<<< Updated upstream
  ArrowRight,
  CheckCircle2,
  LockKeyhole,
  Mail,
=======
  Bell,
  CheckCircle2,
  LifeBuoy,
  Lock,
  Moon,
>>>>>>> Stashed changes
  Plane,
  Settings as SettingsIcon,
<<<<<<< Updated upstream
  User,
} from "lucide-react";

import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import "../styles/settings.css";

export default function Settings() {
  const navigate = useNavigate();

  // Current user data
  const [name, setName] = useState("Savaan");
  const [email, setEmail] = useState("savaan@example.com");

  const [saved, setSaved] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();

    // For now, save locally.
    // Replace this with your API/update-profile hook later.
    localStorage.setItem(
      "user",
      JSON.stringify({
        name,
        email,
      })
    );

    setSaved(true);

    setTimeout(() => {
      setSaved(false);
    }, 3000);
  };

  return (
    <div className="settings-page">
=======
  ShieldCheck,
  Sun,
  User,
  Users,
  X,
} from "lucide-react";

import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";

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
  typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

export default function Settings() {
  const storedUser = useAuthStore((state) => state.user) || {};
  const name = storedUser.name || storedUser.fullName || "";
  const email = storedUser.email || "";

  // app-wide theme - changing it here updates every page
  const { theme, toggle: toggleTheme, setTheme } = useTheme();

  /* ---------------- toast ---------------- */

  const [toast, setToast] = useState(null);
  const toastTimer = useRef(null);

  const notify = useCallback((message, tone = "success") => {
    clearTimeout(toastTimer.current);
    setToast({ message, tone, key: Date.now() });
    toastTimer.current = setTimeout(() => setToast(null), tone === "error" ? 6000 : 3500);
  }, []);

  useEffect(() => () => clearTimeout(toastTimer.current), []);

  /* ---------------- section nav + scroll spy ---------------- */

  const [active, setActive] = useState(SECTIONS[0].id);
  const navRef = useRef(null);

  useEffect(() => {
    const elements = SECTIONS.map(({ id }) => document.getElementById(id)).filter(Boolean);
    if (!elements.length || typeof IntersectionObserver === "undefined") return undefined;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActive(visible[0].target.id);
      },
      { rootMargin: "-20% 0px -65% 0px" }
    );

    elements.forEach((element) => observer.observe(element));
    return () => observer.disconnect();
  }, []);

  // keep the active chip in view on the mobile nav bar
  useEffect(() => {
    const chip = navRef.current?.querySelector(`[data-section="${active}"]`);
    const bar = navRef.current;
    if (!chip || !bar || bar.scrollWidth <= bar.clientWidth) return;
    bar.scrollTo({
      left: chip.offsetLeft - bar.clientWidth / 2 + chip.clientWidth / 2,
      behavior: prefersReducedMotion() ? "auto" : "smooth",
    });
  }, [active]);

  const goTo = (id) => (event) => {
    event.preventDefault();
    const element = document.getElementById(id);
    if (!element) return;
    element.scrollIntoView({ behavior: prefersReducedMotion() ? "auto" : "smooth", block: "start" });
    window.history.replaceState(null, "", `#${id}`);
    setActive(id);
    element.querySelector("h2")?.focus({ preventScroll: true });
  };

  // deep links such as /settings#notifications (e.g. from an email footer)
  useEffect(() => {
    const id = window.location.hash.slice(1);
    if (SECTIONS.some((section) => section.id === id)) {
      setTimeout(() => document.getElementById(id)?.scrollIntoView({ block: "start" }), 60);
    }
  }, []);

  return (
    <div className="recommendations-page settings-page" data-theme={theme}>
      {/* ================= HERO / HEADER ================= */}
>>>>>>> Stashed changes

      {/* SIDEBAR */}

      <aside className="settings-sidebar">

        <div className="settings-logo">

          <div className="settings-logo-icon">
            <Plane size={20} />
          </div>

          <span>
            Rom<span>io</span>
          </span>

        </div>


        <nav className="settings-nav">

          <Link to="/dashboard">
            <ArrowLeft size={18} />
            Back to dashboard
          </Link>

<<<<<<< Updated upstream
        </nav>


        <div className="settings-sidebar-bottom">

          <div className="settings-tip">

            <div>
              <SettingsIcon size={18} />
            </div>

            <span>
              Manage your account and profile
              information.
            </span>

          </div>

        </div>

      </aside>


      {/* MAIN */}

      <main className="settings-main">

        {/* HEADER */}

        <header className="settings-header">

          <div>

            <span className="settings-eyebrow">
              ACCOUNT SETTINGS
            </span>

            <h1>
              Edit your profile
            </h1>

            <p>
              Update your personal information and
              keep your Roamio profile up to date.
            </p>

          </div>

        </header>


        {/* CONTENT */}

        <div className="settings-content">


          {/* PROFILE CARD */}

          <section className="profile-card">

            <div className="profile-card-header">

              <div>

                <span className="settings-section-label">
                  YOUR PROFILE
                </span>

                <h2>
                  Personal information
                </h2>

                <p>
                  This information will be used for
                  your Roamio account.
                </p>

              </div>


              {/* AVATAR */}

              <div className="large-profile-avatar">
                {name
                  ? name.charAt(0).toUpperCase()
                  : "U"}
              </div>

            </div>


            <form onSubmit={handleSubmit}>

              {/* NAME */}

              <div className="settings-input-group">

                <label htmlFor="profile-name">
                  Full name
                </label>

                <div className="settings-input">

                  <User size={18} />

                  <input
                    id="profile-name"
                    type="text"
                    value={name}
                    placeholder="Your full name"
                    autoComplete="name"
                    onChange={(e) =>
                      setName(e.target.value)
                    }
                    required
                  />

                </div>

              </div>


              {/* EMAIL */}

              <div className="settings-input-group">

                <label htmlFor="profile-email">
                  Email address
                </label>

                <div className="settings-input">

                  <Mail size={18} />

                  <input
                    id="profile-email"
                    type="email"
                    value={email}
                    placeholder="you@example.com"
                    autoComplete="email"
                    onChange={(e) =>
                      setEmail(e.target.value)
                    }
                    required
                  />

                </div>

              </div>


              {/* SAVE */}

              <div className="settings-actions">

                <button
                  type="button"
                  className="settings-cancel"
                  onClick={() =>
                    navigate("/dashboard")
                  }
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="settings-save"
                >

                  <Save size={17} />

                  Save changes

                  <ArrowRight size={16} />

                </button>

              </div>

            </form>


            {/* SUCCESS */}

            {saved && (
              <div className="settings-success">

                <CheckCircle2 size={17} />

                <span>
                  Your profile has been updated
                  successfully.
                </span>

              </div>
            )}

          </section>


          {/* PASSWORD CARD */}

          <section className="password-card">

            <div className="password-icon">

              <LockKeyhole size={20} />

            </div>

            <div className="password-info">

              <span className="settings-section-label">
                SECURITY
              </span>

              <h2>
                Password
              </h2>

              <p>
                Keep your account secure by using a
                strong password.
              </p>

            </div>
=======
          <div className="recommendations-brand">
            <span>
              <Plane size={18} />
            </span>
            Roamio
          </div>
>>>>>>> Stashed changes

          <div className="rx-header-right">
            <button
              type="button"
<<<<<<< Updated upstream
              className="change-password-button"
              onClick={() =>
                alert(
                  "Change password functionality coming soon."
                )
              }
            >
              Change password
              <ArrowRight size={15} />
=======
              className="theme-toggle"
              aria-label={`Switch to ${theme === "light" ? "dark" : "light"} mode`}
              onClick={toggleTheme}
            >
              {theme === "light" ? <Moon size={17} /> : <Sun size={17} />}
>>>>>>> Stashed changes
            </button>

<<<<<<< Updated upstream
          </section>


          {/* ACCOUNT INFO */}
=======
        <div className="settings-hero-body">
          <p className="settings-eyebrow">
            <SettingsIcon size={14} />
            Account settings
          </p>
          <h1>Settings</h1>
          <p>Your profile, notifications, security, travellers and privacy, all in one place.</p>
        </div>
      </section>
>>>>>>> Stashed changes

          <section className="account-info-card">

<<<<<<< Updated upstream
            <div className="account-plane">
              <Plane size={28} />
            </div>

            <div>

              <span className="settings-section-label">
                Roamio ACCOUNT
              </span>

              <h3>
                Plan better. Travel happier.
              </h3>
=======
      <main className="settings-content">
        <div className="st-layout">
          <aside className="st-rail" aria-label="Settings sections">
            <div className="st-rail-profile">
              <span className="st-rail-avatar" aria-hidden="true">
                {storedUser.photo ? <img src={storedUser.photo} alt="" /> : initialsOf(name)}
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
                  aria-current={active === id ? "true" : undefined}
                  onClick={goTo(id)}
                >
                  <Icon size={17} aria-hidden="true" />
                  {label}
                </a>
              ))}
            </nav>
>>>>>>> Stashed changes

            <div className="st-rail-help">
              <LifeBuoy size={18} aria-hidden="true" />
              <p>
<<<<<<< Updated upstream
                Your profile information helps your
                family recognize you when planning
                adventures together.
              </p>

            </div>

          </section>

=======
                Need a hand?{" "}
                <a href="#help" onClick={goTo("help")}>
                  Visit help &amp; support
                </a>
              </p>
            </div>
          </aside>

          <div className="st-sections">
            <ProfileSection theme={theme} setTheme={setTheme} notify={notify} />
            <NotificationsSection email={email} notify={notify} />
            <SecuritySection email={email} notify={notify} />
            <TravellersSection email={email} notify={notify} />
            <PrivacySection notify={notify} />
            <HelpSection email={email} notify={notify} />
          </div>
>>>>>>> Stashed changes
        </div>

      </main>

<<<<<<< Updated upstream
=======
      {/* ================= TOAST ================= */}

      <div className="st-toast-region" aria-live="polite" aria-atomic="true">
        {toast && (
          <div key={toast.key} className={`st-toast st-toast--${toast.tone}`} role={toast.tone === "error" ? "alert" : "status"}>
            {toast.tone === "error" ? <AlertTriangle size={17} /> : <CheckCircle2 size={17} />}
            <span>{toast.message}</span>
            <button type="button" aria-label="Dismiss" onClick={() => setToast(null)}>
              <X size={15} />
            </button>
          </div>
        )}
      </div>
>>>>>>> Stashed changes
    </div>
  );
}
