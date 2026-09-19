import { create } from "zustand";

import { TOKEN_KEY } from "../api/client";

const USER_KEY = "user";

// Restore the session on page load/refresh - without this the store always
// started logged-out, so every refresh bounced you back to /login.
function savedSession() {
  try {
    const user = JSON.parse(localStorage.getItem(USER_KEY));
    if (user && localStorage.getItem(TOKEN_KEY)) return { user, isAuthenticated: true };
  } catch {
    // corrupt/blocked storage - fall through to logged out
  }
  return { user: null, isAuthenticated: false };
}

export const useAuthStore = create((set) => ({
  ...savedSession(),

  login: (userData, token) => {
    localStorage.setItem(
      USER_KEY,
      JSON.stringify(userData)
    );

    if (token) {
      localStorage.setItem(TOKEN_KEY, token);
    }

    set({
      user: userData,
      isAuthenticated: true,
    });
  },

  register: (userData, token) => {
    localStorage.setItem(
      USER_KEY,
      JSON.stringify(userData)
    );

    if (token) {
      localStorage.setItem(TOKEN_KEY, token);
    }

    set({
      user: userData,
      isAuthenticated: true,
    });
  },

  logout: () => {
    localStorage.removeItem(USER_KEY);
    localStorage.removeItem(TOKEN_KEY);

    set({
      user: null,
      isAuthenticated: false,
    });
  },
}));