import { create } from "zustand";

// One message at a time, shown by components/layout/Toaster.jsx. `action` adds a
// button (e.g. Undo): { label, run }.
export const useToastStore = create((set) => ({
  toast: null,
  dismiss: () => set({ toast: null }),
}));

let timer;
export function showToast(message, action, ms = 8000) {
  clearTimeout(timer);
  useToastStore.setState({ toast: { message, action, id: Date.now() } });
  timer = setTimeout(() => useToastStore.setState({ toast: null }), ms);
}
