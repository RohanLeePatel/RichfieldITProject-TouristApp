import { useState } from "react";
import { MessageCircle, Sparkles, X } from "lucide-react";
import { useLocation } from "react-router-dom";

import useTheme from "../recommendations/useTheme.js";
import ChatPanel from "./ChatPanel.jsx";
import "../../styles/chat.css";

// Floating assistant bubble on every signed-in page except /chat itself.
export default function ChatWidget() {
  const { theme } = useTheme();
  const [open, setOpen] = useState(false);
  if (useLocation().pathname.startsWith("/chat")) return null;

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
          <ChatPanel />
        </div>
      )}
      <button type="button" className="chat-widget-button" onClick={() => setOpen((v) => !v)} aria-label={open ? "Close assistant" : "Open assistant"} aria-expanded={open}>
        <MessageCircle size={22} />
      </button>
    </div>
  );
}
