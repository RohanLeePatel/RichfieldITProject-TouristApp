import { create } from "zustand";

// In-app replacement for window.confirm: `await confirmDialog("Delete it?")` is
// true on OK, false on Cancel/Escape. Rendered by components/layout/ConfirmHost.jsx.
export const useConfirmStore = create(() => ({ ask: null }));

export function confirmDialog(message, confirmLabel = "OK") {
  return new Promise((resolve) => {
    // a second dialog while one is open cancels the first
    useConfirmStore.getState().ask?.resolve(false);
    useConfirmStore.setState({
      ask: {
        message,
        confirmLabel,
        resolve: (ok) => {
          useConfirmStore.setState({ ask: null });
          resolve(ok);
        },
      },
    });
  });
}
