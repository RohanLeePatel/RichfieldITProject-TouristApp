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
      className="confirm-dialog"
      aria-label="Confirm"
      onCancel={(event) => {
        event.preventDefault();
        ask.resolve(false);
      }}
    >
      <p>{ask.message}</p>
      <div className="confirm-dialog-actions">
        <button type="button" onClick={() => ask.resolve(false)} autoFocus>
          Cancel
        </button>
        <button type="button" className="confirm-dialog-accept" onClick={() => ask.resolve(true)}>
          {ask.confirmLabel}
        </button>
      </div>
    </dialog>
  );
}
