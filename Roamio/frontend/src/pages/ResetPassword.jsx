import { useState } from "react";
import { ArrowRight, Eye, EyeOff, LockKeyhole, Mail } from "lucide-react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";

import AuthShell from "../components/auth/AuthShell.jsx";
import FieldError from "../components/FieldError.jsx";
import { resetPassword, sendPasswordCode } from "../api/account.js";
import { emailError, MAX_EMAIL, MAX_PASSWORD, passwordError } from "../utils/validation.js";

export default function ResetPassword() {
  const navigate = useNavigate();
  const location = useLocation();
  const initialEmail = location.state?.email || new URLSearchParams(location.search).get("email") || "";

  const [email, setEmail] = useState(initialEmail);
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [fieldErrors, setFieldErrors] = useState({});
  const [notice, setNotice] = useState(
    location.state?.sent ? { text: "If that account exists, a code is on its way. It expires in 10 minutes.", isError: false } : null
  );

  const { mutate, isPending, error } = useMutation({ mutationFn: resetPassword });
  const { mutate: resend, isPending: isResending } = useMutation({ mutationFn: sendPasswordCode });

  const handleSubmit = (e) => {
    e.preventDefault();
    setNotice(null);

    const found = {};
    const emailProblem = emailError(email);
    if (emailProblem) found.email = emailProblem;
    if (!/^\d{6}$/.test(code)) found.code = "Enter the 6-digit code from your email.";
    const passwordProblem = passwordError(password, "new password");
    if (passwordProblem) found.password = passwordProblem;
    if (!confirmPassword) found.confirmPassword = "Type your new password again to confirm it.";
    else if (password !== confirmPassword) found.confirmPassword = "Passwords do not match.";
    setFieldErrors(found);
    if (Object.keys(found).length) return;

    mutate(
      { email: email.trim(), otp: code, newPassword: password },
      {
        onSuccess: () => navigate("/login", { replace: true }),
      }
    );
  };

  const handleResend = () => {
    const problem = emailError(email);
    if (problem) {
      setFieldErrors((current) => ({ ...current, email: problem }));
      return;
    }
    setNotice(null);
    resend(email.trim(), {
      onSuccess: () => setNotice({ text: "If that account exists, a new code is on its way.", isError: false }),
      onError: (err) => setNotice({ text: err.message || "Couldn't send a new code.", isError: true }),
    });
  };

  return (
    <AuthShell
      eyebrow="RESET PASSWORD"
      title="Choose a new password"
      subtitle="Enter the 6-digit code we emailed you and pick a new password."
    >
      <form onSubmit={handleSubmit} noValidate>
        <div className="input-group">
          <label htmlFor="reset-email">Email address</label>
          <div className="input-box">
            <Mail size={18} />
            <input
              id="reset-email"
              type="email"
              name="email"
              placeholder="you@example.com"
              autoComplete="email"
              value={email}
              maxLength={MAX_EMAIL}
              aria-invalid={Boolean(fieldErrors.email)}
              aria-describedby={fieldErrors.email ? "reset-email-error" : undefined}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <FieldError id="reset-email-error" message={fieldErrors.email} />
        </div>

        <div className="input-group">
          <label htmlFor="reset-code">Reset code</label>
          <div className="input-box">
            <LockKeyhole size={18} />
            <input
              id="reset-code"
              type="text"
              name="code"
              placeholder="123456"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              value={code}
              aria-invalid={Boolean(fieldErrors.code)}
              aria-describedby={fieldErrors.code ? "reset-code-error" : undefined}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
              required
            />
          </div>
          <FieldError id="reset-code-error" message={fieldErrors.code} />
        </div>

        <div className="input-group">
          <label htmlFor="reset-password">New password</label>
          <div className="input-box">
            <LockKeyhole size={18} />
            <input
              id="reset-password"
              type={showPassword ? "text" : "password"}
              name="newPassword"
              placeholder="At least 8 characters"
              autoComplete="new-password"
              value={password}
              maxLength={MAX_PASSWORD}
              aria-invalid={Boolean(fieldErrors.password)}
              aria-describedby={fieldErrors.password ? "reset-password-error" : undefined}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            <button
              type="button"
              className="password-toggle"
              aria-label={showPassword ? "Hide password" : "Show password"}
              onClick={() => setShowPassword((current) => !current)}
            >
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
          <FieldError id="reset-password-error" message={fieldErrors.password} />
        </div>

        <div className="input-group">
          <label htmlFor="reset-confirm">Confirm new password</label>
          <div className="input-box">
            <LockKeyhole size={18} />
            <input
              id="reset-confirm"
              type={showPassword ? "text" : "password"}
              name="confirmPassword"
              placeholder="Type it again"
              autoComplete="new-password"
              value={confirmPassword}
              maxLength={MAX_PASSWORD}
              aria-invalid={Boolean(fieldErrors.confirmPassword)}
              aria-describedby={fieldErrors.confirmPassword ? "reset-confirm-error" : undefined}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
            />
          </div>
          <FieldError id="reset-confirm-error" message={fieldErrors.confirmPassword} />
        </div>

        {(error || notice) && (
          <p
            style={{
              color: notice && !notice.isError && !error ? "inherit" : "#e05252",
              fontSize: "0.75rem",
              lineHeight: "1.5",
              margin: "0 0 10px",
            }}
          >
            {error?.message || notice?.text}
          </p>
        )}

        <button type="submit" className="travel-button" disabled={isPending}>
          <span>{isPending ? "Resetting..." : "Reset password"}</span>
          {!isPending && <ArrowRight size={18} />}
        </button>
      </form>

      <div className="signup-text signup-text-wrap">
        <span>Didn't get a code?</span>
        <button type="button" className="link-button" onClick={handleResend} disabled={isResending}>
          {isResending ? "Sending..." : "Send a new one"}
        </button>
      </div>

      <div className="signup-text">
        <span>Remembered it?</span>
        <Link to="/login">
          Sign in
          <ArrowRight size={14} />
        </Link>
      </div>
    </AuthShell>
  );
}
