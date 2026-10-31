import { apiFetch } from "../api/client";

/* =========================================================
   REGISTER
========================================================= */

// Creates the account and emails a 6-digit code; no session until it's verified.
// devOtp is only present when the backend runs with ENABLE_DEV_OTP=true.
export async function registerUser({ fullName, email, password, acceptedTerms }) {
  const result = await apiFetch("/api/auth/register", {
    method: "POST",
    body: JSON.stringify({ email, password, fullName, acceptedTerms }),
  });

  return { email: result.email, devOtp: result.devOtp };
}

/* =========================================================
   EMAIL VERIFICATION (2FA at sign-up)
========================================================= */

export async function verifyEmail({ email, otp }) {
  const result = await apiFetch("/api/auth/verify-otp", {
    method: "POST",
    body: JSON.stringify({ email, otp }),
  });

  return { user: result.user, token: result.token };
}

export async function resendVerificationCode({ email }) {
  await apiFetch("/api/auth/resend-otp", {
    method: "POST",
    body: JSON.stringify({ email }),
  });
}

/* =========================================================
   LOGIN
========================================================= */

export async function loginUser({ email, password }) {
  const result = await apiFetch("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });

  return { user: result.user, token: result.token };
}
