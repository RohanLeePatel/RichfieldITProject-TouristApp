import { useEffect, useRef, useState } from "react";
import { Plus, Send, Trash2 } from "lucide-react";
import { Link } from "react-router-dom";

import { deleteConversation, getConversation, listConversations, sendChatMessage } from "../../api/chat.js";
import useActiveTrip from "../../hooks/useActiveTrip.js";
import "../../styles/chat.css";

// The assistant conversation, used by the floating widget and the /chat page.
// A new chat is about the active trip; an opened one keeps the trip it started
// with (the server decides, so the label below is only a hint).
export default function ChatPanel({ showHistory = false }) {
  const { trip } = useActiveTrip();
  const [messages, setMessages] = useState([]);
  const [conversationId, setConversationId] = useState(null);
  const [conversations, setConversations] = useState([]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const endRef = useRef(null);

  const refreshHistory = () => {
    if (!showHistory) return;
    listConversations()
      .then((data) => setConversations(data?.conversations || []))
      .catch(() => {});
  };

  useEffect(refreshHistory, [showHistory]);
  useEffect(() => {
    endRef.current?.scrollIntoView?.({ block: "end" });
  }, [messages, sending]);

  const startNew = () => {
    setConversationId(null);
    setMessages([]);
    setError("");
  };

  const open = async (id) => {
    setError("");
    try {
      const { conversation } = await getConversation(id);
      setConversationId(conversation.id);
      setMessages(conversation.messages);
    } catch (err) {
      setError(err.message);
    }
  };

  const remove = async (id) => {
    if (!window.confirm("Delete this conversation?")) return;
    try {
      await deleteConversation(id);
      if (id === conversationId) startNew();
      refreshHistory();
    } catch (err) {
      setError(err.message);
    }
  };

  const send = async (event) => {
    event.preventDefault();
    const message = draft.trim();
    if (!message || sending) return;
    setDraft("");
    setError("");
    setSending(true);
    setMessages((current) => [...current, { id: `local-${Date.now()}`, role: "user", content: message }]);
    try {
      const data = await sendChatMessage({ message, conversationId, tripId: trip?.id });
      setConversationId(data.conversationId);
      setMessages((current) => [
        ...current,
        { id: `reply-${Date.now()}`, role: "assistant", content: data.reply, itineraryTripId: data.added ? data.tripId : null },
      ]);
      refreshHistory();
    } catch (err) {
      setError(err.message);
      setDraft(message);
      setMessages((current) => current.slice(0, -1));
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="chat-panel">
      {showHistory && (
        <aside className="chat-history" aria-label="Past conversations">
          <button type="button" className="chat-new" onClick={startNew}>
            <Plus size={16} /> New chat
          </button>
          <ul>
            {conversations.map((c) => (
              <li key={c.id} className={c.id === conversationId ? "active" : ""}>
                <button type="button" onClick={() => open(c.id)}>{c.title}</button>
                <button type="button" className="chat-delete" onClick={() => remove(c.id)} aria-label={`Delete ${c.title}`}>
                  <Trash2 size={14} />
                </button>
              </li>
            ))}
          </ul>
        </aside>
      )}

      <section className="chat-main">
        <p className="chat-context">
          {conversationId ? "Continuing this chat" : trip ? `New chat about ${trip.title}` : "New chat - no trip selected"}
          {!showHistory && conversationId && (
            <button type="button" className="chat-link" onClick={startNew}>New chat</button>
          )}
        </p>

        <div className="chat-messages" role="log" aria-live="polite">
          {messages.length === 0 && (
            <p className="chat-empty">
              Ask about your itinerary, the safety advisory or travelling in general. Try: &quot;What is planned for day 2?&quot;
            </p>
          )}
          {messages.map((m) => (
            <p key={m.id} className={`chat-bubble ${m.role}`}>
              {m.content}
              {m.itineraryTripId && (
                <Link className="chat-bubble-link" to={`/trips/${m.itineraryTripId}`}>View itinerary</Link>
              )}
            </p>
          ))}
          {sending && <p className="chat-bubble assistant pending">Thinking...</p>}
          <div ref={endRef} />
        </div>

        {error && <p className="chat-error" role="alert">{error}</p>}

        <form className="chat-form" onSubmit={send}>
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            maxLength={2000}
            placeholder="Ask the assistant"
            aria-label="Message"
          />
          <button type="submit" disabled={sending || !draft.trim()} aria-label="Send">
            <Send size={16} />
          </button>
        </form>
        {draft.length >= 1800 && (
          <p className="chat-note" role="status">{draft.length}/2000 characters - messages can't be longer than 2000.</p>
        )}
        <p className="chat-note">AI answers can be wrong. Check safety advice with official sources.</p>
      </section>
    </div>
  );
}
