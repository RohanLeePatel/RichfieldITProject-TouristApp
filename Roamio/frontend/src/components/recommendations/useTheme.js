import { useSyncExternalStore } from "react";

// One app-wide theme. Every page that calls useTheme() reads the same value,
// so switching it in Settings (or any page's toggle) updates them all, and the
// `storage` event keeps other open tabs in step too.
const STORAGE_KEY = "roamio-theme";
// keys used before the theme was shared - read once so nobody loses their choice
const OLD_KEYS = ["roamio-trip-theme", "settings-theme"];

const listeners = new Set();

const isTheme = (value) => value === "light" || value === "dark";

// Saved choice wins, else light - dark mode only when the user picks it (the
// OS setting is ignored). localStorage can throw (private windows, blocked
// storage) so reads and writes are guarded - the app just stays light.
function readSaved() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (isTheme(saved)) return saved;
    for (const key of OLD_KEYS) {
      const old = localStorage.getItem(key);
      if (isTheme(old)) return old;
    }
  } catch {
    // ignore
  }
  return "light";
}

let current = readSaved();

// lets plain (non-themed) CSS and the browser UI follow the theme as well
function applyToDocument(theme) {
  if (typeof document === "undefined") return;
  document.documentElement.dataset.theme = theme;
  document.documentElement.style.colorScheme = theme;
}

applyToDocument(current);

function emit() {
  applyToDocument(current);
  listeners.forEach((listener) => listener());
}

export function setTheme(theme) {
  if (!isTheme(theme) || theme === current) return;
  current = theme;
  try {
    localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    // ignore
  }
  emit();
}

function subscribe(listener) {
  listeners.add(listener);

  const onStorage = (event) => {
    if (event.key === STORAGE_KEY && isTheme(event.newValue) && event.newValue !== current) {
      current = event.newValue;
      emit();
    }
  };
  window.addEventListener("storage", onStorage);

  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

const getSnapshot = () => current;

export default function useTheme() {
  const theme = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  const toggle = () => setTheme(current === "dark" ? "light" : "dark");
  return { theme, toggle, setTheme };
}
