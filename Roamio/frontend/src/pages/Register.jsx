import { useState } from "react";

import {
  ArrowLeft,
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

import { Link, useLocation, useNavigate } from "react-router-dom";
import { nextPath } from "../utils/nextPath.js";

import {
  useRegister,
  useVerifyEmail,
  useResendCode,
} from "../hooks/useRegister";

import "../styles/auth.css";

export default function Register() {
  const navigate = useNavigate();
  const location = useLocation();

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [passwordError, setPasswordError] = useState("");

  // Set once the account is created: the page then asks for the emailed code
  const [pendingEmail, setPendingEmail] = useState("");
  const [code, setCode] = useState("");
  const [codeNotice, setCodeNotice] = useState(null); // { text, isError }

  const {
    mutate: registerUser,
    isPending,
    error,
  } = useRegister();

  const {
    mutate: verifyEmail,
    isPending: isVerifying,
    error: verifyError,
  } = useVerifyEmail();

  const {
    mutate: resendCode,
    isPending: isResending,
  } = useResendCode();

  const handleVerify = (e) => {
    e.preventDefault();

    setCodeNotice(null);

    verifyEmail(
      { email: pendingEmail, otp: code.trim() },
      {
        onSuccess: () => {
          navigate(nextPath(location.search));
        },
      }
    );
  };

  const handleResend = () => {
    setCodeNotice(null);

    resendCode(
      { email: pendingEmail },
      {
        onSuccess: () => setCodeNotice({ text: "A new code is on its way.", isError: false }),
        onError: (err) => setCodeNotice({ text: err.message, isError: true }),
      }
    );
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    setPasswordError("");

    const trimmedName = name.trim();
    const trimmedEmail = email.trim();

    if (!trimmedName) {
      setPasswordError("Please enter your full name.");
      return;
    }

    if (trimmedName.length > 80) {
      setPasswordError("Keep your name under 80 characters.");
      return;
    }

    if (!trimmedEmail) {
      setPasswordError("Please enter your email address.");
      return;
    }

    if (password !== confirmPassword) {
      setPasswordError("Passwords do not match.");
      return;
    }

    if (password.length < 8) {
      setPasswordError("Password must be at least 8 characters.");
      return;
    }

    registerUser(
      {
        name: trimmedName,
        email: trimmedEmail,
        password,
      },
      {
        onSuccess: ({ email: registeredEmail, devOtp }) => {
          setPendingEmail(registeredEmail || trimmedEmail);
          // only sent by a backend running with ENABLE_DEV_OTP=true
          if (devOtp) setCode(devOtp);
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

        {/* CONTENT */}

        <div className="travel-content">
          <div className="mini-badge">
            <Sparkles size={14} />

            SMART GROUP TRAVEL
          </div>

          <h1>
            Start your group&apos;s
            <br />
            next great
            <br />
            <span>adventure.</span>
          </h1>

          <p>
            Create your Roamio account and plan a trip your whole
            group agrees on.
          </p>

          <div className="travel-features">
            <div className="travel-feature">
              <div className="feature-icon teal">
                <Users size={16} />
              </div>

              <span>Plan together</span>
            </div>

            <div className="travel-feature">
              <div className="feature-icon blue">
                <Plane size={16} />
              </div>

              <span>Travel together</span>
            </div>

            <div className="travel-feature">
              <div className="feature-icon purple">
                <Sparkles size={16} />
              </div>

              <span>Keep it in one place</span>
            </div>
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

        <div className="auth-card">
          {/* ICON */}

          <div className="logo-icon card-variant">
            <Plane size={21} />
          </div>

          {pendingEmail ? (
            <>
              {/* VERIFY EMAIL */}

              <div className="auth-title">
                <span className="auth-eyebrow">
                  VERIFY EMAIL
                </span>

                <h2>Check your inbox</h2>

                <p>
                  We sent a 6-digit code to <strong>{pendingEmail}</strong>.
                  It expires in 10 minutes.
                </p>
              </div>

              <form onSubmit={handleVerify}>
                <div className="input-group">
                  <label htmlFor="register-code">
                    Verification code
                  </label>

                  <div className="input-box">
                    <LockKeyhole size={18} />

                    <input
                      id="register-code"
                      type="text"
                      name="code"
                      placeholder="123456"
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      pattern="\d{6}"
                      maxLength={6}
                      value={code}
                      onChange={(e) =>
                        setCode(e.target.value.replace(/\D/g, ""))
                      }
                      required
                    />
                  </div>
                </div>

                {(verifyError || codeNotice) && (
                  <p
                    style={{
                      color: codeNotice && !codeNotice.isError ? "inherit" : "#e05252",
                      fontSize: "0.75rem",
                      lineHeight: "1.5",
                      margin: "0 0 10px",
                    }}
                  >
                    {codeNotice?.text || verifyError?.message}
                  </p>
                )}

                <button
                  type="submit"
                  className="travel-button"
                  disabled={isVerifying || code.length !== 6}
                >
                  <span>
                    {isVerifying
                      ? "Verifying..."
                      : "Verify and continue"}
                  </span>

                  {!isVerifying && (
                    <ArrowRight size={18} />
                  )}
                </button>
              </form>

              <div className="signup-text signup-text-wrap">
                <span>Didn't get it?</span>

                <button
                  type="button"
                  className="link-button"
                  onClick={handleResend}
                  disabled={isResending}
                >
                  {isResending ? "Sending..." : "Send a new code"}
                </button>

                <button
                  type="button"
                  className="link-button"
                  onClick={() => {
                    setPendingEmail("");
                    setCode("");
                    setCodeNotice(null);
                  }}
                >
                  Use a different email
                </button>
              </div>
            </>
          ) : (
          <>
          {/* TITLE */}

          <div className="auth-title">
            <span className="auth-eyebrow">
              CREATE ACCOUNT
            </span>

            <h2>Join Roamio</h2>

            <p>
              Create your account and start planning
              your next group trip.
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
                  name="fullName"
                  placeholder="Your full name"
                  autoComplete="name"
                  maxLength={80}
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
                  name="password"
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
                    setShowPassword(
                      (current) => !current
                    )
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
                  name="confirmPassword"
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
                      (current) => !current
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
                  fontSize: "0.75rem",
                  lineHeight: "1.5",
                  margin: "0 0 10px",
                }}
              >
                {passwordError ||
                  error?.message ||
                  "Registration failed. Please try again."}
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
          </>
          )}

          {/* LOGIN */}

          <div className="signup-text">
            <span>
              Already have a Roamio account?
            </span>

            <Link to={`/login${location.search}`}>
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