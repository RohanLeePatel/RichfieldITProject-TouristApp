import { useToastStore } from "../../store/toastStore.js";

export default function Toaster() {
  const { toast, dismiss } = useToastStore();
  if (!toast) return null;
  return (
    <div
      role="status"
      style={{ position: "fixed", bottom: 16, left: "50%", transform: "translateX(-50%)", zIndex: 9998, display: "flex", gap: 12, alignItems: "center", maxWidth: "calc(100vw - 32px)", padding: "10px 16px", borderRadius: 10, background: "#1f2937", color: "#fff", fontSize: 14, boxShadow: "0 4px 16px rgba(0,0,0,.3)" }}
    >
      <span>{toast.message}</span>
      {toast.action && (
        <button
          type="button"
          onClick={() => {
            dismiss();
            toast.action.run();
          }}
          style={{ background: "none", border: 0, color: "#7dd3fc", font: "inherit", fontWeight: 600, cursor: "pointer", padding: 4 }}
        >
          {toast.action.label}
        </button>
      )}
    </div>
  );
}
