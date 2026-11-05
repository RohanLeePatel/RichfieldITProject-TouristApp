import { ArrowLeft, Heart, Plane, Send, Sparkles } from "lucide-react";
import { Link } from "react-router-dom";

import "../../styles/auth.css";

// The Login/Register page frame (travel panel on the left, card on the right)
// for the forgot- and reset-password pages.
export default function AuthShell({ eyebrow, title, subtitle, children }) {
  return (
    <div className="auth-page">
      <section className="travel-panel">
        <div className="hero-overlay" />
        <div className="hero-dots" />
        <div className="travel-circle travel-circle-one" />
        <div className="travel-circle travel-circle-two" />

        <Link to="/" className="logo" aria-label="Roamio home">
          <div className="logo-icon">
            <Plane size={20} />
          </div>
          <span className="logo-word">
            Roam<span className="logo-blue">io</span>
          </span>
        </Link>

        <div className="travel-content">
          <div className="mini-badge">
            <Sparkles size={14} />
            SMART GROUP TRAVEL
          </div>
          <h1>
            Your group.
            <br />
            Your journey.
            <br />
            <span>One plan.</span>
          </h1>
          <p>
            Plan trips your whole group agrees on, organize every detail and
            enjoy the journey together.
          </p>
        </div>

        <div className="travel-footer">
          <span>© 2026 Roamio</span>
          <span className="footer-message">
            Plan better. Travel happier.
            <Heart size={13} fill="currentColor" />
          </span>
        </div>
      </section>

      <section className="auth-panel">
        <Link to="/login" className="auth-back-link">
          <ArrowLeft size={16} />
          Back to sign in
        </Link>

        <div className="panel-dots" />
        <div className="panel-blob" />
        <div className="panel-glow" />

        <div className="auth-card">
          <div className="doodle-plane">
            <Send size={20} className="doodle-icon" />
          </div>

          <div className="logo-icon card-variant">
            <Plane size={21} />
          </div>

          <div className="auth-title">
            <span className="auth-eyebrow">{eyebrow}</span>
            <h2>{title}</h2>
            <p>{subtitle}</p>
          </div>

          {children}
        </div>
      </section>
    </div>
  );
}
