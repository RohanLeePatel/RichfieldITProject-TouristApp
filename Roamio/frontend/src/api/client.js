// Shared fetch helper for the Node/Express backend (auth, trips, itinerary).
// The FastAPI ai-features service is separate and uses its own base URL +
// node-secretkey header - see api/recommendations.js and api/weather.js.

const API_BASE_URL =
  import.meta.env.VITE_BACKEND_API_URL || "http://127.0.0.1:3000";

// The access token lives in memory only (P-03 / 4.8.1): script injected into the
// page cannot read it from storage. A reload starts without one and trades the
// httpOnly refresh cookie for a new one (ensureToken).
let accessToken = null;
export const getToken = () => accessToken;
export const setToken = (token) => {
  accessToken = token || null;
};
// Older builds kept the token in localStorage; clear what they left behind.
try {
  localStorage.removeItem("Roamio_token");
} catch {
  // blocked storage - nothing to clear
}
// Only the dev server, with nobody signed in, uses the fake local trip store.
export const isDevBypass = () => import.meta.env.DEV && !accessToken && !localStorage.getItem("user");

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
      setToken(data.accessToken);
      return true;
    })
    .catch(() => false)
    .finally(() => {
      refreshing = null;
    });
  return refreshing;
}

// The token to send: the one in memory, else one from the refresh cookie.
export async function ensureToken() {
  if (!accessToken) await refreshSession();
  return accessToken;
}

// Offline read-only: the last good response of each signed-in GET is kept so the
// app can still show it with no connection. Dropped on every sign-out.
const CACHE_PREFIX = "roamio_cache:";
const cacheKey = (path) => {
  try {
    const userId = JSON.parse(localStorage.getItem('user'))?.id;
    return userId == null ? null : `${CACHE_PREFIX}${userId}:${path}`;
  } catch {
    return null;
  }
};
let cacheGeneration = 0;

// When the oldest copy shown from the cache was saved; the offline banner reads it.
let staleSince = null;
export const getStaleSince = () => staleSince;

export function clearApiCache() {
  cacheGeneration += 1;
  // saved document files (tripDocuments.js) are personal too
  if ("caches" in window) caches.delete("roamio-docs").catch(() => {});
  if ("caches" in window) caches.delete("roamio-tiles-v1").catch(() => {});
  try {
    for (const key of Object.keys(localStorage)) if (key.startsWith(CACHE_PREFIX)) localStorage.removeItem(key);
  } catch {
    // blocked storage - nothing to clear
  }
}

// Discard older, unscoped API/document caches when this privacy fix first loads.
clearApiCache();

// Tells the API to drop the refresh cookie on sign-out; best effort.
export function endSession() {
  clearApiCache();
  fetch(apiUrl("/api/auth/logout"), { method: "POST", credentials: "include" }).catch(() => {});
}

async function request(path, { auth = false, retried = false, headers, ...options } = {}) {
  const requestHeaders = { "Content-Type": "application/json", ...headers };
  const isRead = auth && options.cache !== "no-store" && (!options.method || options.method === "GET");
  const persistentRead = isRead && !/^\/api\/(?:admin|users|auth|chat|translate)(?:\/|$)/.test(path);
  const savedKey = persistentRead ? cacheKey(path) : null;
  const generation = cacheGeneration;

  if (auth) {
    const token = await ensureToken();
    if (token) {
      requestHeaders.Authorization = `Bearer ${token}`;
    }
  }

  // include: the login response sets the refresh cookie on the API's domain
  let response;
  try {
    response = await fetch(apiUrl(path), { ...options, headers: requestHeaders, credentials: "include" });
  } catch {
    if (savedKey && generation === cacheGeneration) {
      try {
        const cached = localStorage.getItem(savedKey);
        if (cached) {
          const { t, d } = JSON.parse(cached);
          staleSince = staleSince ? Math.min(staleSince, t) : t;
          window.dispatchEvent(new Event("roamio:stale"));
          return d;
        }
      } catch {
        // no usable cached copy - fall through to the error
      }
    }
    throw Object.assign(new Error("We can't reach Roamio right now. Check your connection and try again."), { status: 0 });
  }

  // a download (the admin CSV export) comes back as text, not JSON
  if (response.ok && response.headers.get("content-type")?.startsWith("text/csv")) return response.text();

  let data = null;
  try {
    data = await response.json();
  } catch {
    // No JSON body (e.g. a 204) - leave data as null.
  }

  // Expired access token: refresh once and retry. If the session can't be
  // refreshed (signed out, cookie blocked by the browser), sign out and come
  // back here after logging in.
  if (auth && response.status === 401) {
    if (!retried && (await refreshSession())) {
      return request(path, { auth, retried: true, headers, ...options });
    }
    setToken(null);
    clearApiCache();
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
      { status: response.status, data }
    );
  }

  if (savedKey && generation === cacheGeneration && data !== null && !/\bno-store\b/i.test(response.headers.get('cache-control') || '')) {
    try {
      localStorage.setItem(savedKey, JSON.stringify({ t: Date.now(), d: data }));
    } catch {
      // storage full or blocked - just no offline copy of this one
    }
  }

  return data;
}

export function apiFetch(path, options) {
  return request(path, options);
}

export function authedFetch(path, options) {
  return request(path, { ...options, auth: true });
}
