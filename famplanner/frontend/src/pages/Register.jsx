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
  Heart,
  User,
} from "lucide-react";

import { Link, useNavigate } from "react-router-dom";

import { useRegister } from "../hooks/useRegister";

import "../styles/auth.css";

export default function Register() {
  const navigate = useNavigate();

  const [showPassword, setShowPassword] =
    useState(false);

  const [showConfirmPassword, setShowConfirmPassword] =
    useState(false);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] =
    useState("");

  const [passwordError, setPasswordError] =
    useState("");

  const {
    mutate: registerUser,
    isPending,
    error,
  } = useRegister();

  const handleSubmit = (e) => {
    e.preventDefault();

    setPasswordError("");

    if (password !== confirmPassword) {
      setPasswordError(
        "Passwords do not match."
      );
      return;
    }

    if (password.length < 6) {
      setPasswordError(
        "Password must be at least 6 characters."
      );
      return;
    }

    registerUser(
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

      {/* LEFT SIDE */}

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
            Fam<span className="logo-blue">
              Planner
            </span>
          </span>

        </div>

        {/* CONTENT */}

        <div className="travel-content">

          <div className="mini-badge">

            <Sparkles size={14} />

            SMART FAMILY TRAVEL

          </div>

          <h1>

            Start your family's

            <br />

            next great

            <br />

            <span>adventure.</span>

          </h1>

          <p>
            Create your FamPlanner account and start
            organizing unforgettable family adventures.
          </p>

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
                <Plane size={16} />
              </div>

              <span>
                Travel together
              </span>

            </div>

            <div className="travel-feature">

              <div className="feature-icon purple">
                <Sparkles size={16} />
              </div>

              <span>
                Create memories
              </span>

            </div>

          </div>

        </div>

        {/* FOOTER */}

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

      {/* RIGHT */}

      <section className="auth-panel">

        <div className="panel-dots" />
        <div className="panel-blob" />
        <div className="panel-glow" />

        <div className="auth-card">

          {/* ICON */}

          <div className="logo-icon card-variant">

            <Plane size={21} />

          </div>

          {/* TITLE */}

          <div className="auth-title">

            <span className="auth-eyebrow">
              CREATE ACCOUNT
            </span>

            <h2>
              Join FamPlanner
            </h2>

            <p>
              Create your account and start planning
              your next family adventure.
            </p>

          </div>

          {/* FORM */}

          <form onSubmit={handleSubmit}>

            {/* NAME */}

            <div className="input-group">

              <label htmlFor="register-name">
                Full name
              </label>

              <div className="input-box">

                <User size={18} />

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
                  onClick={() =>
                    setShowPassword(!showPassword)
                  }
                  aria-label={
                    showPassword
                      ? "Hide password"
                      : "Show password"
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
                    setConfirmPassword(
                      e.target.value
                    )
                  }
                  required
                />

                <button
                  type="button"
                  className="password-toggle"
                  onClick={() =>
                    setShowConfirmPassword(
                      !showConfirmPassword
                    )
                  }
                  aria-label={
                    showConfirmPassword
                      ? "Hide password"
                      : "Show password"
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

            {/* ERROR */}

            {(passwordError || error) && (
              <p
                style={{
                  color: "#e05252",
                  fontSize: "12px",
                  marginBottom: "10px",
                }}
              >
                {passwordError ||
                  error?.message ||
                  "Registration failed"}
              </p>
            )}

            {/* REGISTER BUTTON */}

            <button
              type="submit"
              className="travel-button"
              disabled={isPending}
            >

              <span>
                {isPending
                  ? "Creating account..."
                  : "Create account"}
              </span>

              {!isPending && (
                <ArrowRight size={18} />
              )}

            </button>

          </form>

          {/* LOGIN */}

          <div className="signup-text">

            <span>
              Already have a FamPlanner account?
            </span>

            <Link to="/login">

              Sign in

              <ArrowRight size={14} />

            </Link>

          </div>

          {/* SECURITY */}

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