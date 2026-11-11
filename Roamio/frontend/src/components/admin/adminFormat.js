// Number and period-comparison helpers the admin screens share.

export const RANGES = [7, 30, 90];

export const number = (value) => (value == null ? "—" : new Intl.NumberFormat().format(value));

// +12% / -8% against the period before; null when there was nothing before to compare with
export function change(value, previous) {
  if (previous == null) return null;
  if (previous === 0) return value === 0 ? { tone: "flat", text: "no change" } : { tone: "up", text: "new" };
  const pct = Math.round(((value - previous) / previous) * 100);
  return { tone: pct > 0 ? "up" : pct < 0 ? "down" : "flat", text: pct === 0 ? "no change" : `${pct > 0 ? "+" : ""}${pct}%` };
}

// Saves text (e.g. CSV) as a file download
export function downloadText(filename, text, type = "text/csv") {
  const url = URL.createObjectURL(new Blob([text], { type }));
  Object.assign(document.createElement("a"), { href: url, download: filename }).click();
  URL.revokeObjectURL(url);
}
