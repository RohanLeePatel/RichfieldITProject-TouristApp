import { Sparkles, ShieldCheck, MessageCircle } from "lucide-react";

import ChatPanel from "../components/chat/ChatPanel.jsx";
import PageShell from "../components/recommendations/PageShell.jsx";
import "../styles/chat.css";

export default function Chat() {
  const hero = (
    <>
      <p className="recommendations-eyebrow">
        <Sparkles size={15} />
        Your travel assistant
      </p>

      <h1>
        Travel smarter.
        <span> Ask anything.</span>
      </h1>

      <p>
        Get answers about your itinerary, safety advisories,
        destinations and everything in between.
      </p>
    </>
  );

  return (
    <PageShell hero={hero}>
      <section className="chat-page">

        <div className="chat-panel-wrapper">

          <div className="chat-workspace-header">
            <div className="chat-workspace-title">
              <div className="chat-workspace-icon">
                <MessageCircle size={26} />
              </div>

              <div>
                <h2>Your travel assistant</h2>
                <p>
                  Ask a question and let your assistant help you
                  find the answers.
                </p>
              </div>
            </div>

            <div className="chat-online-status">
              <span />
              Assistant available
            </div>
          </div>

          <ChatPanel showHistory />

        </div>

        <div className="chat-footer-note">
          <ShieldCheck size={15} />
          AI-generated responses may not always be accurate.
          Verify important travel and safety information.
        </div>

      </section>
    </PageShell>
  );
}