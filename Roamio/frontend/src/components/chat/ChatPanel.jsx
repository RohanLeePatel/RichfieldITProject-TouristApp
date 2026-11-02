import { useEffect, useRef, useState } from "react";
import { Plus, Send, Trash2 } from "lucide-react";
import { Link } from "react-router-dom";

import { confirmChatAction, deleteConversation, getConversation, listConversations, sendChatMessage } from "../../api/chat.js";
import useActiveTrip from "../../hooks/useActiveTrip.js";
import useTips from "../../store/tipsStore.js";
import ChatText from "./ChatText.jsx";
import "../../styles/chat.css";

const SUGGESTIONS = ["What is planned for day 2?", "Is it safe where I'm going?", "What should I pack?", "How do I say thank you in French?"];

// The assistant conversation, used by the floating widget and the /chat page.
// A new chat is about the active trip; an opened one keeps the trip it started
// with (the server decides, so the label below is only a hint).
export default function ChatPanel({ showHistory = false, prefill = null }) {
  const { trip } = useActiveTrip();
  const tips = useTips();
  const [messages, setMessages] = useState([]);
  const [conversationId, setConversationId] = useState(null);
  const [conversations, setConversations] = useState([]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [confirming, setConfirming] = useState(null);
  const endRef = useRef(null);

  // a question handed over by an "Ask" button elsewhere in the app
  useEffect(() => {
    if (prefill?.text) setDraft(prefill.text);
  }, [prefill]);

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
      tips.mark("done:chat");
      setMessages((current) => [
        ...current,
        { id: `reply-${Date.now()}`, role: "assistant", content: data.reply, proposal: data.proposal },
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

  // yes or no to something the assistant offered to do
  const decide = async (message, yes) => {
    const settle = (state) => setMessages((current) => current.map((m) => (m.id === message.id ? { ...m, decided: state } : m)));
    if (!yes) return settle("cancelled");
    setConfirming(message.id);
    setError("");
    try {
      const data = await confirmChatAction({ conversationId, ...message.proposal });
      settle("done");
      setMessages((current) => [
        ...current,
        {
          id: `done-${Date.now()}`,
          role: "assistant",
          content: data.reply,
          itineraryTripId: data.added ? data.tripId : null,
          budgetTripId: data.expense ? data.tripId : null,
        },
      ]);
    } catch (err) {
      setError(err.message);
    } finally {
      setConfirming(null);
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
            <div className="chat-empty">
              <p>Ask about your itinerary, the safety advisory, the weather or travelling in general. You can also tell me to add a stop or log what you paid, and I'll check with you first. Tap one to start:</p>
              <div className="chat-suggestions">
                {SUGGESTIONS.map((text) => (
                  <button key={text} type="button" onClick={() => setDraft(text)}>{text}</button>
                ))}
              </div>
            </div>
          )}
          {messages.map((m) => (
            <div key={m.id} className={`chat-bubble ${m.role}`}>
              {m.role === "assistant" ? <ChatText text={m.content} /> : m.content}
              {m.itineraryTripId && (
                <Link className="chat-bubble-link" to={`/trips/${m.itineraryTripId}`}>View itinerary</Link>
              )}
              {m.budgetTripId && (
                <Link className="chat-bubble-link" to={`/trips/${m.budgetTripId}?tab=money`}>View budget</Link>
              )}
              {m.proposal && !m.decided && (
                <div className="chat-proposal">
                  <button type="button" className="chat-yes" disabled={confirming === m.id} onClick={() => decide(m, true)}>
                    {confirming === m.id ? "Working..." : "Confirm"}
                  </button>
                  <button type="button" className="chat-no" disabled={confirming === m.id} onClick={() => decide(m, false)}>
                    Cancel
                  </button>
                </div>
              )}
              {m.proposal && m.decided === "cancelled" && <p className="chat-proposal-note">Cancelled - nothing was changed.</p>}
            </div>
          ))}
          {sending && <div className="chat-bubble assistant pending">Thinking...</div>}
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
