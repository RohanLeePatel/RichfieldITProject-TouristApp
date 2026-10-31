// Building blocks shared by the settings sections:
// section shell, switch, password field with show/hide, notice, modal

import {
  AlertTriangle,
  CheckCircle2,
  Eye,
  EyeOff,
  Info,
  Loader2,
  LockKeyhole,
  X,
} from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";

/* ---------------- section shell ---------------- */

export function SettingsSection({ id, icon: Icon, title, description, aside, children }) {
  return (
    <section id={id} className="st-section" aria-labelledby={`${id}-title`}>
      <header className="st-section-head">
        <span className="st-section-icon" aria-hidden="true">
          <Icon size={20} />
        </span>

        <div className="st-section-copy">
          <h2 id={`${id}-title`} tabIndex={-1}>
            {title}
          </h2>
          {description && <p>{description}</p>}
        </div>

        {aside && <div className="st-section-aside">{aside}</div>}
      </header>

      <div className="st-section-body">{children}</div>
    </section>
  );
}

export function CardHead({ icon: Icon, title, description, actions }) {
  return (
    <div className="st-card-head">
      {Icon && (
        <span className="st-card-icon" aria-hidden="true">
          <Icon size={18} />
        </span>
      )}

      <div className="st-card-copy">
        <h3>{title}</h3>
        {description && <p>{description}</p>}
      </div>

      {actions && <div className="st-card-actions">{actions}</div>}
    </div>
  );
}

/* ---------------- switch ---------------- */

export function Switch({ checked, onChange, label, disabled = false, size = "md", title }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      title={title}
      disabled={disabled}
      className={`st-switch st-switch--${size}${checked ? " is-on" : ""}`}
      onClick={() => onChange(!checked)}
    >
      <span className="st-switch-thumb" />
    </button>
  );
}

/* ---------------- notice ---------------- */

const NOTICE_ICONS = {
  success: CheckCircle2,
  error: AlertTriangle,
  warning: AlertTriangle,
  info: Info,
};

export function Notice({ tone = "info", children, action }) {
  const Icon = NOTICE_ICONS[tone] || Info;

  return (
    <div className={`st-notice st-notice--${tone}`} role={tone === "error" ? "alert" : "status"}>
      <Icon size={17} aria-hidden="true" />
      <div className="st-notice-text">{children}</div>
      {action}
    </div>
  );
}

export function Spinner({ size = 16 }) {
  return <Loader2 size={size} className="st-spin" aria-hidden="true" />;
}

/* ---------------- text field ---------------- */

export function Field({ label, hint, error, optional, children, className = "" }) {
  return (
    <label className={`st-field ${className}`}>
      <span className="st-field-label">
        {label}
        {optional && <em>Optional</em>}
      </span>
      {children}
      {error ? (
        <span className="st-field-error">{error}</span>
      ) : (
        hint && <span className="st-field-hint">{hint}</span>
      )}
    </label>
  );
}

/* ---------------- password with show / hide ---------------- */

export function PasswordInput({
  value,
  onChange,
  placeholder,
  autoComplete = "new-password",
  invalid = false,
  describedBy,
}) {
  const [visible, setVisible] = useState(false);
  const [capsLock, setCapsLock] = useState(false);

  const checkCaps = (event) => {
    if (typeof event.getModifierState === "function") {
      setCapsLock(event.getModifierState("CapsLock"));
    }
  };

  return (
    <>
      <div className={`st-input${invalid ? " is-invalid" : ""}`}>
        <LockKeyhole size={17} aria-hidden="true" />

        <input
          type={visible ? "text" : "password"}
          value={value}
          placeholder={placeholder}
          autoComplete={autoComplete}
          spellCheck={false}
          autoCapitalize="off"
          aria-invalid={invalid || undefined}
          aria-describedby={describedBy}
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={checkCaps}
          onKeyUp={checkCaps}
          onBlur={() => setCapsLock(false)}
        />

        <button
          type="button"
          className="st-input-reveal"
          aria-label={visible ? "Hide password" : "Show password"}
          aria-pressed={visible}
          title={visible ? "Hide password" : "Show password"}
          // keep focus (and the caret) in the input while toggling
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => setVisible((current) => !current)}
        >
          {visible ? <EyeOff size={17} /> : <Eye size={17} />}
        </button>
      </div>

      {capsLock && (
        <span className="st-field-warning">
          <AlertTriangle size={13} aria-hidden="true" />
          Caps Lock is on
        </span>
      )}
    </>
  );
}

/* ---------------- modal ---------------- */

const FOCUSABLE =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function Modal({ open, title, description, onClose, children, footer, size = "md", tone }) {
  const dialogRef = useRef(null);
  const titleId = useId();
  const descriptionId = useId();
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open) return undefined;

    const previouslyFocused = document.activeElement;
    const { overflow } = document.body.style;
    document.body.style.overflow = "hidden";

    // focus the first field, or the dialog itself
    const timer = setTimeout(() => {
      const dialog = dialogRef.current;
      if (!dialog) return;
      const first =
        dialog.querySelector("[data-autofocus]") ||
        dialog.querySelector(
          ".st-modal-body input:not([disabled]), .st-modal-body select, .st-modal-body textarea"
        );
      (first || dialog).focus();
    }, 20);

    const onKeyDown = (event) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        onCloseRef.current?.();
        return;
      }

      if (event.key !== "Tab" || !dialogRef.current) return;

      const items = [...dialogRef.current.querySelectorAll(FOCUSABLE)].filter(
        (element) => element.offsetParent !== null
      );
      if (!items.length) return;

      const first = items[0];
      const last = items[items.length - 1];

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown);

    return () => {
      clearTimeout(timer);
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = overflow;
      previouslyFocused?.focus?.();
    };
  }, [open]);

  if (!open) return null;

  return (
    <div
      className="st-modal-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose?.();
      }}
    >
      <div
        ref={dialogRef}
        className={`st-modal st-modal--${size}${tone ? ` st-modal--${tone}` : ""}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        tabIndex={-1}
      >
        <div className="st-modal-head">
          <div>
            <h2 id={titleId}>{title}</h2>
            {description && <p id={descriptionId}>{description}</p>}
          </div>

          <button type="button" className="st-icon-button" aria-label="Close" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        {children && <div className="st-modal-body">{children}</div>}

        {footer && <div className="st-modal-foot">{footer}</div>}
      </div>
    </div>
  );
}

/* ---------------- legal document body ---------------- */

export function LegalDocument({ sections, updated }) {
  return (
    <div className="st-legal">
      {updated && <p className="st-legal-updated">Last updated {updated}</p>}

      {sections.map((section, index) => (
        <section key={section.heading}>
          <h3>
            <span>{String(index + 1).padStart(2, "0")}</span>
            {section.heading}
          </h3>
          {section.body.map((paragraph) => (
            <p key={paragraph}>{paragraph}</p>
          ))}
        </section>
      ))}
    </div>
  );
}
