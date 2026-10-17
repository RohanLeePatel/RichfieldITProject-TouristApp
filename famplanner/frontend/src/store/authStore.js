import { create } from "zustand";

export const useAuthStore = create((set) => ({
  // Current logged-in user
  user: null,

  // Authentication status
  isAuthenticated: false,

  // Login user
  login: (userData) => {
    set({
      user: userData,
      isAuthenticated: true,
    });
  },

  // Register user
  register: (userData) => {
    set({
      user: userData,
      isAuthenticated: true,
    });
  },

  // Logout user
  logout: () => {
    set({
      user: null,
      isAuthenticated: false,
    });
  },
}));