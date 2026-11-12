import { useEffect, useRef, useState } from "react";
import { Check, Copy, Plus, Search, Send, Sparkles, Trash2 } from "lucide-react";
import { Link } from "react-router-dom";

import {
  confirmChatAction,
  deleteConversation,
  getConversation,
  listConversations,
  sendChatMessage,
} from "../../api/chat.js";

import useActiveTrip from "../../hooks/useActiveTrip.js";
import useTips from "../../store/tipsStore.js";
import ChatText from "./ChatText.jsx";
import "../../styles/chat.css";
import { confirmDialog } from "../../store/confirmStore.js";

const DEFAULT_SUGGESTIONS = [
  "What is planned for day 2?",
  "Is it safe where I'm going?",
  "What should I pack?",
  "How do I say thank you in French?",
];

// Starter questions that name the selected trip; the generic set when there
// is none.
function suggestionsFor(trip) {
  if (!trip) return DEFAULT_SUGGESTIONS;

  const place = trip.destination || trip.title;
  const name = trip.title || place;

  return [
    `What is planned for day 2 of ${name}?`,
    place ? `Is it safe in ${place}?` : DEFAULT_SUGGESTIONS[1],
    `What should I pack for ${name}?`,
    place ? `What is the weather like in ${place}?` : DEFAULT_SUGGESTIONS[3],
  ];
}

// Newest first (the API already sorts), split under Today / Yesterday /
// Previous 7 days / Older. `query` filters by title.
function groupConversations(conversations, query) {
  const needle = query.trim().toLowerCase();
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const day = 24 * 60 * 60 * 1000;

  const groups = [
    { label: "Today", items: [] },
    { label: "Yesterday", items: [] },
    { label: "Previous 7 days", items: [] },
    { label: "Older", items: [] },
  ];

  conversations.forEach((conversation) => {
    const title = conversation.title || "Untitled conversation";
    if (needle && !title.toLowerCase().includes(needle)) return;

    const when = new Date(conversation.updatedAt).getTime();
    const age = Number.isNaN(when) ? Infinity : startOfToday.getTime() - when;

    const index = age <= 0 ? 0 : age <= day ? 1 : age <= 7 * day ? 2 : 3;
    groups[index].items.push(conversation);
  });

  return groups.filter((group) => group.items.length > 0);
}

const timeLabel = (value) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
};

