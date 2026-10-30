// Shared fetch helper for the Node/Express backend (auth, trips, itinerary).
// The FastAPI ai-features service is separate and uses its own base URL +
// node-secretkey header - see api/recommendations.js and api/weather.js.

const API_BASE_URL =
  import.meta.env.VITE_BACKEND_API_URL || "http://127.0.0.1:3000";

export const TOKEN_KEY = "Roamio_token";

const apiUrl = (path) => `${API_BASE_URL.replace(/\/$/, "")}${path}`;

// The access token lasts 15 minutes; the httpOnly refresh cookie (set at
// login, 7 days) trades for a new one. Requests that 401 together share one
// refresh.
let refreshing = null;
function refreshSession() {
  refreshing ||= fetch(apiUrl("/api/auth/refresh"), { method: "POST", credentials: "include" })
    .then((response) => (response.ok ? response.json() : null))
    .then((data) => {
      if (!data?.accessToken) return false;
      localStorage.setItem(TOKEN_KEY, data.accessToken);
      return true;
    })
    .catch(() => false)
    .finally(() => {
      refreshing = null;
    });
  return refreshing;
}

// Tells the API to drop the refresh cookie on sign-out; best effort.
export function endSession() {
  fetch(apiUrl("/api/auth/logout"), { method: "POST", credentials: "include" }).catch(() => {});
}

async function request(path, { auth = false, retried = false, headers, ...options } = {}) {
  const requestHeaders = { "Content-Type": "application/json", ...headers };

  if (auth) {
    const token = localStorage.getItem(TOKEN_KEY);
    if (token) {
      requestHeaders.Authorization = `Bearer ${token}`;
    }
  }

  // include: the login response sets the refresh cookie on the API's domain
  const response = await fetch(apiUrl(path), { ...options, headers: requestHeaders, credentials: "include" });

  let data = null;
  try {
    data = await response.json();
  } catch {
    // No JSON body (e.g. a 204) - leave data as null.
  }

  // Expired access token: refresh once and retry. If the session can't be
  // refreshed (signed out, cookie blocked by the browser), sign out and come
  // back here after logging in.
  if (auth && response.status === 401 && localStorage.getItem(TOKEN_KEY)) {
    if (!retried && (await refreshSession())) {
      return request(path, { auth, retried: true, headers, ...options });
    }
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem("user");
    const here = window.location.pathname + window.location.search;
    window.location.assign(`/login?next=${encodeURIComponent(here)}`);
  }

  if (!response.ok) {
    // routes send { message } or { error: "..." }; the global error handler
    // sends { error: { message } }
    // status lets callers tell a 403 (e.g. not an admin) from other failures
    throw Object.assign(
      new Error(
        data?.message ||
          data?.error?.message ||
          (typeof data?.error === "string" ? data.error : null) ||
          "Request failed. Please try again."
      ),
      { status: response.status }
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
