import {
  ArrowRight,
  Bug,
  CheckCircle2,
  ChevronDown,
  CircleHelp,
  LifeBuoy,
  Mail,
  Scale,
  Search,
  Send,
} from "lucide-react";
import { useId, useMemo, useState } from "react";

import { reportProblem, SUPPORT_EMAIL } from "../../api/settings.js";
import { FAQS, LEGAL_LAST_UPDATED, REPORT_CATEGORIES, TERMS } from "./settingsContent.js";
import { CardHead, Field, LegalDocument, Modal, Notice, SettingsSection, Spinner } from "./SettingsUI.jsx";
import { describeDevice, formatDate } from "./settingsUtils.js";

function FaqItem({ item, open, onToggle }) {
  const id = useId();
  return (
    <div className={`st-faq-item${open ? " is-open" : ""}`}>
      <h4>
        <button type="button" aria-expanded={open} aria-controls={id} onClick={onToggle}>
          <span>{item.q}</span>
          <ChevronDown size={17} aria-hidden="true" />
        </button>
      </h4>
      <div id={id} role="region" className="st-faq-answer" hidden={!open}>
        <p>{item.a}</p>
      </div>
    </div>
  );
}

function FaqCard() {
  const [query, setQuery] = useState("");
  const [openIndex, setOpenIndex] = useState(0);

  const results = useMemo(() => {
    const words = query.toLowerCase().split(/\s+/).filter(Boolean);
    if (!words.length) return FAQS;
    return FAQS.filter((item) => {
      const text = `${item.q} ${item.a}`.toLowerCase();
      return words.every((word) => text.includes(word));
    });
  }, [query]);

  return (
    <div className="st-card">
      <CardHead icon={CircleHelp} title="Frequently asked questions" description="Quick answers to common questions." />

      <div className="st-input st-input--search">
        <Search size={17} aria-hidden="true" />
        <input
          type="search"
          value={query}
          placeholder="Search help, e.g. “notifications”"
          aria-label="Search frequently asked questions"
          onChange={(event) => {
            setQuery(event.target.value);
            setOpenIndex(event.target.value ? 0 : -1);
          }}
        />
      </div>

      {results.length ? (
        <div className="st-faq">
          {results.map((item, index) => (
            <FaqItem
              key={item.q}
              item={item}
              open={openIndex === index}
              onToggle={() => setOpenIndex((current) => (current === index ? -1 : index))}
            />
          ))}
        </div>
      ) : (
        <div className="st-empty st-empty--compact">
          <Search size={20} aria-hidden="true" />
          <p>No answers match “{query}”. Try other words, or report a problem below.</p>
        </div>
      )}
    </div>
  );
}

const EMPTY_REPORT = { category: "", subject: "", description: "", includeDetails: true };

