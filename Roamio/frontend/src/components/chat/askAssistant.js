// "Ask about this" buttons anywhere in the app hand the assistant a question
// to start from. The widget opens with it in the message box; nothing is sent
// until the traveller presses send.
export const ASK_EVENT = "roamio:ask";

export const askAssistant = (prompt) => window.dispatchEvent(new CustomEvent(ASK_EVENT, { detail: prompt }));
