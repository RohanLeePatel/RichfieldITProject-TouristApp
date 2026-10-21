import { authedFetch } from "./client";

// { notifications: [{ id, title, message, type, isRead, createdAt }], unreadCount }
export function fetchNotifications() {
  return authedFetch("/api/notifications?limit=20");
}

export function markAllNotificationsRead() {
  return authedFetch("/api/notifications/read-all", { method: "PATCH" });
}
