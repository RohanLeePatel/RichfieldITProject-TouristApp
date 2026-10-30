import { useState } from "react";
import { MessageCircle, X } from "lucide-react";

import useTheme from "../recommendations/useTheme.js";
import ChatPanel from "./ChatPanel.jsx";
import "../../styles/chat.css";

// Floating assistant button on every signed-in page. The full page (/chat)
// adds the conversation list. It carries its own theme tokens (chat.css) so
// it looks the same on the Dashboard and on the trip-planning pages.
export default function ChatWidget() {
  const { theme } = useTheme();
  const [open, setOpen] = useState(false);

  return (
    <div className="chat-widget" data-theme={theme}>
      {open && (
        <div className="chat-widget-window" role="dialog" aria-label="Trip assistant">
          <header>
            <strong>Trip assistant</strong>
            <button type="button" onClick={() => setOpen(false)} aria-label="Close assistant"><X size={18} /></button>
          </header>
          <ChatPanel />
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
