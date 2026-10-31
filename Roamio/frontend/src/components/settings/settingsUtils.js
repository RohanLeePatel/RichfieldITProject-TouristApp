// Small formatting helpers shared by the settings sections

export function describeDevice(userAgent) {
  const ua = String(userAgent ?? (typeof navigator !== "undefined" ? navigator.userAgent : ""));

  let browser = "Browser";
  if (/Edg\//.test(ua)) browser = "Edge";
  else if (/OPR\/|Opera/.test(ua)) browser = "Opera";
  else if (/SamsungBrowser/.test(ua)) browser = "Samsung Internet";
  else if (/Firefox\//.test(ua)) browser = "Firefox";
  else if (/Chrome\//.test(ua)) browser = "Chrome";
  else if (/Safari\//.test(ua)) browser = "Safari";

  let os = "Unknown system";
  if (/Windows NT/.test(ua)) os = "Windows";
  else if (/Android/.test(ua)) os = "Android";
  else if (/iPhone|iPad|iPod/.test(ua)) os = "iOS";
  else if (/CrOS/.test(ua)) os = "ChromeOS";
  else if (/Mac OS X/.test(ua)) os = "macOS";
  else if (/Linux/.test(ua)) os = "Linux";

  const deviceType = /iPad|Tablet/.test(ua)
    ? "tablet"
    : /Mobi|iPhone|Android/.test(ua)
      ? "mobile"
      : "desktop";

  return { browser, os, deviceType };
}

export function deviceLabel(item = {}) {
  const browser = item.browser || "Unknown browser";
  return item.os ? `${browser} on ${item.os}` : browser;
}

const toDate = (value) => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

export function formatDate(value, options = { day: "numeric", month: "short", year: "numeric" }) {
  const date = toDate(value);
  return date ? new Intl.DateTimeFormat(undefined, options).format(date) : "";
}

export function formatDateTime(value) {
  return formatDate(value, {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function timeAgo(value) {
  const date = toDate(value);
  if (!date) return "";

  const seconds = Math.round((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return "Just now";

  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;

  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hr ago`;

  const days = Math.round(hours / 24);
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days} days ago`;

  return formatDate(date);
}

export function ageFrom(dateOfBirth) {
  const dob = toDate(dateOfBirth);
  if (!dob) return null;

  const now = new Date();
  let age = now.getFullYear() - dob.getFullYear();
  const beforeBirthday =
    now.getMonth() < dob.getMonth() ||
    (now.getMonth() === dob.getMonth() && now.getDate() < dob.getDate());

  if (beforeBirthday) age -= 1;
  return age;
}

export function monthsUntil(value) {
  const date = toDate(value);
  if (!date) return null;
  return (date.getTime() - Date.now()) / (1000 * 60 * 60 * 24 * 30.44);
}

export function lastFour(traveller = {}) {
  if (traveller.documentLast4) return String(traveller.documentLast4);
  const raw = String(traveller.documentNumber || "").replace(/\s+/g, "");
  return raw ? raw.slice(-4) : "";
}

export function initialsOf(name = "", fallback = "U") {
  const parts = String(name).trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return fallback;
  return parts
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");
}

// 0 = empty, 1 too short ... 4 strong
export function passwordStrength(password = "") {
  if (!password) return { score: 0, label: "" };
  if (password.length < 8) return { score: 1, label: "Too short" };

  let points = 0;
  if (password.length >= 12) points += 1;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) points += 1;
  if (/\d/.test(password)) points += 1;
  if (/[^A-Za-z0-9]/.test(password)) points += 1;

  if (points <= 1) return { score: 2, label: "Weak" };
  if (points === 2) return { score: 3, label: "Good" };
  return { score: 4, label: "Strong" };
}

export const isEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(value).trim());
