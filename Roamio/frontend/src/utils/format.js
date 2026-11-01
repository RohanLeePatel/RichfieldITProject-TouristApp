// South African display formats, shared so every screen reads the same.

// "R1,234.50"; other currencies get their own symbol ("US$45.00", "€45.00")
export function formatMoney(amount, currency = "ZAR") {
  const n = Number(amount);
  if (!Number.isFinite(n)) return "";
  const fixed = { minimumFractionDigits: 2, maximumFractionDigits: 2 };
  if (currency === "ZAR") return `${n < 0 ? "-" : ""}R${Math.abs(n).toLocaleString("en-GB", fixed)}`;
  try {
    return new Intl.NumberFormat("en-GB", { style: "currency", currency }).format(n);
  } catch {
    return `${currency} ${n.toFixed(2)}`;
  }
}

// "31 October 2026" (month: "short" for "31 Oct 2026"). Trip dates are stored
// as UTC midnight, so read them in UTC to keep the same day everywhere.
export function formatDate(iso, { month = "long" } = {}) {
  return new Date(iso).toLocaleDateString("en-ZA", { day: "numeric", month, year: "numeric", timeZone: "UTC" });
}

// "18:03:10", 24-hour like the rest of the app
export function formatTime(value) {
  return new Date(value).toLocaleTimeString("en-ZA", { hour12: false });
}
