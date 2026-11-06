import { useEffect, useState } from "react";
import {
  ArrowLeft,
  MessageCircle,
  Plane,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { Link } from "react-router-dom";

import ChatPanel from "../components/chat/ChatPanel.jsx";
import Hint from "../components/onboarding/Hint.jsx";
import ThemeToggle from "../components/recommendations/ThemeToggle.jsx";
import useTheme from "../components/recommendations/useTheme.js";
import "../styles/chat.css";

export default function Chat() {
  const { theme, toggle: toggleTheme } = useTheme();

  return (
    <div className="chat-page-root" data-theme={theme}>
      {/* STANDARD HEADER - MATCHES WEATHER & TRANSLATOR LAYOUT */}
      <header className="chat-header">
        <Link to="/dashboard" className="back-dashboard">
          <ArrowLeft size={17} />
          Back to dashboard
        </Link>

        <div className="chat-header-right">
          <div className="chat-brand">
            <div className="chat-logo">
              <Plane size={19} />
            </div>
            <span>
              Roam<span>io</span>
            </span>
          </div>
          <ThemeToggle theme={theme} onToggle={toggleTheme} />
        </div>
      </header>

      {/* MAIN CONTENT CONTAINER (width: min(944px, calc(100% - 26px))) */}
      <main className="chat-content">
        <section className="chat-intro">
          <div className="chat-badge">
            <Sparkles size={14} />
            YOUR TRAVEL ASSISTANT
          </div>
          <h1>
            Travel smarter.
            <span>Ask anything.</span>
          </h1>
          <p>
            Get answers about your itinerary, safety advisories, destinations, and everything in between.
          </p>
        </section>

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