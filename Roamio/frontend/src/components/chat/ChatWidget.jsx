import { useEffect, useState } from "react";
import { MessageCircle, Sparkles, X } from "lucide-react";

import useTheme from "../recommendations/useTheme.js";
import { ASK_EVENT } from "./askAssistant.js";
import ChatPanel from "./ChatPanel.jsx";
import "../../styles/chat.css";

// Floating assistant button on every signed-in page. The full page (/chat)
// adds the conversation list. It carries its own theme tokens (chat.css) so
// it looks the same on the Dashboard and on the trip-planning pages.
export default function ChatWidget() {
  const { theme } = useTheme();
  const [open, setOpen] = useState(false);
  const [prefill, setPrefill] = useState(null);

  // an "Ask" button elsewhere in the app: open with its question ready to send
  useEffect(() => {
    const onAsk = (event) => {
      setPrefill({ text: String(event.detail || ""), at: Date.now() });
      setOpen(true);
    };
    window.addEventListener(ASK_EVENT, onAsk);
    return () => window.removeEventListener(ASK_EVENT, onAsk);
  }, []);

  return (
    <div className="chat-widget" data-theme={theme}>
      {open && (
        <div className="chat-widget-window" role="dialog" aria-label="Trip assistant">
          <header>
            <span className="chat-widget-avatar"><Sparkles size={20} /></span>
            <div className="chat-widget-heading">
              <strong>Trip assistant</strong>
              <small><i />Ready to help</small>
            </div>
            <button type="button" onClick={() => setOpen(false)} aria-label="Close assistant"><X size={18} /></button>
          </header>
          <ChatPanel prefill={prefill} />
        </div>
      )}
      <button
        type="button"
        className="chat-widget-button"
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? "Close assistant" : "Open assistant"}
        aria-expanded={open}
      >
        <MessageCircle size={22} />
      </button>
    </div>
  );
}
