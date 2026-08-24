import { useState } from "react";

import {
  ArrowRight,
  Eye,
  EyeOff,
  Mail,
  LockKeyhole,
  Plane,
  Users,
  Sparkles,
  Map,
  MapPin,
  Send,
  Heart,
} from "lucide-react";

import { Link, useNavigate } from "react-router-dom";

import { useRegister } from "../hooks/useRegister";

import "../styles/auth.css";

export default function Register() {
  const navigate = useNavigate();

  /*
   * =====================================================
   * FORM STATE
   * =====================================================
   */

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [passwordError, setPasswordError] = useState("");

  /*
   * =====================================================
   * TANSTACK QUERY
   * =====================================================
   */

  const registerMutation = useRegister();

  /*
   * =====================================================
   * REGISTER
   * =====================================================
   */

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    setPasswordError("");

    /*
     * Check passwords
     */

    if (password !== confirmPassword) {
      setPasswordError("Passwords do not match.");
      return;
    }

    /*
     * Check password length
     */

    if (password.length < 6) {
      setPasswordError(
        "Password must be at least 6 characters."
      );

      return;
    }

    /*
     * Send registration to TanStack Query
     */

    registerMutation.mutate(
      {
        name,
        email,
        password,
      },
      {
        onSuccess: () => {
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


        {/* =====================================================
            LOGO
        ===================================================== */}

        <div className="logo">

          <div className="logo-icon">
            <Plane size={20} />
          </div>

          <span className="logo-word">
            Fam<span className="logo-blue">Planner</span>
          </span>

        </div>


        {/* =====================================================
            MAIN CONTENT
        ===================================================== */}

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
            Create your FamPlanner account and start
            planning unforgettable family adventures.
          </p>


          {/* =====================================================
              FEATURES
          ===================================================== */}

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


        {/* =====================================================
            JOURNEY DECORATION
        ===================================================== */}

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


        {/* =====================================================
            FOOTER
        ===================================================== */}

        <div className="travel-footer">

          <span>
            © 2026 FamPlanner
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


        {/* =====================================================
            REGISTER CARD
        ===================================================== */}

        <div className="auth-card">


          {/* =====================================================
              DECORATIVE PLANE
          ===================================================== */}

          <div className="doodle-plane">

            <svg
              className="doodle-trail"
              viewBox="0 0 74 56"
              fill="none"
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


          {/* =====================================================
              CARD ICON
          ===================================================== */}

          <div className="logo-icon card-variant">

            <Plane size={21} />

          </div>


          {/* =====================================================
              TITLE
          ===================================================== */}

          <div className="auth-title">

            <span className="auth-eyebrow">
              CREATE YOUR ACCOUNT
            </span>

            <h2>
              Start your journey.
            </h2>

            <p>
              Create your account and start planning
              your next family adventure.
            </p>

          </div>


          {/* =====================================================
              REGISTER FORM
          ===================================================== */}

          <form onSubmit={handleSubmit}>

            {/* NAME */}

            <div className="input-group">

              <label htmlFor="register-name">
                Full name
              </label>

              <div className="input-box">

                <Users size={18} />

                <input
                  id="register-name"
                  type="text"
                  placeholder="Your full name"
                  autoComplete="name"
                  value={name}
                  onChange={(e) =>
                    setName(e.target.value)
                  }
                  required
                />

              </div>

            </div>


            {/* EMAIL */}

            <div className="input-group">

              <label htmlFor="register-email">
                Email address
              </label>

              <div className="input-box">

                <Mail size={18} />

                <input
                  id="register-email"
                  type="email"
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

              <label htmlFor="register-password">
                Password
              </label>

              <div className="input-box">

                <LockKeyhole size={18} />

                <input
                  id="register-password"
                  type={
                    showPassword
                      ? "text"
                      : "password"
                  }
                  placeholder="Create a password"
                  autoComplete="new-password"
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
                    setShowPassword(!showPassword)
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


            {/* CONFIRM PASSWORD */}

            <div className="input-group">

              <label htmlFor="register-confirm-password">
                Confirm password
              </label>

              <div className="input-box">

                <LockKeyhole size={18} />

                <input
                  id="register-confirm-password"
                  type={
                    showConfirmPassword
                      ? "text"
                      : "password"
                  }
                  placeholder="Confirm your password"
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(e) =>
                    setConfirmPassword(e.target.value)
                  }
                  required
                />

                <button
                  type="button"
                  className="password-toggle"
                  aria-label={
                    showConfirmPassword
                      ? "Hide password"
                      : "Show password"
                  }
                  onClick={() =>
                    setShowConfirmPassword(
                      !showConfirmPassword
                    )
                  }
                >

                  {showConfirmPassword ? (
                    <EyeOff size={18} />
                  ) : (
                    <Eye size={18} />
                  )}

                </button>

              </div>

            </div>


            {/* =================================================
                PASSWORD ERROR
            ================================================= */}

            {passwordError && (
              <p
                className="auth-error"
                role="alert"
              >
                {passwordError}
              </p>
            )}


            {/* =================================================
                TANSTACK ERROR
            ================================================= */}

            {registerMutation.isError && (
              <p
                className="auth-error"
                role="alert"
              >
                {registerMutation.error instanceof Error
                  ? registerMutation.error.message
                  : "Registration failed. Please try again."}
              </p>
            )}


            {/* =================================================
                REGISTER BUTTON
            ================================================= */}

            <button
              type="submit"
              className="travel-button"
              disabled={registerMutation.isPending}
            >

              <span>
                {registerMutation.isPending
                  ? "Creating account..."
                  : "Create account"}
              </span>

              {!registerMutation.isPending && (
                <ArrowRight size={18} />
              )}

            </button>

          </form>


          {/* =====================================================
              DIVIDER
          ===================================================== */}

          <div className="divider">

            <span />

            <p>
              or continue with
            </p>

            <span />

          </div>


          {/* =====================================================
              SOCIAL BUTTONS
          ===================================================== */}

          <div className="social-buttons">

            <button
              type="button"
              onClick={() => {
                console.log(
                  "Google registration - testing only"
                );
              }}
            >

              <span className="google-g">
                G
              </span>

              Google

            </button>


            <button
              type="button"
              onClick={() => {
                console.log(
                  "Apple registration - testing only"
                );
              }}
            >

              <svg
                className="apple-mark"
                width="15"
                height="15"
                viewBox="0 0 384 512"
                fill="currentColor"
              >

                <path d="M318.7 268.7c-.2-36.7 16.4-64.4 50-84.8-18.8-26.9-47.2-41.7-84.7-44.6-35.5-2.8-74.3 20.7-88.5 20.7-15 0-49.4-19.7-76.4-19.7C63.3 141 4 184.8 4 273.5q0 39.3 14.4 81.2c12.8 36.7 59 126.7 107.2 125.2 25.2-.6 43-17.9 75.8-17.9 31.8 0 48.3 17.9 76.4 17.9 48.6-.7 90.4-82.5 102.6-119.3-65.2-30.7-61.7-90-61.7-91.9zm-56.6-164.2c27.3-32.4 24.8-61.9 24-72.5-24.1 1.4-52 16.4-67.9 34.9-17.5 19.8-27.8 44.3-25.6 71.9 26.1 2 49.9-11.4 69.5-34.3z" />

              </svg>

              Apple

            </button>

          </div>


          {/* =====================================================
              LOGIN LINK
          ===================================================== */}

          <div className="signup-text">

            <span>
              Already have a FamPlanner account?
            </span>

            <Link to="/login">

              Sign in

              <ArrowRight size={14} />

            </Link>

          </div>


          {/* =====================================================
              SECURITY
          ===================================================== */}

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