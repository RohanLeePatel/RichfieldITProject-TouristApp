import { useState } from "react";

const STORAGE_KEY = "roamio-trip-theme";

// Saved choice wins, else the OS preference. localStorage can throw (private
// windows, blocked storage) so both reads and writes are guarded - the page
// just falls back to following the OS setting.
function initialTheme() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === "light" || saved === "dark") return saved;
  } catch {
    // ignore
  }
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export default function useTheme() {
  const [theme, setTheme] = useState(initialTheme);
  const toggle = () =>
    setTheme((current) => {
      const next = current === "dark" ? "light" : "dark";
      try {
        localStorage.setItem(STORAGE_KEY, next);
      } catch {
        // ignore
      }
      return next;
    });
  return { theme, toggle };
}
