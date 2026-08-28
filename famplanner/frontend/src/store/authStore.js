import { create } from "zustand";

const USER_KEY = "user";
const TOKEN_KEY = "Roamio_token";

export const useAuthStore = create((set) => ({
  user: null,
  isAuthenticated: false,

  login: (userData) => {
    localStorage.setItem(
      USER_KEY,
      JSON.stringify(userData)
    );

    localStorage.setItem(
      TOKEN_KEY,
      `frontend-token-${userData.id}`
    );

    set({
      user: userData,
      isAuthenticated: true,
    });
  },

  register: (userData) => {
    localStorage.setItem(
      USER_KEY,
      JSON.stringify(userData)
    );

    localStorage.setItem(
      TOKEN_KEY,
      `frontend-token-${userData.id}`
    );

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