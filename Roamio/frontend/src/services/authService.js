import { apiFetch } from "../api/client";

/* =========================================================
   REGISTER
========================================================= */

export async function registerUser({ fullName, email, password }) {
  const result = await apiFetch("/api/auth/register", {
    method: "POST",
    body: JSON.stringify({ email, password, fullName }),
  });

  return result.user;
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
