import { authedFetch } from "./client";

// Tells the server which wizard step the user reached (admin funnel). Best effort,
// once per step per page load; the server dedupes across reloads.
const sent = new Set();
export function trackWizardStep(step) {
  if (sent.has(step)) return;
  sent.add(step);
  authedFetch("/api/wizard-events", { method: "POST", body: JSON.stringify({ step }) }).catch(() => {});
}
