import { create } from "zustand";

import { endSession, TOKEN_KEY } from "../api/client";

const USER_KEY = "user";

// Profile edits made in Settings (name, photo). Kept apart from USER_KEY,
// which logout deletes and login overwrites with the server's user - storing
// the photo there meant it vanished on every sign-out.
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
    if (user && localStorage.getItem(TOKEN_KEY)) return { user: withProfile(user), isAuthenticated: true };
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
    localStorage.setItem(TOKEN_KEY, token);
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

  // Saves Settings edits so they survive signing out and back in.
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

  logout: () => {
    endSession(); // drop the 7-day refresh cookie too: a signed-out browser keeps no session
    localStorage.removeItem(USER_KEY);
    localStorage.removeItem(TOKEN_KEY);

    set({
      user: null,
      isAuthenticated: false,
    });
  },
}));