import { create } from "zustand";

import { TOKEN_KEY } from "../api/client";

const USER_KEY = "user";

export const useAuthStore = create((set) => ({
  user: null,
  isAuthenticated: false,

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