import { useEffect, useRef } from "react";

import { useConfirmStore } from "../../store/confirmStore.js";

export default function ConfirmHost() {
  const ask = useConfirmStore((state) => state.ask);
  const ref = useRef(null);

  // showModal gives the focus trap, the backdrop and Escape for free
  useEffect(() => {
    const dialog = ref.current;
    if (ask && dialog && !dialog.open) dialog.showModal();
  }, [ask]);

  if (!ask) return null;
  return (
    <dialog
      ref={ref}
      aria-label="Confirm"
      onCancel={(event) => {
        event.preventDefault();
        ask.resolve(false);
      }}
      style={{ maxWidth: 380, width: "calc(100vw - 32px)", border: 0, borderRadius: 12, padding: 20, boxShadow: "0 8px 32px rgba(0,0,0,.35)", color: "#111827" }}
    >
      <p style={{ margin: "0 0 16px", fontSize: 15, lineHeight: 1.45 }}>{ask.message}</p>
      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
        <button type="button" className="secondary-button" onClick={() => ask.resolve(false)} autoFocus>
          Cancel
        </button>
        <button type="button" className="primary-button" onClick={() => ask.resolve(true)}>
          {ask.confirmLabel}
        </button>
      </div>
    </dialog>
  );
}
