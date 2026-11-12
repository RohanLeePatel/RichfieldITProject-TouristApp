import { create } from "zustand";

import { fetchTrips } from "../api/trips.js";
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

export const useTripStore = create((set, get) => ({
  trips: [],
  loaded: false,
  error: "",
  activeTripId: readActive(),

  // Ordinary loads share a request. Forced refreshes wait for any older
  // request so it cannot overwrite the newer offline copy.
  load: (force = false) => {
    if (!force && loading) return loading;
    if (!force && get().loaded) return Promise.resolve();
    const request = (loading || Promise.resolve())
      .then(() => loading === request && fetchTrips())
      .then((trips) => {
        if (loading === request) {
          set({ trips: Array.isArray(trips) ? trips : [], loaded: true, error: "" });
        }
      })
      // A failed load stays "not loaded": pages keep their loading state instead of
      // telling someone with trips that they have none, and it is tried again.
      .catch((error) => {
        if (loading !== request) return;
        set({ error: error instanceof Error ? error.message : "Could not load trips." });
        // ponytail: fixed 5s retry while the tab is open; back off if this ever hammers the API
        // and only while online (the "online" listener below covers coming back)
        if (typeof navigator !== "undefined" && navigator.onLine === false) return;
        setTimeout(() => useAuthStore.getState().isAuthenticated && get().load(), 5000);
      })
      .finally(() => {
        if (loading === request) loading = null;
      });
    loading = request;
    return request;
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

useAuthStore.subscribe((session, previous) => {
  if (session.isAuthenticated === previous.isAuthenticated && session.user?.id === previous.user?.id) return;
  loading = null;
  useTripStore.setState({ trips: [], loaded: false, error: "", activeTripId: null });
});

// A load that failed while offline is not retried on a timer; try again when the connection returns.
if (typeof window !== "undefined") {
  window.addEventListener("online", () => {
    const { loaded, error, load } = useTripStore.getState();
    if (!loaded && error && useAuthStore.getState().isAuthenticated) load();
  });
}

// The trip to show when none is chosen: the soonest one that hasn't ended,
// else the most recently created.
export function defaultTrip(trips) {
  const now = Date.now();
  const live = trips
    .filter((trip) => trip.startDate && new Date(trip.endDate || trip.startDate).getTime() >= now)
    .sort((a, b) => new Date(a.startDate) - new Date(b.startDate));
  return live[0] || trips[0] || null;
}
