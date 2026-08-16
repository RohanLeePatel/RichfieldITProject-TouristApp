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
  User,
} from "lucide-react";

import { Link, useNavigate } from "react-router-dom";

import "../styles/auth.css";

export default function Register() {

  const [showPassword, setShowPassword] =
    useState(false);

  const [showConfirm, setShowConfirm] =
    useState(false);

  const navigate = useNavigate();


  // =====================================================
  // REGISTER
  // Temporary testing version
  // No real account creation yet
  // =====================================================

  const handleSubmit = (
    e: React.FormEvent<HTMLFormElement>
  ) => {

    e.preventDefault();

    // For now, simply take the user to the dashboard.
    navigate("/dashboard");

  };


  return (
    <div className="auth-page">


      {/* =====================================================
          LEFT SIDE — FAMPLANNER TRAVEL EXPERIENCE
      ===================================================== */}

      <section className="travel-panel">


        {/* Decorative background */}

        <div className="hero-overlay" />

        <div className="hero-dots" />


        {/* Decorative circles */}

        <div className="travel-circle travel-circle-one" />

        <div className="travel-circle travel-circle-two" />


        {/* ===================================================
            LOGO
        =================================================== */}

        <div className="logo">

          <div className="logo-icon">

            <Plane size={20} />

          </div>

          <span className="logo-word">

            Fam
            <span className="logo-blue">
              Planner
            </span>

          </span>

        </div>


        {/* ===================================================
            MAIN CONTENT
        =================================================== */}

        <div className="travel-content">


          {/* Badge */}

          <div className="mini-badge">

            <Sparkles size={14} />

            START YOUR ADVENTURE

          </div>


          {/* Heading */}

          <h1>

            More trips.

            <br />

            More laughter.

            <br />

            <span>
              More memories.
            </span>

          </h1>


          {/* Description */}

          <p>

            Bring your family together and make planning
            your next adventure easier, smarter and more enjoyable.

          </p>


          {/* =================================================
              FEATURES
          ================================================= */}

          <div className="travel-features">


            {/* Feature 1 */}

            <div className="travel-feature">

              <div className="feature-icon teal">

                <Users size={16} />

              </div>

              <span>
                Bring everyone together
              </span>

            </div>


            {/* Feature 2 */}

            <div className="travel-feature">

              <div className="feature-icon blue">

                <Map size={16} />

              </div>

              <span>
                Discover amazing places
              </span>

            </div>


            {/* Feature 3 */}

            <div className="travel-feature">

              <div className="feature-icon purple">

                <Sparkles size={16} />

              </div>

              <span>
                Make every trip count
              </span>

            </div>

          </div>

        </div>


        {/* ===================================================
            JOURNEY DECORATION
        =================================================== */}

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


        {/* ===================================================
            FOOTER
        =================================================== */}

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
          RIGHT SIDE — REGISTER PANEL
      ===================================================== */}

      <section className="auth-panel">


        {/* Decorative background */}

        <div className="panel-dots" />

        <div className="panel-blob" />

        <div className="panel-glow" />


        {/* ===================================================
            REGISTER CARD
        =================================================== */}

        <div className="auth-card register-card">


          {/* =================================================
              PLANE DECORATION
          ================================================= */}

          <div className="doodle-plane">

            <svg
              className="doodle-trail"
              viewBox="0 0 74 56"
              fill="none"
            >

              <path
                d="M4,50 C 24,54 34,26 62,14"
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


          {/* Card icon */}

          <div className="logo-icon card-variant">

            <Sparkles size={20} />

          </div>


          {/* =================================================
              TITLE
          ================================================= */}

          <div className="auth-title">

            <span className="auth-eyebrow">
              CREATE YOUR ACCOUNT
            </span>

            <h2>
              Let's start planning.
            </h2>

            <p>
              Create your FamPlanner account and start
              your next adventure.
            </p>

          </div>


          {/* =================================================
              REGISTER FORM
          ================================================= */}

          <form onSubmit={handleSubmit}>


            {/* =================================================
                FIRST + LAST NAME
            ================================================= */}

            <div className="name-fields">


              {/* FIRST NAME */}

              <div className="input-group">

                <label htmlFor="first-name">
                  First name
                </label>

                <div className="input-box">

                  <User size={17} />

                  <input
                    id="first-name"
                    type="text"
                    placeholder="First name"
                    autoComplete="given-name"
                    required
                  />

                </div>

              </div>


              {/* LAST NAME */}

              <div className="input-group">

                <label htmlFor="last-name">
                  Last name
                </label>

                <div className="input-box">

                  <User size={17} />

                  <input
                    id="last-name"
                    type="text"
                    placeholder="Last name"
                    autoComplete="family-name"
                    required
                  />

                </div>

              </div>

            </div>


            {/* =================================================
                EMAIL
            ================================================= */}

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
                  required
                />

              </div>

            </div>


            {/* =================================================
                PASSWORD
            ================================================= */}

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


            {/* =================================================
                CONFIRM PASSWORD
            ================================================= */}

            <div className="input-group">

              <label htmlFor="confirm-password">
                Confirm password
              </label>

              <div className="input-box">

                <LockKeyhole size={18} />

                <input
                  id="confirm-password"
                  type={
                    showConfirm
                      ? "text"
                      : "password"
                  }
                  placeholder="Repeat your password"
                  autoComplete="new-password"
                  required
                />


                <button
                  type="button"
                  className="password-toggle"
                  aria-label={
                    showConfirm
                      ? "Hide password"
                      : "Show password"
                  }
                  onClick={() =>
                    setShowConfirm(!showConfirm)
                  }
                >

                  {showConfirm ? (
                    <EyeOff size={18} />
                  ) : (
                    <Eye size={18} />
                  )}

                </button>

              </div>

            </div>


            {/* =================================================
                TERMS
            ================================================= */}

            <label className="terms-row">

              <input
                type="checkbox"
                required
              />

              <span>

                I agree to the{" "}

                <a
                  href="#"
                  onClick={(e) =>
                    e.preventDefault()
                  }
                >
                  Terms of Service
                </a>

                {" "}and{" "}

                <a
                  href="#"
                  onClick={(e) =>
                    e.preventDefault()
                  }
                >
                  Privacy Policy
                </a>

              </span>

            </label>


            {/* =================================================
                REGISTER BUTTON
            ================================================= */}

            <button
              type="submit"
              className="travel-button"
            >

              <span>
                Create my account
              </span>

              <ArrowRight size={18} />

            </button>

          </form>


          {/* ===================================================
              LOGIN LINK
          =================================================== */}

          <div className="signup-text">

            <span>
              Already have an account?
            </span>

            <Link to="/">

              Sign in

              <ArrowRight size={14} />

            </Link>

          </div>


          {/* ===================================================
              SECURITY MESSAGE
          =================================================== */}

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