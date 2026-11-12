import { create } from "zustand";

import { fetchTrips } from "../api/trips";
import { useAuthStore } from "./authStore.js";

// The trip the whole app is "about" right now. Weather, the translator, the
// calendar and the trip hub all read it, so a destination and dates typed once
// in the wizard follow you everywhere (Phase 3, W1/W2). The choice survives a
// refresh via localStorage; a ?trip= link overrides it (see useActiveTrip).
const ACTIVE_KEY = "roamio_active_trip";

function readActive() {
  try {
    return localStorage.getItem(ACTIVE_KEY);
  } catch {
    return null;
  }
}

let loading = null;

export const useTripStore = create((set) => ({
  trips: [],
  loaded: false,
  error: "",
  activeTripId: readActive(),

  // one request however many components ask; `force` after a create/delete
  load: (force = false) => {
    if (loading) return loading;
    if (!force && useTripStore.getState().loaded) return Promise.resolve();
    loading = fetchTrips()
      .then((trips) => set({ trips, loaded: true, error: "" }))
      // A failed load stays "not loaded": pages keep their loading state instead of
      // telling someone with trips that they have none, and it is tried again.
      .catch((error) => {
        set({ error: error instanceof Error ? error.message : "Could not load trips." });
        // ponytail: fixed 5s retry while the tab is open; back off if this ever hammers the API
        setTimeout(() => useAuthStore.getState().isAuthenticated && useTripStore.getState().load(), 5000);
      })
      .finally(() => {
        loading = null;
      });
    return loading;
  },

  setActiveTrip: (id) => {
    const value = id == null ? null : String(id);
    try {
      if (value) localStorage.setItem(ACTIVE_KEY, value);
      else localStorage.removeItem(ACTIVE_KEY);
    } catch {
      // storage blocked - the choice just won't survive a refresh
    }
    set({ activeTripId: value });
  },
}));

// The trip to show when none is chosen: the soonest one that hasn't ended,
// else the most recently created.
export function defaultTrip(trips) {
  const now = Date.now();
  const live = trips
    .filter((trip) => trip.startDate && new Date(trip.endDate || trip.startDate).getTime() >= now)
    .sort((a, b) => new Date(a.startDate) - new Date(b.startDate));
  return live[0] || trips[0] || null;
}
