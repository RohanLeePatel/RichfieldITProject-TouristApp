import { useState } from "react";
import { ArrowRight, Mail } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";

import AuthShell from "../components/auth/AuthShell.jsx";
import FieldError from "../components/FieldError.jsx";
import { sendPasswordCode } from "../api/account.js";
import { emailError, MAX_EMAIL } from "../utils/validation.js";

export default function ForgotPassword() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [fieldError, setFieldError] = useState("");

  const { mutate, isPending, error } = useMutation({ mutationFn: sendPasswordCode });

  const handleSubmit = (e) => {
    e.preventDefault();
    const trimmed = email.trim();
    const problem = emailError(trimmed);
    setFieldError(problem);
    if (problem) return;

    // The API answers the same whether or not the account exists, so always move on.
    mutate(trimmed, {
      onSuccess: () => navigate("/reset-password", { state: { email: trimmed, sent: true } }),
    });
  };

  return (
    <AuthShell
      eyebrow="FORGOT PASSWORD"
      title="Reset your password"
      subtitle="Enter your account email and we'll send you a 6-digit code."
    >
      <form onSubmit={handleSubmit} noValidate>
        <div className="input-group">
          <label htmlFor="forgot-email">Email address</label>
          <div className="input-box">
            <Mail size={18} />
            <input
              id="forgot-email"
              type="email"
              name="email"
              placeholder="you@example.com"
              autoComplete="email"
              value={email}
              maxLength={MAX_EMAIL}
              aria-invalid={Boolean(fieldError)}
              aria-describedby={fieldError ? "forgot-email-error" : undefined}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <FieldError id="forgot-email-error" message={fieldError} />
        </div>

        {error && (
          <p style={{ color: "#e05252", fontSize: "0.75rem", lineHeight: "1.5", margin: "0 0 10px" }}>
            {error.message || "Couldn't send the code. Please try again."}
          </p>
        )}

        <button type="submit" className="travel-button" disabled={isPending}>
          <span>{isPending ? "Sending..." : "Send reset code"}</span>
          {!isPending && <ArrowRight size={18} />}
        </button>
      </form>

      <div className="signup-text">
        <span>Already have a code?</span>
        <Link to="/reset-password">
          Enter it
          <ArrowRight size={14} />
        </Link>
      </div>
    </AuthShell>
  );
}
