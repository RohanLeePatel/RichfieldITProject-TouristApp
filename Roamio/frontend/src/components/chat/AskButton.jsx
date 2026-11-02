import { Sparkles } from "lucide-react";

import { askAssistant } from "./askAssistant.js";
import "../../styles/chat.css";

// A small "Ask" button that opens the trip assistant with a question ready.
export default function AskButton({ prompt, label = "Ask the assistant", children = "Ask" }) {
  return (
    <button type="button" className="ask-button print-hide" onClick={() => askAssistant(prompt)} aria-label={label} title={label}>
      <Sparkles size={13} /> {children}
    </button>
  );
}
