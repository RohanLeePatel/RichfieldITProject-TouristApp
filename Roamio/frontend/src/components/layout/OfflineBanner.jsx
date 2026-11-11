import { useSyncExternalStore } from "react";

import { getStaleSince } from "../../api/client";

const subscribe = (cb) => {
  for (const e of ["online", "offline", "roamio:stale"]) window.addEventListener(e, cb);
  return () => {
    for (const e of ["online", "offline", "roamio:stale"]) window.removeEventListener(e, cb);
  };
};

function ago(t) {
  const mins = Math.max(1, Math.round((Date.now() - t) / 60000));
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.round(mins / 60);
  return hours < 48 ? `${hours} h ago` : `${Math.round(hours / 24)} days ago`;
}

// Shown while the browser has no connection: pages still show the last data
// they loaded (api/client.js), but changes can't be saved.
export default function OfflineBanner() {
  const online = useSyncExternalStore(subscribe, () => navigator.onLine);
  const since = useSyncExternalStore(subscribe, getStaleSince);
  if (online) return null;
  return (
    <div
      role="status"
      style={{ position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 9999, padding: "8px 16px", textAlign: "center", background: "#92400e", color: "#fff", fontSize: 14 }}
    >
      You're offline. Showing your last saved data{since ? ` (saved ${ago(since)})` : ""}, read only.
    </div>
  );
}
