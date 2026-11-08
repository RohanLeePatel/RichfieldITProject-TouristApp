import { Sparkles } from "lucide-react";

import { useNavigate } from "react-router-dom";
import "../../styles/chat.css";

// A small "Ask" button that opens the trip assistant page with a question ready.
export default function AskButton({ prompt, label = "Ask the assistant", children = "Ask" }) {
  const navigate = useNavigate();
  return (
    <button type="button" className="ask-button print-hide" onClick={() => navigate("/chat", { state: { prefill: { text: prompt, at: Date.now() } } })} aria-label={label} title={label}>
      <Sparkles size={13} /> {children}
    </button>
  );
}
