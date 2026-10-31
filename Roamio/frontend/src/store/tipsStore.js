import { create } from "zustand";

import { useAuthStore } from "./authStore.js";

// What each user has dismissed or done, kept in this browser only (tips just
// show again on a new device). Flags: "tip:<id>" = a hint was dismissed,
// "checklist" = the Get started card was hidden, "done:<step>" = a step the
// app can't work out from the user's data (e.g. tried the assistant).
const KEY = "roamio_tips_v1";
const EMPTY = {};

const read = () => {
  try {
    return JSON.parse(localStorage.getItem(KEY)) || {};
  } catch {
    return {};
  }
};

const write = (all) => {
  try {
    localStorage.setItem(KEY, JSON.stringify(all));
  } catch {
    // storage blocked - tips just come back next visit
  }
};

const useTipsStore = create((set) => ({
  all: read(),
  mark: (userKey, flag) =>
    set((state) => {
      const all = { ...state.all, [userKey]: { ...state.all[userKey], [flag]: true } };
      write(all);
      return { all };
    }),
  // "Show tips again": brings back hints and the checklist, keeps the done steps
  reset: (userKey) =>
    set((state) => {
      const kept = Object.fromEntries(Object.entries(state.all[userKey] || {}).filter(([flag]) => flag.startsWith("done:")));
      const all = { ...state.all, [userKey]: kept };
      write(all);
      return { all };
    }),
}));

export default function useTips() {
  const userKey = useAuthStore((state) => String(state.user?.id ?? state.user?.email ?? "guest"));
  const flags = useTipsStore((state) => state.all[userKey]) || EMPTY;
  const mark = useTipsStore((state) => state.mark);
  const reset = useTipsStore((state) => state.reset);

  return {
    has: (flag) => Boolean(flags[flag]),
    mark: (flag) => mark(userKey, flag),
    reset: () => reset(userKey),
  };
}
