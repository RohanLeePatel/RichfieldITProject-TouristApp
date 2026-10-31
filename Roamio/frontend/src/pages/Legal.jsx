import { ArrowLeft, Plane } from "lucide-react";
import { Link } from "react-router-dom";

import useTheme from "../components/recommendations/useTheme.js";
import { LEGAL_LAST_UPDATED, PRIVACY_POLICY, TERMS } from "../components/settings/settingsContent.js";
import { formatDate } from "../components/settings/settingsUtils.js";
import "../styles/legal.css";

const DOCUMENTS = {
  terms: { title: "Terms and Conditions", sections: TERMS, other: { to: "/privacy", label: "Privacy Policy" } },
  privacy: { title: "Privacy Policy", sections: PRIVACY_POLICY, other: { to: "/terms", label: "Terms and Conditions" } },
};

// /terms and /privacy: public, so they can be read before signing up
export default function Legal({ kind }) {
  const { theme } = useTheme();
  const { title, sections, other } = DOCUMENTS[kind];

  return (
    <div className="legal-page" data-theme={theme}>
      <header className="legal-header">
        <Link to="/" className="legal-brand">
          <span><Plane size={17} /></span> Roamio
        </Link>
        <Link to="/" className="legal-back"><ArrowLeft size={16} /> Back to Roamio</Link>
      </header>

      <main className="legal-main">
        <h1>{title}</h1>
        <p className="legal-updated">Last updated {formatDate(LEGAL_LAST_UPDATED)}</p>

        {sections.map((section, index) => (
          <section key={section.heading}>
            <h2>{index + 1}. {section.heading}</h2>
            {section.body.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
          </section>
        ))}

        <p className="legal-other">Also read our <Link to={other.to}>{other.label}</Link>.</p>
      </main>
    </div>
  );
}