function ReportCard({ email, notify }) {
  const [form, setForm] = useState(EMPTY_REPORT);
  const [errors, setErrors] = useState({});
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState("");
  const [sent, setSent] = useState(null);

  const set = (key) => (event) => {
    const value = event.target.type === "checkbox" ? event.target.checked : event.target.value;
    setForm((current) => ({ ...current, [key]: value }));
    setErrors((current) => ({ ...current, [key]: undefined }));
  };

  const submit = async (event) => {
    event.preventDefault();
    const found = {};
    if (!form.category) found.category = "Choose what it's about.";
    if (form.subject.trim().length < 4) found.subject = "Add a short summary.";
    if (form.description.trim().length < 20) found.description = "Tell us a little more (at least 20 characters).";
    setErrors(found);
    if (Object.keys(found).length) return;

    const device = describeDevice();
    const report = {
      category: form.category,
      subject: form.subject.trim(),
      description: form.description.trim(),
      email,
      context: form.includeDetails
        ? {
            page: window.location.pathname,
            browser: `${device.browser} on ${device.os}`,
            screen: `${window.innerWidth}×${window.innerHeight}`,
            language: navigator.language,
            time: new Date().toISOString(),
          }
        : undefined,
    };

    setSending(true);
    setSendError("");
    try {
      const result = await reportProblem(report);
      if (result.source === "email") {
        notify("We opened your email app with the report filled in. Just press send.");
        setForm(EMPTY_REPORT);
      } else {
        setSent(result);
      }
    } catch (error) {
      setSendError(error.message);
    } finally {
      setSending(false);
    }
  };

  if (sent) {
    return (
      <div className="st-card st-sent">
        <span className="st-sent-icon" aria-hidden="true">
          <CheckCircle2 size={26} />
        </span>
        <h3>Thanks, we've got your report</h3>
        <p>
          We'll reply to {email || "your account email"}, usually within one working day.
          {sent.reference && (
            <>
              {" "}
              Your reference is <strong>{sent.reference}</strong>.
            </>
          )}
        </p>
        <button
          type="button"
          className="st-btn st-btn--secondary"
          onClick={() => {
            setSent(null);
            setForm(EMPTY_REPORT);
          }}
        >
          Report something else
        </button>
      </div>
    );
  }

  return (
    <form className="st-card" onSubmit={submit} noValidate>
      <CardHead icon={Bug} title="Report a problem" description="Something not working? Tell us and we'll look into it." />

      <div className="st-grid-2">
        <Field label="What's it about?" error={errors.category}>
          <div className={`st-input${errors.category ? " is-invalid" : ""}`}>
            <select value={form.category} onChange={set("category")}>
              <option value="">Choose a topic…</option>
              {REPORT_CATEGORIES.map((category) => (
                <option key={category}>{category}</option>
              ))}
            </select>
          </div>
        </Field>

        <Field label="Summary" error={errors.subject}>
          <div className={`st-input${errors.subject ? " is-invalid" : ""}`}>
            <input
              value={form.subject}
              onChange={set("subject")}
              maxLength={120}
              placeholder="e.g. Can't add a stop to my itinerary"
            />
          </div>
        </Field>
      </div>

      <Field
        label="What happened?"
        error={errors.description}
        hint={`${form.description.length}/2000 · What did you expect, and what happened instead?`}
      >
        <textarea
          className={`st-textarea${errors.description ? " is-invalid" : ""}`}
          rows={5}
          maxLength={2000}
          value={form.description}
          onChange={set("description")}
          placeholder="Steps to reproduce help us fix it faster."
        />
      </Field>

      <label className="st-check">
        <input type="checkbox" checked={form.includeDetails} onChange={set("includeDetails")} />
        <span>Include technical details (browser, screen size and the page you're on). No passwords or personal files.</span>
      </label>

      {sendError && <Notice tone="error">{sendError}</Notice>}

      <div className="st-card-foot">
        <button type="submit" className="st-btn st-btn--primary" disabled={sending}>
          {sending ? <Spinner /> : <Send size={15} />}
          {sending ? "Sending…" : "Send report"}
        </button>
      </div>
    </form>
  );
}

export default function HelpSection({ email, notify }) {
  const [termsOpen, setTermsOpen] = useState(false);

  return (
    <SettingsSection
      id="help"
      icon={LifeBuoy}
      title="Help & support"
      description="Find answers, get in touch, or let us know when something isn't right."
    >
      <FaqCard />

      <div className="st-help-grid">
        <ReportCard email={email} notify={notify} />

        <div className="st-help-side">
          <a className="st-link-card" href={`mailto:${SUPPORT_EMAIL}`}>
            <span className="st-card-icon" aria-hidden="true">
              <Mail size={18} />
            </span>
            <span className="st-link-card-copy">
              <strong>Email support</strong>
              <span>{SUPPORT_EMAIL}</span>
            </span>
            <ArrowRight size={16} aria-hidden="true" />
          </a>

          <button type="button" className="st-link-card" onClick={() => setTermsOpen(true)}>
            <span className="st-card-icon" aria-hidden="true">
              <Scale size={18} />
            </span>
            <span className="st-link-card-copy">
              <strong>Terms and conditions</strong>
              <span>Updated {formatDate(LEGAL_LAST_UPDATED)}</span>
            </span>
            <ArrowRight size={16} aria-hidden="true" />
          </button>
        </div>
      </div>

      <Modal
        open={termsOpen}
        title="Terms and conditions"
        onClose={() => setTermsOpen(false)}
        size="lg"
        footer={
          <button type="button" className="st-btn st-btn--primary" onClick={() => setTermsOpen(false)}>
            Done
          </button>
        }
      >
        <LegalDocument sections={TERMS} updated={formatDate(LEGAL_LAST_UPDATED)} />
      </Modal>
    </SettingsSection>
  );
}
