// Settings API: notifications, sessions, travellers, data export,
// account deletion and support reports.
//
// Every call goes to the Spring Boot backend first. If an endpoint isn't
// there yet (404 / 405 / 501, or the dev server answering with index.html),
// the read/write falls back to this browser so the page still works while
// the backend catches up. Each result says where it came from
// ({ data, source: "server" | "device" }) so the UI can be honest about it.
//
// The endpoint contract is in SETTINGS_API.md.

import { useAuthStore } from "../store/authStore.js";

const API_BASE = String(import.meta.env?.VITE_API_URL || "").replace(/\/+$/, "");

// Change this to your real support inbox
export const SUPPORT_EMAIL = "support@roamio.app";

export class EndpointMissingError extends Error {
  constructor(path) {
    super(`No server endpoint for ${path} yet`);
    this.name = "EndpointMissingError";
  }
}

/* ---------------- request helper ---------------- */

function safeGet(key) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

// Match this to however api/account.js attaches the JWT
function authHeaders() {
  let token = null;
  try {
    const state = useAuthStore.getState?.() || {};
    token = state.token || state.accessToken || state.user?.token || null;
  } catch {
    token = null;
  }
  token = token || safeGet("token") || safeGet("accessToken");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function request(path, { method = "GET", body, expect = "json" } = {}) {
  let response;

  try {
    response = await fetch(`${API_BASE}${path}`, {
      method,
      credentials: "include",
      headers: {
        Accept: expect === "blob" ? "*/*" : "application/json",
        ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
        ...authHeaders(),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new Error("We couldn't reach Roamio. Check your connection and try again.");
  }

  if ([404, 405, 501].includes(response.status)) {
    throw new EndpointMissingError(path);
  }

  const type = response.headers.get("content-type") || "";

  if (!response.ok) {
    let message = "";
    if (type.includes("json")) {
      try {
        const data = await response.json();
        message = data?.message || data?.error || "";
      } catch {
        message = "";
      }
    }
    if (response.status === 401 || response.status === 403) {
      message = message || "Your session has expired. Please sign in again.";
    }
    throw new Error(message || `Something went wrong (error ${response.status}). Please try again.`);
  }

  // a dev server without an /api proxy answers unknown routes with index.html
  if (type.includes("text/html")) {
    throw new EndpointMissingError(path);
  }

  if (expect === "blob") return response;
  if (response.status === 204) return null;

  const text = await response.text();
  return text ? JSON.parse(text) : null;
}

async function withFallback(serverCall, deviceCall) {
  try {
    return { data: await serverCall(), source: "server" };
  } catch (error) {
    if (error instanceof EndpointMissingError) {
      return { data: await deviceCall(), source: "device" };
    }
    throw error;
  }
}

/* ---------------- on-device fallback store ---------------- */

const keyFor = (email) => `roamio-settings:${String(email || "guest").toLowerCase()}`;

function readLocal(email) {
  try {
    return JSON.parse(localStorage.getItem(keyFor(email))) || {};
  } catch {
    return {};
  }
}

function writeLocal(email, patch) {
  const next = { ...readLocal(email), ...patch };
  try {
    localStorage.setItem(keyFor(email), JSON.stringify(next));
  } catch {
    throw new Error("This browser's storage is full, so we couldn't save that.");
  }
  return next;
}

export function clearLocalSettings(email) {
  try {
    localStorage.removeItem(keyFor(email));
  } catch {
    // nothing to clear
  }
}

/* ---------------- notifications ---------------- */

export const NOTIFICATION_TOPICS = [
  "bookingConfirmations",
  "travelUpdates",
  "flightChanges",
  "accommodationChanges",
];

export const DEFAULT_NOTIFICATIONS = {
  channels: { email: true, browser: false },
  topics: Object.fromEntries(
    NOTIFICATION_TOPICS.map((topic) => [topic, { email: true, browser: true }])
  ),
};

function mergeNotifications(saved) {
  const source = saved && typeof saved === "object" ? saved : {};
  return {
    channels: { ...DEFAULT_NOTIFICATIONS.channels, ...(source.channels || {}) },
    topics: Object.fromEntries(
      NOTIFICATION_TOPICS.map((topic) => [
        topic,
        { ...DEFAULT_NOTIFICATIONS.topics[topic], ...(source.topics?.[topic] || {}) },
      ])
    ),
  };
}

export const getNotificationPrefs = (email) =>
  withFallback(
    async () => mergeNotifications(await request("/api/users/me/notification-preferences")),
    () => mergeNotifications(readLocal(email).notifications)
  );

export const saveNotificationPrefs = (email, prefs) =>
  withFallback(
    async () =>
      mergeNotifications(
        (await request("/api/users/me/notification-preferences", { method: "PUT", body: prefs })) || prefs
      ),
    () => mergeNotifications(writeLocal(email, { notifications: prefs }).notifications)
  );

/* ---------------- sessions & login activity ---------------- */

// Session: { id, browser, os, deviceType, location, ipAddress, lastActiveAt, current }
export const listSessions = () =>
  withFallback(async () => (await request("/api/users/me/sessions")) || [], () => []);

// Activity: { id, at, browser, os, deviceType, location, ipAddress, success }
export const listLoginActivity = () =>
  withFallback(async () => (await request("/api/users/me/login-activity")) || [], () => []);

export const revokeSession = (id) =>
  request(`/api/users/me/sessions/${encodeURIComponent(id)}`, { method: "DELETE" });

export const revokeOtherSessions = () =>
  request("/api/users/me/sessions/others", { method: "DELETE" });

/* ---------------- saved travellers ---------------- */

const newId = () =>
  globalThis.crypto?.randomUUID?.() ||
  `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

export const listTravellers = (email) =>
  withFallback(
    async () => (await request("/api/users/me/travellers")) || [],
    () => readLocal(email).travellers || []
  );

export const saveTraveller = (email, traveller) => {
  const { id, ...body } = traveller;

  return withFallback(
    () =>
      id
        ? request(`/api/users/me/travellers/${encodeURIComponent(id)}`, { method: "PUT", body })
        : request("/api/users/me/travellers", { method: "POST", body }),
    () => {
      // passport / ID numbers never go into browser storage
      const { documentNumber: _omit, ...safe } = traveller;
      const list = readLocal(email).travellers || [];
      const saved = { ...safe, id: id || newId(), updatedAt: new Date().toISOString() };
      const next = id ? list.map((item) => (item.id === id ? saved : item)) : [...list, saved];
      writeLocal(email, { travellers: next });
      return saved;
    }
  );
};

export const deleteTraveller = (email, id) =>
  withFallback(
    () => request(`/api/users/me/travellers/${encodeURIComponent(id)}`, { method: "DELETE" }),
    () => {
      const list = readLocal(email).travellers || [];
      writeLocal(email, { travellers: list.filter((item) => item.id !== id) });
      return null;
    }
  );

/* ---------------- download personal data ---------------- */

function saveBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// buildFallback() assembles the export in the browser if the server can't
export async function downloadMyData(buildFallback) {
  const stamp = new Date().toISOString().slice(0, 10);

  try {
    const response = await request("/api/users/me/export", { expect: "blob" });
    const blob = await response.blob();
    const isZip = (response.headers.get("content-type") || "").includes("zip");
    saveBlob(blob, `roamio-my-data-${stamp}.${isZip ? "zip" : "json"}`);
    return "server";
  } catch (error) {
    if (!(error instanceof EndpointMissingError)) throw error;
  }

  const data = await buildFallback();
  saveBlob(
    new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }),
    `roamio-my-data-${stamp}.json`
  );
  return "device";
}

/* ---------------- delete account ---------------- */

export async function deleteAccount(email) {
  try {
    await request("/api/users/me", { method: "DELETE", body: { confirmation: "DELETE" } });
  } catch (error) {
    if (error instanceof EndpointMissingError) {
      throw new Error(
        `Account deletion isn't available online yet. Email ${SUPPORT_EMAIL} from your account address and we'll delete it for you.`
      );
    }
    throw error;
  }
  clearLocalSettings(email);
}

/* ---------------- report a problem ---------------- */

export async function reportProblem(report) {
  try {
    const result = await request("/api/support/reports", { method: "POST", body: report });
    return { source: "server", reference: result?.reference || result?.id || null };
  } catch (error) {
    if (!(error instanceof EndpointMissingError)) throw error;
  }

  // no endpoint yet: hand the report to the user's email app instead
  const lines = [report.description, ""];
  if (report.context) {
    lines.push("---", ...Object.entries(report.context).map(([key, value]) => `${key}: ${value}`));
  }
  window.location.href = `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(
    `[${report.category}] ${report.subject}`
  )}&body=${encodeURIComponent(lines.join("\n"))}`;
  return { source: "email", reference: null };
}
