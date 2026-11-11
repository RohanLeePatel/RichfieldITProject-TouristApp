import React from "react";
import ReactDOM from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import App from "./App.jsx";
import { initAnalytics } from "./analytics.js";
import "./index.css";

initAnalytics();

// the worker keeps the app shell for offline use (and handles push)
if (import.meta.env.PROD && "serviceWorker" in navigator) {
  navigator.serviceWorker.register("/sw.js").catch(() => {});
}

const queryClient = new QueryClient({
  // "always": react-query would otherwise pause every request while offline;
  // we want them to run so the API client can answer from its saved copy (or fail fast).
  defaultOptions: {
    queries: { networkMode: "always", retry: (count) => navigator.onLine && count < 3 },
    mutations: { networkMode: "always" },
  },
});

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </React.StrictMode>
);