import { useSyncExternalStore } from "react";

const subscribe = (cb) => {
  window.addEventListener("online", cb);
  window.addEventListener("offline", cb);
  return () => {
    window.removeEventListener("online", cb);
    window.removeEventListener("offline", cb);
  };
};

// Shown while the browser has no connection: pages still show the last data
// they loaded (api/client.js), but changes can't be saved.
export default function OfflineBanner() {
  const online = useSyncExternalStore(subscribe, () => navigator.onLine);
  if (online) return null;
  return (
    <div
      role="status"
      style={{ position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 9999, padding: "8px 16px", textAlign: "center", background: "#92400e", color: "#fff", fontSize: 14 }}
    >
      You're offline. Showing your last saved data, read only.
    </div>
  );
}
