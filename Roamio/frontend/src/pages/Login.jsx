import { useState } from "react";

import {
  ArrowLeft,
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

import { Link, useLocation, useNavigate } from "react-router-dom";
import { nextPath } from "../utils/nextPath.js";

import { useLogin } from "../hooks/useLogin";
import FieldError from "../components/FieldError.jsx";
import { emailError, MAX_EMAIL, MAX_PASSWORD } from "../utils/validation.js";

import "../styles/auth.css";

export default function Login() {
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const navigate = useNavigate();
  const location = useLocation();

  const {
    mutate: loginUser,
    isPending,
    error,
  } = useLogin();

  const [fieldErrors, setFieldErrors] = useState({});

  const handleSubmit = (e) => {
    e.preventDefault();

    const found = {};
    const emailProblem = emailError(email);
    if (emailProblem) found.email = emailProblem;
    if (!password) found.password = "Enter your password.";
    setFieldErrors(found);
    if (Object.keys(found).length) return;

    loginUser(
      {
        email: email.trim(),
        password,
      },
      {
        onSuccess: () => {
          navigate(nextPath(location.search));
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

        <Link to="/" className="logo" aria-label="Roamio home">
          <div className="logo-icon">
            <Plane size={20} />
          </div>

          <span className="logo-word">
            Roam<span className="logo-blue">io</span>
          </span>
        </Link>

        {/* MAIN CONTENT */}

        <div className="travel-content">
          <div className="mini-badge">
            <Sparkles size={14} />

            SMART GROUP TRAVEL
          </div>

          <h1>
            Your group.
            <br />

            Your journey.
            <br />

            <span>One plan.</span>
          </h1>

          <p>
            Plan trips your whole group agrees on,
            organize every detail and enjoy the
            journey together.
          </p>

          {/* FEATURES */}

          <div className="travel-features">
            <div className="travel-feature">
              <div className="feature-icon teal">
                <Users size={16} />
              </div>

              <span>Plan together</span>
            </div>

            <div className="travel-feature">
              <div className="feature-icon blue">
                <Map size={16} />
              </div>

              <span>Discover together</span>
            </div>

            <div className="travel-feature">
              <div className="feature-icon purple">
                <Sparkles size={16} />
              </div>

              <span>Travel smarter</span>
            </div>
          </div>
        </div>

        {/* JOURNEY DECORATION */}

        <div className="journey-decoration">
          <div className="journey-location">
            <div className="journey-pin">
              <MapPin size={20} />
            </div>

            <span>HOME</span>
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

            <span>EVERYWHERE</span>
          </div>
        </div>

        {/* FOOTER */}

        <div className="travel-footer">
          <span>© 2026 Roamio</span>

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
        <Link to="/" className="auth-back-link">
          <ArrowLeft size={16} />
          Back to home
        </Link>

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

            <h2>Ready to travel?</h2>

            <p>
              Sign in and continue planning your
              next group trip.
            </p>
          </div>

          {/* LOGIN FORM */}

          <form onSubmit={handleSubmit} noValidate>
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
                  maxLength={MAX_EMAIL}
                  aria-invalid={Boolean(fieldErrors.email)}
                  aria-describedby={fieldErrors.email ? "login-email-error" : undefined}
                  onChange={(e) =>
                    setEmail(e.target.value)
                  }
                  required
                />
              </div>
              <FieldError id="login-email-error" message={fieldErrors.email} />
            </div>

            {/* PASSWORD */}

            <div className="input-group">
              <label htmlFor="login-password">
                Password
              </label>

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
                  maxLength={MAX_PASSWORD}
                  aria-invalid={Boolean(fieldErrors.password)}
                  aria-describedby={fieldErrors.password ? "login-password-error" : undefined}
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
              <FieldError id="login-password-error" message={fieldErrors.password} />
            </div>

            {/* REMEMBER ME */}

            <label className="remember-row">
              <input
                type="checkbox"
                defaultChecked
              />

              <span>Remember me</span>
            </label>

            <p style={{ margin: "0 0 10px", fontSize: "0.8rem" }}>
              <Link to="/forgot-password">Forgot password?</Link>
            </p>

            {/* ERROR */}

            {error && (
              <p
                style={{
                  color: "#e05252",
                  fontSize: "0.75rem",
                  lineHeight: "1.5",
                  margin: "0 0 10px",
                }}
              >
                {error.message ||
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

          {/* REGISTER */}

          <div className="signup-text">
            <span>
              Don't have a Roamio account?
            </span>

            <Link to={`/register${location.search}`}>
              Create one

              <ArrowRight size={14} />
            </Link>
          </div>

          {/* SECURITY */}

          <p className="legal-note">
            By signing in you agree to our <Link to="/terms">Terms</Link> and <Link to="/privacy">Privacy Policy</Link>.
          </p>

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