import {
  AlertTriangle,
  CalendarDays,
  Globe2,
  IdCard,
  Lock,
  Mail,
  Pencil,
  Phone,
  ShieldCheck,
  Trash2,
  User,
  UserPlus,
  Users,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { deleteTraveller, listTravellers, saveTraveller } from "../../api/settings.js";
import { nameError } from "../../utils/validation.js";
import { Field, Modal, Notice, SettingsSection, Spinner } from "./SettingsUI.jsx";
import { ageFrom, formatDate, initialsOf, isEmail, lastFour, monthsUntil } from "./settingsUtils.js";

const RELATIONSHIPS = ["Partner or spouse", "Child", "Parent", "Sibling", "Relative", "Friend", "Colleague", "Other"];

const EMPTY_FORM = {
  firstName: "",
  lastName: "",
  relationship: "",
  dateOfBirth: "",
  nationality: "",
  email: "",
  phone: "",
  documentType: "passport",
  documentNumber: "",
  documentExpiry: "",
  consent: false,
  guardianConsent: false,
};

const today = () => new Date().toISOString().slice(0, 10);
const fullName = (t) => [t.firstName, t.lastName].filter(Boolean).join(" ");

function toForm(traveller) {
  if (!traveller) return EMPTY_FORM;
  return {
    ...EMPTY_FORM,
    ...Object.fromEntries(
      Object.keys(EMPTY_FORM).map((key) => [key, traveller[key] ?? EMPTY_FORM[key]])
    ),
    documentNumber: "", // never pre-fill; blank keeps what's saved
    consent: Boolean(traveller.consent?.given),
    guardianConsent: Boolean(traveller.consent?.guardian),
  };
}

function documentStatus(traveller) {
  if (!traveller.documentExpiry) return null;
  const months = monthsUntil(traveller.documentExpiry);
  if (months === null) return null;
  if (months < 0) return { tone: "danger", label: "Expired" };
  if (months < 6) return { tone: "warning", label: "Expires within 6 months" };
  return null;
}

/* ======================= form ======================= */

function TravellerForm({ traveller, deviceOnly, onCancel, onSaved }) {
  const [form, setForm] = useState(() => toForm(traveller));
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");

  const editing = Boolean(traveller?.id);
  const savedLast4 = traveller ? lastFour(traveller) : "";
  const age = ageFrom(form.dateOfBirth);
  const isMinor = age !== null && age < 18;

  const set = (key) => (event) => {
    const value = event.target.type === "checkbox" ? event.target.checked : event.target.value;
    setForm((current) => ({ ...current, [key]: value }));
    setErrors((current) => ({ ...current, [key]: undefined }));
  };

  const validate = () => {
    const next = {};
    const firstProblem = nameError(form.firstName, "the first name", { max: 40 });
    if (firstProblem) next.firstName = firstProblem;
    const lastProblem = nameError(form.lastName, "the last name", { max: 40 });
    if (lastProblem) next.lastName = lastProblem;
    if (!form.relationship) next.relationship = "Choose how you know them.";
    if (!form.dateOfBirth) next.dateOfBirth = "Enter their date of birth.";
    else if (form.dateOfBirth > today()) next.dateOfBirth = "Date of birth can't be in the future.";
    else if (form.dateOfBirth < "1900-01-01") next.dateOfBirth = "Enter a date of birth from 1900 onwards.";
    const nationalityProblem = nameError(form.nationality, "the nationality", { max: 40, required: false });
    if (nationalityProblem) next.nationality = nationalityProblem;
    if (form.documentExpiry && form.documentExpiry > "2100-12-31") next.documentExpiry = "Enter an expiry date before 2100.";
    else if (form.documentExpiry && form.dateOfBirth && form.documentExpiry <= form.dateOfBirth) {
      next.documentExpiry = "The expiry date must be after the date of birth.";
    }
    if (form.email && !isEmail(form.email)) next.email = "Enter a valid email address, like name@example.com.";
    if (form.phone && !/^\+?[\d\s()-]{7,20}$/.test(form.phone.trim())) {
      next.phone = "Enter a valid phone number: 7-20 digits, optionally starting with + (like +27 82 123 4567).";
    }
    if (form.documentNumber && !/^[A-Za-z0-9\s-]{5,20}$/.test(form.documentNumber.trim())) {
      next.documentNumber = "Use 5–20 letters and numbers only.";
    }
    if (!form.consent) next.consent = "You need their permission to save their details.";
    if (isMinor && !form.guardianConsent) next.guardianConsent = "Confirm you're their parent or legal guardian.";
    return next;
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    const found = validate();
    setErrors(found);
    if (Object.keys(found).length) {
      // take the user straight to the first field that needs fixing
      requestAnimationFrame(() =>
        document
          .querySelector("#traveller-form .is-invalid input, #traveller-form .is-invalid select")
          ?.focus()
      );
      return;
    }

    const now = new Date().toISOString();
    const payload = {
      id: traveller?.id,
      firstName: form.firstName.trim(),
      lastName: form.lastName.trim(),
      relationship: form.relationship,
      dateOfBirth: form.dateOfBirth,
      nationality: form.nationality.trim(),
      email: form.email.trim(),
      phone: form.phone.trim(),
      documentType: form.documentType,
      documentExpiry: form.documentExpiry || null,
      consent: {
        given: true,
        guardian: isMinor,
        at: traveller?.consent?.at || now,
      },
    };

    if (!deviceOnly && form.documentNumber.trim()) {
      payload.documentNumber = form.documentNumber.replace(/[\s-]+/g, "").toUpperCase();
    }

    setSaving(true);
    setSaveError("");
    try {
      await onSaved(payload);
    } catch (error) {
      setSaveError(error.message);
      setSaving(false);
    }
  };

  return (
    <form id="traveller-form" onSubmit={handleSubmit} noValidate className="st-form">
      <fieldset className="st-form-group">
        <legend>About them</legend>

        <div className="st-grid-2">
          <Field label="First name" error={errors.firstName} hint="As shown on their passport or ID.">
            <div className={`st-input${errors.firstName ? " is-invalid" : ""}`}>
              <User size={17} aria-hidden="true" />
              <input value={form.firstName} onChange={set("firstName")} maxLength={40} autoComplete="off" />
            </div>
          </Field>

          <Field label="Last name" error={errors.lastName}>
            <div className={`st-input${errors.lastName ? " is-invalid" : ""}`}>
              <input value={form.lastName} onChange={set("lastName")} maxLength={40} autoComplete="off" />
            </div>
          </Field>

          <Field label="Relationship to you" error={errors.relationship}>
            <div className={`st-input${errors.relationship ? " is-invalid" : ""}`}>
              <Users size={17} aria-hidden="true" />
              <select value={form.relationship} onChange={set("relationship")}>
                <option value="">Choose…</option>
                {RELATIONSHIPS.map((item) => (
                  <option key={item}>{item}</option>
                ))}
              </select>
            </div>
          </Field>

          <Field
            label="Date of birth"
            error={errors.dateOfBirth}
            hint={age !== null && age >= 0 ? `${age} years old${isMinor ? " · travelling as a minor" : ""}` : ""}
          >
            <div className={`st-input${errors.dateOfBirth ? " is-invalid" : ""}`}>
              <CalendarDays size={17} aria-hidden="true" />
              <input type="date" value={form.dateOfBirth} min="1900-01-01" max={today()} onChange={set("dateOfBirth")} />
            </div>
          </Field>

          <Field label="Nationality" optional error={errors.nationality}>
            <div className={`st-input${errors.nationality ? " is-invalid" : ""}`}>
              <Globe2 size={17} aria-hidden="true" />
              <input value={form.nationality} onChange={set("nationality")} maxLength={40} placeholder="e.g. South African" />
            </div>
          </Field>
        </div>
      </fieldset>

      <fieldset className="st-form-group">
        <legend>Contact</legend>
        <p className="st-form-help">Used only to send them their own booking details, if you choose to.</p>

        <div className="st-grid-2">
          <Field label="Email" optional error={errors.email}>
            <div className={`st-input${errors.email ? " is-invalid" : ""}`}>
              <Mail size={17} aria-hidden="true" />
              <input type="email" value={form.email} onChange={set("email")} autoComplete="off" />
            </div>
          </Field>

          <Field label="Mobile number" optional error={errors.phone}>
            <div className={`st-input${errors.phone ? " is-invalid" : ""}`}>
              <Phone size={17} aria-hidden="true" />
              <input type="tel" value={form.phone} onChange={set("phone")} placeholder="+27 82 123 4567" autoComplete="off" />
            </div>
          </Field>
        </div>
      </fieldset>

      <fieldset className="st-form-group">
        <legend>Travel document</legend>

        {deviceOnly && (
          <Notice tone="info">
            For their security, document numbers can't be saved yet. You'll be asked for it when you book.
          </Notice>
        )}

        <div className="st-grid-3">
          <Field label="Document" optional>
            <div className="st-input">
              <IdCard size={17} aria-hidden="true" />
              <select value={form.documentType} onChange={set("documentType")}>
                <option value="passport">Passport</option>
                <option value="id">ID card</option>
              </select>
            </div>
          </Field>

          <Field
            label="Document number"
            optional
            error={errors.documentNumber}
            hint={editing && savedLast4 ? `Leave blank to keep •••• ${savedLast4}` : "Stored encrypted, shown masked."}
          >
            <div className={`st-input${errors.documentNumber ? " is-invalid" : ""}`}>
              <Lock size={17} aria-hidden="true" />
              <input
                value={form.documentNumber}
                onChange={set("documentNumber")}
                disabled={deviceOnly}
                autoComplete="off"
                spellCheck={false}
                placeholder={deviceOnly ? "Not available yet" : ""}
              />
            </div>
          </Field>

          <Field label="Expiry date" optional error={errors.documentExpiry}>
            <div className={`st-input${errors.documentExpiry ? " is-invalid" : ""}`}>
              <CalendarDays size={17} aria-hidden="true" />
              <input type="date" max="2100-12-31" value={form.documentExpiry || ""} onChange={set("documentExpiry")} />
            </div>
          </Field>
        </div>
      </fieldset>

      <fieldset className="st-consent">
        <legend className="st-sr-only">Consent</legend>
        <ShieldCheck size={19} aria-hidden="true" className="st-consent-icon" />

        <div className="st-consent-body">
          <label className={`st-check${errors.consent ? " is-invalid" : ""}`}>
            <input type="checkbox" checked={form.consent} onChange={set("consent")} />
            <span>
              I have {fullName(form) || "this person"}'s permission to save their details, and they know
              Roamio will use them only for bookings I make.
            </span>
          </label>
          {errors.consent && <span className="st-field-error">{errors.consent}</span>}

          {isMinor && (
            <>
              <label className={`st-check${errors.guardianConsent ? " is-invalid" : ""}`}>
                <input type="checkbox" checked={form.guardianConsent} onChange={set("guardianConsent")} />
                <span>I'm their parent or legal guardian.</span>
              </label>
              {errors.guardianConsent && <span className="st-field-error">{errors.guardianConsent}</span>}
            </>
          )}

          <p>
            Only you can see saved travellers. They're never shown to your travel groups, and you can
            remove them at any time.
          </p>
        </div>
      </fieldset>

      {saveError && <Notice tone="error">{saveError}</Notice>}

      <div className="st-modal-foot st-modal-foot--inline">
        <button type="button" className="st-btn st-btn--secondary" onClick={onCancel}>
          Cancel
        </button>
        <button type="submit" className="st-btn st-btn--primary" disabled={saving}>
          {saving ? <Spinner /> : editing ? <Pencil size={15} /> : <UserPlus size={16} />}
          {editing ? "Save changes" : "Save traveller"}
        </button>
      </div>
    </form>
  );
}

/* ======================= card ======================= */

function TravellerCard({ traveller, onEdit, onRemove }) {
  const name = fullName(traveller) || "Unnamed traveller";
  const age = ageFrom(traveller.dateOfBirth);
  const digits = lastFour(traveller);
  const status = documentStatus(traveller);

  return (
    <li className="st-traveller">
      <div className="st-traveller-top">
        <span className="st-traveller-avatar" aria-hidden="true">
          {initialsOf(name, "?")}
        </span>

        <div className="st-traveller-name">
          <h4>{name}</h4>
          <p>
            {traveller.relationship || "Traveller"}
            {age !== null && age < 18 && <span className="st-tag">Under 18</span>}
          </p>
        </div>

        <div className="st-traveller-actions">
          <button type="button" className="st-icon-button" aria-label={`Edit ${name}`} title="Edit" onClick={onEdit}>
            <Pencil size={15} />
          </button>
          <button
            type="button"
            className="st-icon-button st-icon-button--danger"
            aria-label={`Remove ${name}`}
            title="Remove"
            onClick={onRemove}
          >
            <Trash2 size={15} />
          </button>
        </div>
      </div>

      <dl className="st-traveller-details">
        <div>
          <dt>Date of birth</dt>
          <dd>{traveller.dateOfBirth ? formatDate(traveller.dateOfBirth) : "—"}</dd>
        </div>
        <div>
          <dt>Nationality</dt>
          <dd>{traveller.nationality || "—"}</dd>
        </div>
        <div>
          <dt>{traveller.documentType === "id" ? "ID card" : "Passport"}</dt>
          <dd>
            {digits ? `•••• ${digits}` : "Not saved"}
            {traveller.documentExpiry && (
              <span className="st-dd-sub">Expires {formatDate(traveller.documentExpiry, { month: "short", year: "numeric" })}</span>
            )}
          </dd>
        </div>
      </dl>

      {status && (
        <p className={`st-traveller-alert st-traveller-alert--${status.tone}`}>
          <AlertTriangle size={14} aria-hidden="true" />
          {status.label}
          {status.tone === "warning" && " — many countries require 6 months' validity."}
        </p>
      )}

      <p className="st-traveller-consent">
        <ShieldCheck size={13} aria-hidden="true" />
        {traveller.consent?.at
          ? `Consent recorded ${formatDate(traveller.consent.at)}${traveller.consent.guardian ? " · guardian" : ""}`
          : "Consent not recorded — edit to confirm"}
      </p>
    </li>
  );
}

/* ======================= section ======================= */

export default function TravellersSection({ email, notify }) {
  const [travellers, setTravellers] = useState([]);
  const [source, setSource] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState(null); // null closed, {} new, traveller edit
  const [removing, setRemoving] = useState(null);
  const [removeBusy, setRemoveBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const { data, source: from } = await listTravellers(email);
      setTravellers(Array.isArray(data) ? data : []);
      setSource(from);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }, [email]);

  useEffect(() => {
    load();
  }, [load]);

  const deviceOnly = source === "device";

  const handleSaved = async (payload) => {
    const isNew = !payload.id;
    await saveTraveller(email, payload);
    setEditing(null);
    notify(isNew ? `${fullName(payload)} added to your travellers.` : `${fullName(payload)} updated.`);
    load();
  };

  const confirmRemove = async () => {
    setRemoveBusy(true);
    try {
      await deleteTraveller(email, removing.id);
      setTravellers((current) => current.filter((item) => item.id !== removing.id));
      notify(`${fullName(removing)} removed.`);
      setRemoving(null);
    } catch (requestError) {
      notify(requestError.message, "error");
    } finally {
      setRemoveBusy(false);
    }
  };

  return (
    <SettingsSection
      id="travellers"
      icon={Users}
      title="Other travellers"
      description="Save the people you travel with so their details are ready when you book."
      aside={
        travellers.length > 0 && (
          <button type="button" className="st-btn st-btn--primary st-btn--sm" onClick={() => setEditing({})}>
            <UserPlus size={15} />
            Add traveller
          </button>
        )
      }
    >
      {error ? (
        <Notice
          tone="error"
          action={
            <button type="button" className="st-btn st-btn--secondary st-btn--sm" onClick={load}>
              Try again
            </button>
          }
        >
          {error}
        </Notice>
      ) : loading ? (
        <div className="st-traveller-grid" aria-label="Loading travellers">
          <div className="st-skeleton-card" />
          <div className="st-skeleton-card" />
        </div>
      ) : travellers.length === 0 ? (
        <div className="st-card st-empty">
          <span className="st-empty-art" aria-hidden="true">
            <Users size={26} />
          </span>
          <h3>No saved travellers yet</h3>
          <p>Add family, friends or colleagues once, and pick them in a tap the next time you book.</p>
          <button type="button" className="st-btn st-btn--primary" onClick={() => setEditing({})}>
            <UserPlus size={16} />
            Add a traveller
          </button>
        </div>
      ) : (
        <ul className="st-traveller-grid">
          {travellers.map((traveller) => (
            <TravellerCard
              key={traveller.id}
              traveller={traveller}
              onEdit={() => setEditing(traveller)}
              onRemove={() => setRemoving(traveller)}
            />
          ))}

          <li>
            <button type="button" className="st-traveller-add" onClick={() => setEditing({})}>
              <UserPlus size={20} aria-hidden="true" />
              <span>Add another traveller</span>
            </button>
          </li>
        </ul>
      )}

      {deviceOnly && !error && (
        <p className="st-foot-note st-foot-note--block">
          <Lock size={13} aria-hidden="true" />
          Travellers are saved in this browser for now, so they won't appear on your other devices.
        </p>
      )}

      <Modal
        open={editing !== null}
        title={editing?.id ? `Edit ${fullName(editing)}` : "Add a traveller"}
        description="Enter names exactly as they appear on the travel document."
        onClose={() => setEditing(null)}
        size="lg"
      >
        {editing !== null && (
          <TravellerForm
            key={editing.id || "new"}
            traveller={editing.id ? editing : null}
            deviceOnly={deviceOnly}
            onCancel={() => setEditing(null)}
            onSaved={handleSaved}
          />
        )}
      </Modal>

      <Modal
        open={removing !== null}
        title={`Remove ${removing ? fullName(removing) : "traveller"}?`}
        description="Their saved details will be permanently deleted. Bookings you've already made aren't affected."
        onClose={() => setRemoving(null)}
        size="sm"
        tone="danger"
        footer={
          <>
            <button type="button" className="st-btn st-btn--secondary" onClick={() => setRemoving(null)}>
              Keep traveller
            </button>
            <button type="button" className="st-btn st-btn--danger" onClick={confirmRemove} disabled={removeBusy}>
              {removeBusy ? <Spinner /> : <Trash2 size={15} />}
              Remove
            </button>
          </>
        }
      />
    </SettingsSection>
  );
}
