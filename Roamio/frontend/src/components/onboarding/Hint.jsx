import { Lightbulb } from "lucide-react";

import useTips from "../../store/tipsStore.js";
import "../../styles/onboarding.css";

// A one-time note at the top of a page. It sits in the page (never over it),
// says one thing, and stays gone once dismissed. "Show tips again" in Settings
// brings it back.
export default function Hint({ id, title, children }) {
  const { has, mark } = useTips();
  if (has(`tip:${id}`)) return null;

  return (
    <aside className="tip" role="note">
      <Lightbulb size={18} aria-hidden="true" />
      <p>
        {title && <strong>{title} </strong>}
        {children}
      </p>
      <button type="button" onClick={() => mark(`tip:${id}`)}>Got it</button>
    </aside>
  );
}
