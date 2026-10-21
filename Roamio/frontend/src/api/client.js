// Shared fetch helper for the Node/Express backend (auth, trips, itinerary).
// The FastAPI ai-features service is separate and uses its own base URL +
// node-secretkey header - see api/recommendations.js and api/weather.js.

const API_BASE_URL =
  import.meta.env.VITE_BACKEND_API_URL || "http://127.0.0.1:3000";

export const TOKEN_KEY = "Roamio_token";

async function request(path, { auth = false, headers, ...options } = {}) {
  const requestHeaders = { "Content-Type": "application/json", ...headers };

  if (auth) {
    const token = localStorage.getItem(TOKEN_KEY);
    if (token) {
      requestHeaders.Authorization = `Bearer ${token}`;
    }
  }

  const response = await fetch(
    `${API_BASE_URL.replace(/\/$/, "")}${path}`,
    { ...options, headers: requestHeaders }
  );

  let data = null;
  try {
    data = await response.json();
  } catch {
    // No JSON body (e.g. a 204) - leave data as null.
  }

  // The access token lasts 15 minutes and can't be refreshed from this site
  // (the refresh cookie is SameSite=Strict on another domain), so an expired
  // session signs out and comes back here after logging in.
  if (auth && response.status === 401 && localStorage.getItem(TOKEN_KEY)) {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem("user");
    const here = window.location.pathname + window.location.search;
    window.location.assign(`/login?next=${encodeURIComponent(here)}`);
  }

  if (!response.ok) {
    // routes send { message } or { error: "..." }; the global error handler
    // sends { error: { message } }
    throw new Error(
      data?.message ||
        data?.error?.message ||
        (typeof data?.error === "string" ? data.error : null) ||
        "Request failed. Please try again."
    );
  }

  return data;
}

export function apiFetch(path, options) {
  return request(path, options);
}

export function authedFetch(path, options) {
  return request(path, { ...options, auth: true });
}
