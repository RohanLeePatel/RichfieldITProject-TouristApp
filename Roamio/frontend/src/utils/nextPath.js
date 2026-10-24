// Where to go after signing in: ?next=/invite/abc, if it's a path on this
// site. Anything else ("//evil.com", "https://...") falls back to the dashboard.
export function nextPath(search) {
  const next = new URLSearchParams(search).get("next") || "";
  return next.startsWith("/") && !next.startsWith("//") && !next.startsWith("/\\") ? next : "/dashboard";
}
