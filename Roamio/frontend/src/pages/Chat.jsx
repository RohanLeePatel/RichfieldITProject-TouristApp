import { Sparkles } from "lucide-react";

import ChatPanel from "../components/chat/ChatPanel.jsx";
import PageShell from "../components/recommendations/PageShell.jsx";
import "../styles/chat.css";

export default function Chat() {
  const hero = (
    <>
      <p className="recommendations-eyebrow">
        <Sparkles size={15} /> Your trip assistant
      </p>
      <h1>Ask about your trip.</h1>
      <p>Get answers about your itinerary, the safety advisory and travelling in general.</p>
    </>
  );

  return (
    <PageShell hero={hero}>
      <section className="chat-page">
        <ChatPanel showHistory />
      </section>
    </PageShell>
  );
}
