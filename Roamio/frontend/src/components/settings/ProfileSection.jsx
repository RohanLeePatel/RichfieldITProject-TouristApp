import {
  Camera,
  ImagePlus,
  Languages,
  Mail,
  Moon,
  Palette,
  Save,
  Sun,
  Trash2,
  User,
  Wallet,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { fetchMe, updateMe } from "../../api/account.js";
import { CURRENCIES } from "../../pages/recommendations/constants.js";
import { useAuthStore } from "../../store/authStore.js";
import { LANGUAGES } from "../../utils/translatorHelpers";
import { nameError } from "../../utils/validation.js";
import { CardHead, Field, Notice, SettingsSection, Spinner } from "./SettingsUI.jsx";
import { initialsOf } from "./settingsUtils.js";

// Photos are shrunk before saving: a full-size photo as a data URL is
// several MB and overflows localStorage, so the save silently failed.
const PHOTO_SIZE = 256;

function resizePhoto(dataUrl) {
  return new Promise((resolve, reject) => {
    const image = new Image();

    image.onload = () => {
      // crop to a centred square, then scale down
      const side = Math.min(image.width, image.height);
      const canvas = document.createElement("canvas");

      canvas.width = PHOTO_SIZE;
      canvas.height = PHOTO_SIZE;

      canvas
        .getContext("2d")
        .drawImage(
          image,
          (image.width - side) / 2,
          (image.height - side) / 2,
          side,
          side,
          0,
          0,
          PHOTO_SIZE,
          PHOTO_SIZE
        );

      resolve(canvas.toDataURL("image/jpeg", 0.85));
    };

    image.onerror = reject;
    image.src = dataUrl;
  });
}

export default function ProfileSection({ theme, setTheme, notify }) {
  const fileInputRef = useRef(null);

  const storedUser = useAuthStore((state) => state.user) || {};
  const updateProfile = useAuthStore((state) => state.updateProfile);
  const email = storedUser.email || "";

  const [name, setName] = useState(storedUser.name || storedUser.fullName || "");
  const [photo, setPhoto] = useState(storedUser.photo || "");

  // saved on the account (UserPreference), read by the wizard and translator
  const [currency, setCurrency] = useState("ZAR");
  const [language, setLanguage] = useState("EN-GB");

  // what's saved, so we can show "unsaved changes" and discard them
  const [baseline, setBaseline] = useState(() => ({
    name: storedUser.name || storedUser.fullName || "",
    photo: storedUser.photo || "",
    currency: "ZAR",
    language: "EN-GB",
  }));

  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [photoError, setPhotoError] = useState("");

  useEffect(() => {
    // the old page kept a plaintext password here; never used now
    try {
      localStorage.removeItem("user-password");
    } catch {
      // storage unavailable
    }

    fetchMe()
      .then((me) => {
        const next = {};
        if (me?.preferences?.currency) next.currency = me.preferences.currency;

        // older rows hold "en"; show the closest translator language
        const pref = String(me?.preferences?.language || "").toUpperCase();
        const match =
          LANGUAGES.find((l) => l.code === pref) ||
          LANGUAGES.find((l) => l.code.split("-")[0] === pref);
        if (match) next.language = match.code;

        if (next.currency) setCurrency(next.currency);
        if (next.language) setLanguage(next.language);
        setBaseline((current) => ({ ...current, ...next }));
      })
      .catch(() => {
        // keep the defaults; saving still works
      });
  }, []);

  const dirty =
    name !== baseline.name ||
    photo !== baseline.photo ||
    currency !== baseline.currency ||
    language !== baseline.language;

  /* ---------------- photo ---------------- */

  const handlePhotoChange = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setPhotoError("");

    if (!file.type.startsWith("image/")) {
      setPhotoError("Please choose an image file.");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setPhotoError("Your profile photo must be smaller than 5 MB.");
      return;
    }

    const reader = new FileReader();

    reader.onload = () => {
      resizePhoto(reader.result)
        .then(setPhoto)
        .catch(() => setPhotoError("We couldn't load that image. Please try again."));
    };

    reader.onerror = () => setPhotoError("We couldn't load that image. Please try again.");
    reader.readAsDataURL(file);
  };

  const removePhoto = () => {
    setPhoto("");
    setPhotoError("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  /* ---------------- save / discard ---------------- */

  const discard = () => {
    setName(baseline.name);
    setPhoto(baseline.photo);
    setCurrency(baseline.currency);
    setLanguage(baseline.language);
    setSaveError("");
    setPhotoError("");
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    const trimmedName = name.trim();
    const nameProblem = nameError(trimmedName, "your full name");
    if (nameProblem) {
      setSaveError(nameProblem);
      return;
    }

    setSaveError("");
    setSaving(true);

    try {
      await updateMe({ fullName: trimmedName, preferences: { currency, language } });
    } catch (requestError) {
      setSaveError(
        requestError instanceof Error ? requestError.message : "We couldn't save your profile."
      );
      setSaving(false);
      return;
    }

    setSaving(false);

    // the photo stays on this device; name mirrors the server's
    try {
      updateProfile({ name: trimmedName, email, photo });
    } catch {
      setPhotoError("Your details were saved, but the photo didn't fit in this browser's storage.");
    }

    setName(trimmedName);
    setBaseline({ name: trimmedName, photo, currency, language });
    notify("Your profile has been updated.");
  };

  const initials = initialsOf(name);

  return (
    <SettingsSection
      id="profile"
      icon={User}
      title="Profile & preferences"
      description="How you appear on Roamio and the defaults we use when planning and translating."
      aside={
        dirty ? (
          <span className="st-pill st-pill--warning">
            <span className="st-dot" />
            Unsaved changes
          </span>
        ) : (
          <span className="st-pill st-pill--success">
            <span className="st-dot" />
            Up to date
          </span>
        )
      }
    >
      <form className="st-card" onSubmit={handleSubmit} noValidate>
        {/* ---------- photo ---------- */}

        <div className="st-photo">
          <div className="st-photo-avatar">
            {photo ? (
              <img src={photo} alt={`${name || "Your"} profile`} />
            ) : (
              <span aria-hidden="true">{initials}</span>
            )}

            <button
              type="button"
              className="st-photo-camera"
              aria-label="Change profile photo"
              onClick={() => fileInputRef.current?.click()}
            >
              <Camera size={15} />
            </button>
          </div>

          <div className="st-photo-copy">
            <h3>Profile photo</h3>
            <p>A clear photo helps your travel group recognise you. JPG, PNG or WEBP, up to 5 MB.</p>

            <div className="st-button-row">
              <button
                type="button"
                className="st-btn st-btn--secondary st-btn--sm"
                onClick={() => fileInputRef.current?.click()}
              >
                <ImagePlus size={15} />
                {photo ? "Change photo" : "Upload photo"}
              </button>

              {photo && (
                <button type="button" className="st-btn st-btn--ghost-danger st-btn--sm" onClick={removePhoto}>
                  <Trash2 size={15} />
                  Remove
                </button>
              )}
            </div>

            <input ref={fileInputRef} type="file" accept="image/*" onChange={handlePhotoChange} hidden />

            {photoError && <p className="st-inline-error">{photoError}</p>}
          </div>
        </div>

        {/* ---------- details ---------- */}

        <div className="st-grid-2">
          <Field label="Full name">
            <div className="st-input">
              <User size={17} aria-hidden="true" />
              <input
                type="text"
                value={name}
                placeholder="Your full name"
                autoComplete="name"
                maxLength={80}
                onChange={(event) => setName(event.target.value)}
                required
              />
            </div>
          </Field>

          <Field label="Email address" hint="This is your sign-in email.">
            {/* changing it would need re-verification */}
            <div className="st-input is-readonly">
              <Mail size={17} aria-hidden="true" />
              <input type="email" value={email} autoComplete="email" readOnly />
            </div>
          </Field>

          <Field label="Home currency" hint="Used for budgets and expense totals.">
            <div className="st-input">
              <Wallet size={17} aria-hidden="true" />
              <select value={currency} onChange={(event) => setCurrency(event.target.value)}>
                {CURRENCIES.map((code) => (
                  <option key={code} value={code}>
                    {code}
                  </option>
                ))}
              </select>
            </div>
          </Field>

          <Field label="Translate into" hint="The translator's default target language.">
            <div className="st-input">
              <Languages size={17} aria-hidden="true" />
              <select value={language} onChange={(event) => setLanguage(event.target.value)}>
                {LANGUAGES.map((l) => (
                  <option key={l.code} value={l.code}>
                    {l.name}
                  </option>
                ))}
              </select>
            </div>
          </Field>
        </div>

        {saveError && <Notice tone="error">{saveError}</Notice>}

        <div className="st-card-foot">
          <button type="button" className="st-btn st-btn--secondary" onClick={discard} disabled={!dirty || saving}>
            Discard
          </button>

          <button type="submit" className="st-btn st-btn--primary" disabled={!dirty || saving}>
            {saving ? <Spinner /> : <Save size={16} />}
            {saving ? "Saving…" : "Save changes"}
          </button>
        </div>
      </form>

      {/* ---------- appearance (applies instantly, app-wide) ---------- */}

      <div className="st-card st-card--row">
        <CardHead
          icon={Palette}
          title="Appearance"
          description="Choose how Roamio looks. This applies to every page straight away."
        />

        <div className="st-segmented" role="radiogroup" aria-label="Theme">
          <button
            type="button"
            role="radio"
            aria-checked={theme === "light"}
            className={theme === "light" ? "is-active" : ""}
            onClick={() => setTheme("light")}
          >
            <Sun size={16} />
            Light
          </button>

          <button
            type="button"
            role="radio"
            aria-checked={theme === "dark"}
            className={theme === "dark" ? "is-active" : ""}
            onClick={() => setTheme("dark")}
          >
            <Moon size={16} />
            Dark
          </button>
        </div>
      </div>
    </SettingsSection>
  );
}
