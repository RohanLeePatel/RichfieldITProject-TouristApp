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
