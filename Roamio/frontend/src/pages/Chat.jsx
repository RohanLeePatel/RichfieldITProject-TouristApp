import { useEffect, useState } from "react";
import { MessageCircle, MessageSquare, ShieldCheck, Sparkles } from "lucide-react";

import ChatPanel from "../components/chat/ChatPanel.jsx";
import Hint from "../components/onboarding/Hint.jsx";
import PageTopBar from "../components/PageTopBar.jsx";
import useTheme from "../components/recommendations/useTheme.js";
import "../styles/chat.css";

export default function Chat() {
  const { theme, toggle: toggleTheme } = useTheme();

  return (
    <div className="chat-page-root" data-theme={theme}>
      {/* STANDARD HERO TOP BAR - MATCHES WEATHER & CALENDAR */}
      <PageTopBar
        theme={theme}
        onToggleTheme={toggleTheme}
        hero={
          <>
            <p className="page-topbar-eyebrow">
              <MessageSquare size={15} />
              Your travel assistant
            </p>
            <h1>
              Travel smarter.
              <span> Ask anything.</span>
            </h1>
            <p className="page-topbar-lede">
              Get answers about your itinerary, safety advisories, destinations, and everything in between.
            </p>
          </>
        }
      />

      {/* MAIN CONTENT CONTAINER */}
      <main className="chat-content">
        <Hint id="trip-assistant">
          Ask your travel assistant anything about your upcoming trips, packing lists, weather condition advice, or local safety guidelines.
        </Hint>

        <section className="chat-page">
          <div className="chat-panel-wrapper">
            <div className="chat-workspace-header">
              <div className="chat-workspace-title">
                <div className="chat-workspace-icon">
                  <MessageCircle size={24} />
                </div>

                <div>
                  <h2>Your travel assistant</h2>
                  <p>
                    Ask a question and let your assistant help you find the answers.
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
            <span>AI-generated responses may not always be accurate. Verify important travel and safety information.</span>
          </div>
        </section>
      </main>
    </div>
  );
}