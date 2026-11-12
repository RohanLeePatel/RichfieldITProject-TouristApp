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

import FieldError from "../components/FieldError.jsx";
import TurnstileWidget, { captchaEnabled } from "../components/TurnstileWidget.jsx";
import { emailError, MAX_EMAIL, MAX_PASSWORD, nameError, passwordError, passwordStrength } from "../utils/validation.js";

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

  const strength = passwordStrength(password);
  const [fieldErrors, setFieldErrors] = useState({});
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  // sign-up CAPTCHA (only when configured); resetKey asks the widget for a new token
  const [captchaToken, setCaptchaToken] = useState("");
  const [captchaReset, setCaptchaReset] = useState(0);

  // Set once the account is created: the page then asks for the emailed code.
  // This is local state, so a page reload starts sign-up again. The account already
  // exists but is unverified, and signing up again with the same email resumes it.
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

  // Checks the form in the browser so most mistakes are caught before a request is
  // sent. The server still re-checks everything, so these checks are a convenience,
  // not a security boundary.
  const handleSubmit = (e) => {
    e.preventDefault();

    const trimmedName = name.trim();
    const trimmedEmail = email.trim();

    const found = {};
    const nameProblem = nameError(trimmedName, "your full name");
    if (nameProblem) found.name = nameProblem;
    const emailProblem = emailError(trimmedEmail);
    if (emailProblem) found.email = emailProblem;
    const passwordProblem = passwordError(password);
    if (passwordProblem) found.password = passwordProblem;
    if (!confirmPassword) found.confirmPassword = "Type your password again to confirm it.";
    else if (password !== confirmPassword) found.confirmPassword = "Passwords do not match.";
    if (!acceptedTerms) found.terms = "Tick the box to agree to the Terms and Privacy Policy.";
    if (captchaEnabled && !captchaToken) found.captcha = "Complete the verification check above.";
    setFieldErrors(found);
    if (Object.keys(found).length) return;

    registerUser(
      {
        name: trimmedName,
        email: trimmedEmail,
        password,
        acceptedTerms,
        captchaToken,
      },
      {
        onSuccess: ({ email: registeredEmail, devOtp }) => {
          setPendingEmail(registeredEmail || trimmedEmail);
          // only sent by a backend running with ENABLE_DEV_OTP=true
          if (devOtp) setCode(devOtp);
        },
        // a token is single-use: any refusal needs a fresh challenge before retrying
        onError: () => {
          if (captchaEnabled) setCaptchaReset((n) => n + 1);
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
                  <FieldError
                    id="register-code-error"
                    message={code.length > 0 && code.length < 6 ? `Enter all 6 digits - you've typed ${code.length}.` : ""}
                  />
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

          <form onSubmit={handleSubmit} noValidate>
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
                  aria-invalid={Boolean(fieldErrors.name)}
                  aria-describedby={fieldErrors.name ? "register-name-error" : undefined}
                  onChange={(e) =>
                    setName(e.target.value)
                  }
                  required
                />
              </div>
              <FieldError id="register-name-error" message={fieldErrors.name} />
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
                  maxLength={MAX_EMAIL}
                  aria-invalid={Boolean(fieldErrors.email)}
                  aria-describedby={fieldErrors.email ? "register-email-error" : undefined}
                  onChange={(e) =>
                    setEmail(e.target.value)
                  }
                  required
                />
              </div>
              <FieldError id="register-email-error" message={fieldErrors.email} />
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
                  maxLength={MAX_PASSWORD}
                  aria-invalid={Boolean(fieldErrors.password)}
                  aria-describedby={fieldErrors.password ? "register-password-error" : undefined}
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
              {password && (
                <div className="pw-meter" aria-live="polite">
                  <div className="pw-bar">
                    {[1, 2, 3, 4].map((n) => (
                      <span key={n} className={n <= strength.score ? `on s${strength.score}` : ""} />
                    ))}
                  </div>
                  <strong className={`pw-label s${strength.score}`}>
                    {["", "Weak", "Fair", "Good", "Strong"][strength.score]}
                  </strong>
                  <ul className="pw-rules">
                    {strength.rules.map((r) => (
                      <li key={r.text} className={r.ok ? "ok" : ""}>{r.ok ? "✓" : "○"} {r.text}</li>
                    ))}
                  </ul>
                </div>
              )}
              <FieldError id="register-password-error" message={fieldErrors.password} />
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
                  maxLength={MAX_PASSWORD}
                  aria-invalid={Boolean(fieldErrors.confirmPassword)}
                  aria-describedby={fieldErrors.confirmPassword ? "register-confirm-error" : undefined}
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
              <FieldError id="register-confirm-error" message={fieldErrors.confirmPassword} />
            </div>

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
                {error?.message ||
                  "Registration failed. Please try again."}
              </p>
            )}

            {/* TERMS AND PRIVACY */}

            <div className="input-group terms-check">
              <label htmlFor="register-terms">
                <input
                  id="register-terms"
                  type="checkbox"
                  checked={acceptedTerms}
                  aria-invalid={Boolean(fieldErrors.terms)}
                  aria-describedby={fieldErrors.terms ? "register-terms-error" : undefined}
                  onChange={(e) => setAcceptedTerms(e.target.checked)}
                />
                <span>
                  I agree to the{" "}
                  <Link to="/terms" target="_blank" rel="noopener noreferrer">Terms and Conditions</Link>{" "}
                  and the{" "}
                  <Link to="/privacy" target="_blank" rel="noopener noreferrer">Privacy Policy</Link>.
                </span>
              </label>
              <FieldError id="register-terms-error" message={fieldErrors.terms} />
            </div>

            {/* CAPTCHA (only when VITE_TURNSTILE_SITE_KEY is set) */}

            {captchaEnabled && (
              <div className="input-group">
                <TurnstileWidget
                  resetKey={captchaReset}
                  onToken={(token) => {
                    setCaptchaToken(token);
                    if (token) setFieldErrors((current) => ({ ...current, captcha: undefined }));
                  }}
                />
                <FieldError id="register-captcha-error" message={fieldErrors.captcha} />
              </div>
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