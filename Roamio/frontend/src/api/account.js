import { apiFetch, authedFetch } from "./client";

// The signed-in user's profile + preferences (currency, language, theme...).
export function fetchMe() {
  return authedFetch("/api/auth/users/me");
}

// Records that the signed-in user agreed to the Terms and Privacy Policy now in force.
export function acceptTerms() {
  return authedFetch("/api/auth/users/me/terms", { method: "POST" });
}

// Only fullName, avatarUrl and preferences are accepted by the server.
export function updateMe({ fullName, preferences }) {
  return authedFetch("/api/auth/users/me", {
    method: "PATCH",
    body: JSON.stringify({ fullName, preferences }),
  });
}

// Password changes go through the emailed-code reset flow, so the real
// account password is the one that changes.
export function sendPasswordCode(email) {
  return apiFetch("/api/auth/forgot-password", { method: "POST", body: JSON.stringify({ email }) });
}

export function resetPassword({ email, otp, newPassword }) {
  return apiFetch("/api/auth/reset-password", {
    method: "POST",
    body: JSON.stringify({ email, otp, newPassword }),
  });
}