export default function ChatPanel({ showHistory = false, prefill = null }) {
  const { trip } = useActiveTrip();
  const tips = useTips();

  const [messages, setMessages] = useState([]);
  const [conversationId, setConversationId] = useState(null);
  const [conversations, setConversations] = useState([]);
  // until the first load returns, an empty list means "not known yet", not "none"
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [confirming, setConfirming] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [search, setSearch] = useState("");
  const [copiedId, setCopiedId] = useState(null);

  const endRef = useRef(null);
  const inputRef = useRef(null);

  // grow the message box with what is typed, up to about five lines
  useEffect(() => {
    const box = inputRef.current;
    if (!box) return;
    box.style.height = "auto";
    box.style.height = `${Math.min(box.scrollHeight, 130)}px`;
  }, [draft]);

  // Enter sends, Shift+Enter starts a new line
  const onKeyDown = (event) => {
    if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      event.currentTarget.form?.requestSubmit();
    }
  };

  useEffect(() => {
    if (prefill?.text) {
      setDraft(prefill.text);
    }
  }, [prefill]);

  const refreshHistory = async () => {
    if (!showHistory) return;

    try {
      const data = await listConversations();
      setConversations(data?.conversations || []);
    } catch (err) {
      console.error("Unable to load chat history:", err);
    }
    setHistoryLoaded(true);
  };

  useEffect(() => {
    refreshHistory();
  }, [showHistory]);

  useEffect(() => {
    // nothing to follow in an empty chat, and scrolling then drags the whole page down
    if (messages.length || sending) endRef.current?.scrollIntoView?.({ block: "end" });
  }, [messages, sending]);

  const copyReply = async (message) => {
    try {
      await navigator.clipboard.writeText(message.content || "");
      setCopiedId(message.id);
      setTimeout(() => setCopiedId((id) => (id === message.id ? null : id)), 1600);
    } catch {
      setError("Could not copy that reply. Select the text and copy it instead.");
    }
  };

  const startNew = () => {
    setConversationId(null);
    setMessages([]);
    setError("");
    setDraft("");
  };

  const open = async (id) => {
    if (deletingId) return;

    setError("");

    try {
      const { conversation } = await getConversation(id);

      setConversationId(conversation.id);
      setMessages(conversation.messages || []);
    } catch (err) {
      setError(err.message || "Unable to open this conversation.");
    }
  };

  // Delete one conversation from history
  const remove = async (event, id) => {
    event.stopPropagation();

    const confirmed = await confirmDialog(
      "Are you sure you want to delete this conversation? This action cannot be undone.",
      "Delete"
    );

    if (!confirmed) return;

    setDeletingId(id);
    setError("");

    try {
      await deleteConversation(id);

      // Remove it immediately from the sidebar
      setConversations((current) =>
        current.filter((conversation) => conversation.id !== id)
      );

      // If the deleted conversation is currently open, start a new chat
      if (id === conversationId) {
        startNew();
      }

      // Refresh from the server
      await refreshHistory();
    } catch (err) {
      setError(err.message || "Unable to delete this conversation.");
    } finally {
      setDeletingId(null);
    }
  };

  // The message shows at once as an optimistic bubble. If the request fails, the
  // bubble is removed and the text goes back into the box, so nothing typed is lost.
  const send = async (event) => {
    event.preventDefault();

    const message = draft.trim();

    if (!message || sending) return;

    setDraft("");
    setError("");
    setSending(true);

    setMessages((current) => [
      ...current,
      {
        id: `local-${Date.now()}`,
        role: "user",
        content: message,
        createdAt: new Date().toISOString(),
      },
    ]);

    try {
      const data = await sendChatMessage({
        message,
        conversationId,
        tripId: trip?.id,
      });

      setConversationId(data.conversationId);
      // Records that the assistant has been tried, for the Get started checklist.
      tips.mark("done:chat");

      setMessages((current) => [
        ...current,
        {
          id: `reply-${Date.now()}`,
          role: "assistant",
          content: data.reply,
          proposal: data.proposal,
          createdAt: new Date().toISOString(),
        },
      ]);

      refreshHistory();
    } catch (err) {
      setError(err.message || "Unable to send your message.");
      setDraft(message);
      setMessages((current) => current.slice(0, -1));
    } finally {
      setSending(false);
    }
  };

  // Confirm runs the proposed change on the server. Cancel only updates this message
  // locally, and nothing is sent, so the server never acts on a cancelled proposal.
  const decide = async (message, yes) => {
    const settle = (state) =>
      setMessages((current) =>
        current.map((item) =>
          item.id === message.id ? { ...item, decided: state } : item
        )
      );

    if (!yes) {
      return settle("cancelled");
    }

    setConfirming(message.id);
    setError("");

    try {
      const data = await confirmChatAction({
        conversationId,
        ...message.proposal,
      });

      settle("done");

      setMessages((current) => [
        ...current,
        {
          id: `done-${Date.now()}`,
          role: "assistant",
          content: data.reply,
          createdAt: new Date().toISOString(),
          itineraryTripId: data.added ? data.tripId : null,
          budgetTripId: data.expense ? data.tripId : null,
        },
      ]);
    } catch (err) {
      setError(err.message || "Unable to complete this action.");
    } finally {
      setConfirming(null);
    }
  };

  return (
    <div className="chat-panel">
      {showHistory && (
        <aside className="chat-history" aria-label="Past conversations">
          <button
            type="button"
            className="chat-new"
            onClick={startNew}
          >
            <Plus size={16} />
            <span>New chat</span>
          </button>

          {conversations.length > 0 && (
            <label className="chat-history-search">
              <Search size={14} aria-hidden="true" />
              <input
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search conversations"
                aria-label="Search conversations"
              />
            </label>
          )}

          {conversations.length > 0 ? (
            (() => {
              const groups = groupConversations(conversations, search);

              if (groups.length === 0) {
                return (
                  <div className="chat-history-empty">
                    <span>No conversations match &ldquo;{search.trim()}&rdquo;.</span>
                  </div>
                );
              }

              return groups.map((group) => (
                <div className="chat-history-group" key={group.label}>
                  <div className="chat-history-group-label">{group.label}</div>

                  <ul>
                    {group.items.map((conversation) => (
                      <li
                        key={conversation.id}
                        className={
                          conversation.id === conversationId ? "active" : ""
                        }
                      >
                        <button
                          type="button"
                          className="chat-history-open"
                          onClick={() => open(conversation.id)}
                          title={conversation.title}
                        >
                          {conversation.title || "Untitled conversation"}
                        </button>

                        <button
                          type="button"
                          className="chat-delete"
                          onClick={(event) => remove(event, conversation.id)}
                          disabled={deletingId === conversation.id}
                          aria-label={`Delete ${conversation.title || "conversation"}`}
                          title="Delete conversation"
                        >
                          <Trash2 size={16} strokeWidth={2} />
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              ));
            })()
          ) : !historyLoaded ? (
            <div className="chat-history-empty" role="status">
              <span>Loading conversations...</span>
            </div>
          ) : (
            <div className="chat-history-empty">
              <span>No conversations yet.</span>
              <span>Start a new chat to see it here.</span>
            </div>
          )}
        </aside>
      )}

      <section className="chat-main">
        <p className="chat-context">
          {conversationId
            ? "Continuing this chat"
            : trip
              ? `New chat about ${trip.title}`
              : "New chat - no trip selected"}

          {!showHistory && conversationId && (
            <button
              type="button"
              className="chat-link"
              onClick={startNew}
            >
              New chat
            </button>
          )}
        </p>

        <div className="chat-messages" role="log" aria-live="polite">
          {messages.length === 0 && (
            <div className="chat-empty">
              <span className="chat-empty-icon">
                <Sparkles size={26} />
              </span>
              <h3 className="chat-empty-title">How can I help today?</h3>
              <p>
                Ask about your itinerary, the safety advisory, the weather or
                travelling in general. You can also tell me to add a stop or
                log what you paid, and I'll check with you first. Tap one to
                copy it into the box, then send it:
              </p>

              <div className="chat-suggestions">
                {suggestionsFor(trip).map((text) => (
                  <button
                    key={text}
                    type="button"
                    onClick={() => setDraft(text)}
                  >
                    {text}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((message) => (
            <div key={message.id} className={`chat-row ${message.role}`}>
              {message.role === "assistant" && (
                <span className="chat-avatar" aria-hidden="true">
                  <Sparkles size={15} />
                </span>
              )}

              <div className="chat-msg">
            <div className={`chat-bubble ${message.role}`}>
              {message.role === "assistant" ? (
                <ChatText text={message.content} />
              ) : (
                message.content
              )}

              {message.itineraryTripId && (
                <Link
                  className="chat-bubble-link"
                  to={`/trips/${message.itineraryTripId}`}
                >
                  View itinerary
                </Link>
              )}

              {message.budgetTripId && (
                <Link
                  className="chat-bubble-link"
                  to={`/trips/${message.budgetTripId}?tab=money`}
                >
                  View budget
                </Link>
              )}

              {message.proposal && !message.decided && (
                <div className="chat-proposal">
                  <button
                    type="button"
                    className="chat-yes"
                    disabled={confirming === message.id}
                    onClick={() => decide(message, true)}
                  >
                    {confirming === message.id ? "Working..." : "Confirm"}
                  </button>

                  <button
                    type="button"
                    className="chat-no"
                    disabled={confirming === message.id}
                    onClick={() => decide(message, false)}
                  >
                    Cancel
                  </button>
                </div>
              )}

              {message.proposal && message.decided === "cancelled" && (
                <p className="chat-proposal-note">
                  Cancelled - nothing was changed.
                </p>
              )}
            </div>

            {(timeLabel(message.createdAt) || message.role === "assistant") && (
              <div className="chat-meta">
                {timeLabel(message.createdAt) && (
                  <time className="chat-time" dateTime={message.createdAt}>
                    {timeLabel(message.createdAt)}
                  </time>
                )}

                {message.role === "assistant" && message.content && (
                  <button
                    type="button"
                    className="chat-copy"
                    onClick={() => copyReply(message)}
                    aria-label="Copy reply"
                    title="Copy reply"
                  >
                    {copiedId === message.id ? (
                      <><Check size={13} /> Copied</>
                    ) : (
                      <><Copy size={13} /> Copy</>
                    )}
                  </button>
                )}
              </div>
            )}
              </div>
            </div>
          ))}

          {sending && (
            <div className="chat-row assistant">
              <span className="chat-avatar" aria-hidden="true">
                <Sparkles size={15} />
              </span>

              <div className="chat-msg">
                <div className="chat-bubble assistant pending">
                  Thinking
                  <span className="chat-typing" aria-hidden="true">
                    <span /><span /><span />
                  </span>
                </div>
              </div>
            </div>
          )}

          <div ref={endRef} />
        </div>

        {error && (
          <p className="chat-error" role="alert">
            {error}
          </p>
        )}

        <form className="chat-form" onSubmit={send}>
          <textarea
            ref={inputRef}
            rows={1}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={onKeyDown}
            maxLength={2000}
            placeholder="Ask the assistant"
            aria-label="Message"
          />

          <button
            type="submit"
            disabled={sending || !draft.trim()}
            aria-label="Send"
          >
            <Send size={16} />
          </button>
        </form>

        {draft.length >= 1800 && (
          <p className="chat-note" role="status">
            {draft.length}/2000 characters - messages can't be longer than
            2000.
          </p>
        )}

        <p className="chat-note">
          AI answers can be wrong. Check safety advice with official sources.
        </p>
      </section>
    </div>
  );
}
