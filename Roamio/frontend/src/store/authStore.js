import { create } from "zustand";

import { endSession, getToken, setToken } from "../api/client";
import { disablePush } from "../services/push.js";
import { clearAllDrafts } from "../utils/plannerDraft.js";

const USER_KEY = "user";

// Profile edits made in Settings (name, photo), kept during this signed-in
// session. Logout clears these personal details along with USER_KEY.
const PROFILES_KEY = "roamio_profiles_v1";

function profileId(user) {
  return String(user?.id ?? user?.email ?? "").toLowerCase();
}

function loadProfiles() {
  try {
    return JSON.parse(localStorage.getItem(PROFILES_KEY)) || {};
  } catch {
    return {};
  }
}

// The server sends `fullName`; pages read `name`. Fill both, then lay any
// saved Settings edits on top.
function withProfile(user) {
  if (!user) return user;

  const profile = loadProfiles()[profileId(user)] || {};
  const name = profile.name || user.name || user.fullName || "";

  return { ...user, ...profile, name, fullName: name };
}

// Restore the session on page load/refresh - without this the store always
// started logged-out, so every refresh bounced you back to /login.
function savedSession() {
  try {
    const user = JSON.parse(localStorage.getItem(USER_KEY));
    // the token itself is memory-only: the first request trades the refresh cookie for one
    if (user) return { user: withProfile(user), isAuthenticated: true };
  } catch {
    // corrupt/blocked storage - fall through to logged out
  }
  return { user: null, isAuthenticated: false };
}

function startSession(set, userData, token) {
  const user = withProfile(userData);

  localStorage.setItem(
    USER_KEY,
    JSON.stringify(user)
  );

  if (token) {
    setToken(token);
  }

  set({
    user,
    isAuthenticated: true,
  });
}

export const useAuthStore = create((set, get) => ({
  ...savedSession(),

  login: (userData, token) => startSession(set, userData, token),

  register: (userData, token) => startSession(set, userData, token),

  // Saves Settings edits during the current session, including page reloads.
  // Throws if storage is full - the caller shows the error.
  updateProfile: ({ name, email, photo }) => {
    const current =
      get().user ||
      JSON.parse(localStorage.getItem(USER_KEY) || "{}");

    const profiles = loadProfiles();
    profiles[profileId(current)] = { name, email, photo };
    localStorage.setItem(PROFILES_KEY, JSON.stringify(profiles));

    const user = { ...current, name, fullName: name, email, photo };
    localStorage.setItem(USER_KEY, JSON.stringify(user));

    set({ user });
  },

  logout: ({ accountDeleted = false } = {}) => {
    disablePush(getToken()).catch(() => {}); // a signed-out browser must not keep receiving this user's alerts
    endSession(); // drop the 7-day refresh cookie too: a signed-out browser keeps no session
    localStorage.removeItem(USER_KEY);
    clearAllDrafts();
    // per-user data a shared device must not keep after sign-out
    try {
      // Names, email addresses and photos must not survive sign-out on a shared device.
      void accountDeleted;
      localStorage.removeItem(PROFILES_KEY);
      for (const key of Object.keys(localStorage)) {
        if (key.startsWith("roamio-settings:") || key === "roamio_standalone_calendar_events" || key === "roamio_active_trip") {
          localStorage.removeItem(key);
        }
      }
    } catch {
      // blocked storage - nothing to clear
    }
    setToken(null);

    set({
      user: null,
      isAuthenticated: false,
    });
  },
}));
