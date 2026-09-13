import { useState } from "react";

import {
  ArrowRight,
  Eye,
  EyeOff,
  Mail,
  LockKeyhole,
  Plane,
  Map,
  Users,
  Sparkles,
  MapPin,
  Send,
  Heart,
} from "lucide-react";

import { Link, useNavigate } from "react-router-dom";

import { useLogin } from "../hooks/useLogin";
import { useAuthStore } from "../store/authStore";
import { TOKEN_KEY } from "../api/client";

import "../styles/auth.css";

export default function Login() {
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const navigate = useNavigate();
  const devLogin = useAuthStore((state) => state.login);

  const {
    mutate: loginUser,
    isPending,
    error,
  } = useLogin();

  // Dev-only bypass: the Node backend has no database configured yet, so
  // real register/login 500. This skips straight to the dashboard with a
  // fake, tokenless session so the rest of the app (weather, translator,
  // recommendations) can still be exercised. Anything needing a real JWT
  // (trip creation) will still fail until a database is wired up - that's
  // expected, not something to fake here.
  const handleDevSkip = () => {
    // Clear out any stale token from an earlier session (e.g. the old
    // frontend-only mock login) - a leftover bad JWT would otherwise get
    // sent and rejected as "Invalid or expired token" on the first
    // authenticated call.
    localStorage.removeItem(TOKEN_KEY);
    devLogin({ id: 0, email: "dev@local", fullName: "Dev User" });
    navigate("/dashboard");
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    loginUser(
      {
        email,
        password,
      },
      {
        onSuccess: () => {
          // useLogin already persisted the user + token via authStore.
          navigate("/dashboard");
        },
      }
    );
  };

  return (
    <div className="auth-page">

      {/* =====================================================
          LEFT SIDE
      ===================================================== */}

      <section className="travel-panel">

        <div className="hero-overlay" />

        <div className="hero-dots" />

        <div className="travel-circle travel-circle-one" />

        <div className="travel-circle travel-circle-two" />

        {/* LOGO */}

        <div className="logo">

          <div className="logo-icon">
            <Plane size={20} />
          </div>

          <span className="logo-word">
            Roam<span className="logo-blue">io</span>
          </span>

        </div>

        {/* MAIN CONTENT */}

        <div className="travel-content">

          <div className="mini-badge">

            <Sparkles size={14} />

            SMART FAMILY TRAVEL

          </div>

          <h1>
            Your family.
            <br />

            Your journey.
            <br />

            <span>
              Your memories.
            </span>
          </h1>

          <p>
            Plan unforgettable family adventures,
            organize every detail and enjoy the
            journey together.
          </p>

          {/* FEATURES */}

          <div className="travel-features">

            <div className="travel-feature">

              <div className="feature-icon teal">
                <Users size={16} />
              </div>

              <span>
                Plan together
              </span>

            </div>

            <div className="travel-feature">

              <div className="feature-icon blue">
                <Map size={16} />
              </div>

              <span>
                Discover together
              </span>

            </div>

            <div className="travel-feature">

              <div className="feature-icon purple">
                <Sparkles size={16} />
              </div>

              <span>
                Travel smarter
              </span>

            </div>

          </div>

        </div>

        {/* JOURNEY DECORATION */}

        <div className="journey-decoration">

          <div className="journey-location">

            <div className="journey-pin">
              <MapPin size={20} />
            </div>

            <span>
              HOME
            </span>

          </div>

          <div className="journey-path" />

          <div className="journey-plane">

            <Plane size={17} />

          </div>

          <div className="journey-path" />

          <div className="journey-location">

            <div className="journey-pin">
              <MapPin size={20} />
            </div>

            <span>
              EVERYWHERE
            </span>

          </div>

        </div>

        {/* FOOTER */}

        <div className="travel-footer">

          <span>
            © 2026 Roamio
          </span>

          <span className="footer-message">

            Plan better. Travel happier.

            <Heart
              size={13}
              fill="currentColor"
            />

          </span>

        </div>

      </section>

      {/* =====================================================
          RIGHT SIDE
      ===================================================== */}

      <section className="auth-panel">

        <div className="panel-dots" />

        <div className="panel-blob" />

        <div className="panel-glow" />

        {/* AUTH CARD */}

        <div className="auth-card">

          {/* DOODLE PLANE */}

          <div className="doodle-plane">

            <svg
              className="doodle-trail"
              viewBox="0 0 74 56"
              fill="none"
              aria-hidden="true"
            >

              <path
                d="M4,50 C24,54 34,26 62,14"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeDasharray="1 7"
                strokeLinecap="round"
              />

            </svg>

            <Send
              size={20}
              className="doodle-icon"
            />

          </div>

          {/* CARD ICON */}

          <div className="logo-icon card-variant">

            <Plane size={21} />

          </div>

          {/* TITLE */}

          <div className="auth-title">

            <span className="auth-eyebrow">
              WELCOME BACK
            </span>

            <h2>
              Ready to travel?
            </h2>

            <p>
              Sign in and continue planning your
              next family adventure.
            </p>

          </div>

          {/* =================================================
              LOGIN FORM
          ================================================= */}

          <form onSubmit={handleSubmit}>

            {/* EMAIL */}

            <div className="input-group">

              <label htmlFor="login-email">
                Email address
              </label>

              <div className="input-box">

                <Mail size={18} />

                <input
                  id="login-email"
                  type="email"
                  name="email"
                  placeholder="you@example.com"
                  autoComplete="email"
                  value={email}
                  onChange={(e) =>
                    setEmail(e.target.value)
                  }
                  required
                />

              </div>

            </div>

            {/* PASSWORD */}

            <div className="input-group">

              <div className="label-row">

                <label htmlFor="login-password">
                  Password
                </label>

                <a
                  href="#"
                  onClick={(e) =>
                    e.preventDefault()
                  }
                >
                  Forgot password?
                </a>

              </div>

              <div className="input-box">

                <LockKeyhole size={18} />

                <input
                  id="login-password"
                  type={
                    showPassword
                      ? "text"
                      : "password"
                  }
                  name="password"
                  placeholder="Enter your password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) =>
                    setPassword(e.target.value)
                  }
                  required
                />

                <button
                  type="button"
                  className="password-toggle"
                  aria-label={
                    showPassword
                      ? "Hide password"
                      : "Show password"
                  }
                  onClick={() =>
                    setShowPassword(
                      (current) => !current
                    )
                  }
                >

                  {showPassword ? (
                    <EyeOff size={18} />
                  ) : (
                    <Eye size={18} />
                  )}

                </button>

              </div>

            </div>

            {/* REMEMBER ME */}

            <label className="remember-row">

              <input
                type="checkbox"
                defaultChecked
              />

              <span>
                Remember me
              </span>

            </label>

            {/* ERROR */}

            {error && (
              <p
                style={{
                  color: "#e05252",
                  fontSize: "12px",
                  lineHeight: "1.5",
                  margin: "0 0 10px",
                }}
              >
                {error?.message ||
                  "Login failed. Please check your email and password."}
              </p>
            )}

            {/* LOGIN BUTTON */}

            <button
              type="submit"
              className="travel-button"
              disabled={isPending}
            >

              <span>
                {isPending
                  ? "Signing in..."
                  : "Start planning"}
              </span>

              {!isPending && (
                <ArrowRight size={18} />
              )}

            </button>

          </form>

          {/* DEV-ONLY: no database is configured yet, so real login 500s.
              Remove once DATABASE_URL is wired up. */}
          {import.meta.env.DEV && (
            <button
              type="button"
              onClick={handleDevSkip}
              style={{
                width: "100%",
                marginTop: "10px",
                padding: "10px",
                border: "1px dashed #c9772e",
                borderRadius: "8px",
                color: "#c9772e",
                background: "#fff8f0",
                fontSize: "12px",
                fontWeight: 700,
              }}
            >
              Skip login (dev only - no database configured)
            </button>
          )}

          {/* =================================================
              DIVIDER
          ================================================= */}

          <div className="divider">

            <span />

            <p>
              or continue with
            </p>

            <span />

          </div>

          {/* =================================================
              SOCIAL LOGIN
          ================================================= */}

          <div className="social-buttons">

            {/* GOOGLE */}

            <button
              type="button"
              onClick={() =>
                console.log(
                  "Google login - testing only"
                )
              }
            >

              <span className="google-g">
                G
              </span>

              Google

            </button>

            {/* APPLE */}

            <button
              type="button"
              onClick={() =>
                console.log(
                  "Apple login - testing only"
                )
              }
            >

              <svg
                className="apple-mark"
                width="15"
                height="15"
                viewBox="0 0 384 512"
                fill="currentColor"
                aria-hidden="true"
              >

                <path d="M318.7 268.7c-.2-36.7 16.4-64.4 50-84.8-18.8-26.9-47.2-41.7-84.7-44.6-35.5-2.8-74.3 20.7-88.5 20.7-15 0-49.4-19.7-76.4-19.7C63.3 141 4 184.8 4 273.5q0 39.3 14.4 81.2c12.8 36.7 59 126.7 107.2 125.2 25.2-.6 43-17.9 75.8-17.9 31.8 0 48.3 17.9 76.4 17.9 48.6-.7 90.4-82.5 102.6-119.3-65.2-30.7-61.7-90-61.7-91.9zm-56.6-164.2c27.3-32.4 24.8-61.9 24-72.5-24.1 1.4-52 16.4-67.9 34.9-17.5 19.8-27.8 44.3-25.6 71.9 26.1 2 49.9-11.4 69.5-34.3z" />

              </svg>

              Apple

            </button>

          </div>

          {/* =================================================
              REGISTER
          ================================================= */}

          <div className="signup-text">

            <span>
              Don't have a Roamio account?
            </span>

            <Link to="/register">

              Create one

              <ArrowRight size={14} />

            </Link>

          </div>

          {/* =================================================
              SECURITY
          ================================================= */}

          <div className="safe-message">

            <LockKeyhole size={13} />

            <span>
              Your account and personal information
              are kept secure.
            </span>

          </div>

        </div>

      </section>

    </div>
  );
}