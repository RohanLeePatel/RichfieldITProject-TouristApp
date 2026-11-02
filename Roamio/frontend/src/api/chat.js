import { authedFetch } from "./client";

// -> { conversationId, reply }
export function sendChatMessage({ message, conversationId, tripId }) {
  return authedFetch("/api/chat", {
    method: "POST",
    body: JSON.stringify({ message, conversationId, tripId }),
  });
}

// The traveller said yes to a proposal from the assistant. -> { reply, added, expense, tripId }
export function confirmChatAction({ conversationId, name, args }) {
  return authedFetch("/api/chat/confirm", {
    method: "POST",
    body: JSON.stringify({ conversationId, name, args }),
  });
}

// -> { conversations: [{ id, title, tripId, updatedAt }] }
export function listConversations() {
  return authedFetch("/api/chat/conversations");
}

// -> { conversation: { id, title, tripId, messages: [{ id, role, content }] } }
export function getConversation(id) {
  return authedFetch(`/api/chat/conversations/${id}`);
}

export function deleteConversation(id) {
  return authedFetch(`/api/chat/conversations/${id}`, { method: "DELETE" });
}
