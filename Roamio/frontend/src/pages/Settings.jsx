import {
  ArrowLeft,
  ArrowRight,
  Camera,
  CheckCircle2,
  ImagePlus,
  LockKeyhole,
  Mail,
  Moon,
  Plane,
  Save,
  Settings as SettingsIcon,
  Sun,
  Trash2,
  User,
  X,
} from "lucide-react";

import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import { fetchMe, resetPassword, sendPasswordCode, updateMe } from "../api/account.js";
import useTheme from "../components/recommendations/useTheme.js";
import { CURRENCIES } from "./recommendations/constants.js";
import { useAuthStore } from "../store/authStore.js";
import { LANGUAGES } from "../utils/translatorHelpers";
import "../styles/Settings.css";

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

export default function Settings() {
  const navigate = useNavigate();
  const fileInputRef = useRef(null);

  const storedUser = useAuthStore((state) => state.user) || {};
  const updateProfile = useAuthStore((state) => state.updateProfile);

  /* ---------------- PROFILE STATE ---------------- */

  const [name, setName] = useState(
    storedUser.name || storedUser.fullName || ""
  );
  const email = storedUser.email || "";
  const [photo, setPhoto] = useState(storedUser.photo || "");

  // saved on the account (UserPreference), read by the wizard and translator
  const [currency, setCurrency] = useState("ZAR");
  const [language, setLanguage] = useState("EN-GB");
  const [saveError, setSaveError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    // the old page kept a plaintext password here; never used now
    localStorage.removeItem("user-password");
    fetchMe()
      .then((me) => {
        if (me?.preferences?.currency) setCurrency(me.preferences.currency);
        // older rows hold "en"; show the closest translator language
        const pref = String(me?.preferences?.language || "").toUpperCase();
        const match = LANGUAGES.find((l) => l.code === pref) || LANGUAGES.find((l) => l.code.split("-")[0] === pref);
        if (match) setLanguage(match.code);
      })
      .catch(() => {
        // keep the defaults; saving still works
      });
  }, []);

  // app-wide theme - changing it here updates every page
  const { theme, toggle: toggleTheme, setTheme } = useTheme();

  const [saved, setSaved] = useState(false);
  const [photoError, setPhotoError] = useState("");

  /* ---------------- PASSWORD STATE ---------------- */

  const [showPasswordForm, setShowPasswordForm] = useState(false);

  // the emailed reset code - the server's way of proving it's you
  const [resetCode, setResetCode] = useState("");
  const [codeSent, setCodeSent] = useState(false);
  const [passwordBusy, setPasswordBusy] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [passwordError, setPasswordError] = useState("");
  const [passwordSaved, setPasswordSaved] = useState(false);

  /* ---------------- PROFILE PHOTO ---------------- */

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
        .catch(() =>
          setPhotoError("We couldn't load that image. Please try again.")
        );
    };

    reader.onerror = () => {
      setPhotoError("We couldn't load that image. Please try again.");
    };

    reader.readAsDataURL(file);
  };

  const removePhoto = () => {
    setPhoto("");
    setPhotoError("");

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  /* ---------------- SAVE PROFILE ---------------- */

  const handleSubmit = async (event) => {
    event.preventDefault();

    const trimmedName = name.trim();

    if (!trimmedName) {
      setSaveError("Please enter your full name.");
      return;
    }

    if (trimmedName.length > 80) {
      setSaveError("Keep your name under 80 characters.");
      return;
    }

    setSaveError("");
    setSaving(true);
    try {
      await updateMe({ fullName: trimmedName, preferences: { currency, language } });
    } catch (requestError) {
      setSaveError(requestError instanceof Error ? requestError.message : "We couldn't save your profile.");
      setSaving(false);
      return;
    }
    setSaving(false);

    // the photo stays on this device; name mirrors the server's
    try {
      updateProfile({
        name: trimmedName,
        email,
        photo,
      });
    } catch {
      setPhotoError(
        "Your details were saved, but the photo didn't fit in this browser's storage."
      );
    }

    setName(trimmedName);

    setSaved(true);

    setTimeout(() => {
      setSaved(false);
    }, 3000);
  };

  /* ---------------- PASSWORD ---------------- */

  const resetPasswordForm = () => {
    setPasswordError("");
    setPasswordSaved(false);
    setResetCode("");
    setCodeSent(false);
    setNewPassword("");
    setConfirmPassword("");
  };

  const openPasswordForm = () => {
    resetPasswordForm();
    setShowPasswordForm(true);
  };

  const closePasswordForm = () => {
    setShowPasswordForm(false);
    resetPasswordForm();
  };

  const handleSendCode = async () => {
    setPasswordError("");
    setPasswordBusy(true);
    try {
      await sendPasswordCode(email);
      setCodeSent(true);
    } catch (requestError) {
      setPasswordError(requestError instanceof Error ? requestError.message : "We couldn't send a code.");
    } finally {
      setPasswordBusy(false);
    }
  };

  const handlePasswordChange = async (event) => {
    event.preventDefault();

    setPasswordError("");
    setPasswordSaved(false);

    if (!/^\d{6}$/.test(resetCode.trim())) {
      setPasswordError("Enter the 6-digit code from your email.");
      return;
    }

    if (!newPassword) {
      setPasswordError("Please enter a new password.");
      return;
    }

    if (newPassword.length < 8) {
      setPasswordError(
        "Your new password must be at least 8 characters long."
      );
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordError("The new passwords do not match.");
      return;
    }

    setPasswordBusy(true);
    try {
      await resetPassword({ email, otp: resetCode.trim(), newPassword });
    } catch (requestError) {
      setPasswordError(requestError instanceof Error ? requestError.message : "We couldn't change your password.");
      return;
    } finally {
      setPasswordBusy(false);
    }

    setResetCode("");
    setNewPassword("");
    setConfirmPassword("");

    setPasswordSaved(true);

    setTimeout(() => {
      setPasswordSaved(false);
      setShowPasswordForm(false);
    }, 2500);
  };

  /* ---------------- INITIALS ---------------- */

  const initials = name
    ? name
        .trim()
        .split(/\s+/)
        .slice(0, 2)
        .map((part) => part.charAt(0).toUpperCase())
        .join("")
    : "U";

  return (
    <div
      className="recommendations-page settings-page"
      data-theme={theme}
    >
      {/* ================= HERO / HEADER ================= */}

      <section className="settings-hero">
        <header className="recommendations-header">
          <Link to="/dashboard" className="recommendations-back-link">
            <ArrowLeft size={17} />
            Back to dashboard
          </Link>

          <div className="rx-header-right">
            <div className="recommendations-brand">
              <span>
                <Plane size={17} />
              </span>
              Roamio
            </div>

            <button
              type="button"
              className="theme-toggle"
              aria-label={`Switch to ${
                theme === "light" ? "dark" : "light"
              } mode`}
              onClick={toggleTheme}
            >
              {theme === "light" ? (
                <Moon size={17} />
              ) : (
                <Sun size={17} />
              )}
            </button>
          </div>
        </header>

        <div className="rx-hero-body settings-hero-body">
          <p className="recommendations-eyebrow">
            <SettingsIcon size={14} />
            Account settings
          </p>

          <h1>Edit your profile</h1>

          <p>
            Keep your Roamio profile up to date so your
            travel plans feel a little more personal.
          </p>
        </div>
      </section>

      {/* ================= MAIN ================= */}

      <main className="recommendations-content settings-content">
        <div className="settings-layout">
          <div className="settings-main-column">

            {/* ================= PROFILE ================= */}

            <section className="panel profile-edit-card">
              <div className="panel-title">
                <User size={15} />
                Your profile
              </div>

              <div className="settings-section-intro">
                <div>
                  <h2>Personal information</h2>

                  <p>
                    Add your details and a profile photo so
                    your account feels like yours.
                  </p>
                </div>

                <div className="profile-status">
                  <span className="status-dot" />
                  Profile
                </div>
              </div>

              {/* ================= PHOTO ================= */}

              <div className="profile-photo-section">
                <div className="profile-avatar-wrap">
                  {photo ? (
                    <img
                      src={photo}
                      alt={`${name || "Your"} profile`}
                      className="profile-avatar-image"
                    />
                  ) : (
                    <div className="profile-avatar-placeholder">
                      {initials}
                    </div>
                  )}

                  <button
                    type="button"
                    className="profile-camera-button"
                    aria-label="Change profile photo"
                    onClick={() =>
                      fileInputRef.current?.click()
                    }
                  >
                    <Camera size={16} />
                  </button>
                </div>

                <div className="profile-photo-copy">
                  <h3>Profile photo</h3>

                  <p>
                    Choose a photo of yourself. JPG, PNG,
                    WEBP and other common image formats are
                    supported.
                  </p>

                  <div className="profile-photo-actions">
                    <button
                      type="button"
                      className="secondary-button"
                      onClick={() =>
                        fileInputRef.current?.click()
                      }
                    >
                      <ImagePlus size={16} />
                      {photo ? "Change photo" : "Add photo"}
                    </button>

                    {photo && (
                      <button
                        type="button"
                        className="photo-remove-button"
                        onClick={removePhoto}
                      >
                        <Trash2 size={15} />
                        Remove
                      </button>
                    )}
                  </div>

                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handlePhotoChange}
                    hidden
                  />

                  {photoError && (
                    <p className="photo-error">
                      {photoError}
                    </p>
                  )}
                </div>
              </div>

              {/* ================= FORM ================= */}

              <form onSubmit={handleSubmit}>
                <div className="settings-field-grid">

                  <label className="settings-field">
                    <span>Full name</span>

                    <div className="settings-input">
                      <User size={17} />

                      <input
                        type="text"
                        value={name}
                        placeholder="Your full name"
                        autoComplete="name"
                        maxLength={80}
                        onChange={(event) =>
                          setName(event.target.value)
                        }
                        required
                      />
                    </div>
                  </label>

                  <label className="settings-field">
                    <span>Email address</span>

                    <div className="settings-input">
                      <Mail size={17} />

                      {/* sign-in email; changing it would need re-verification */}
                      <input
                        type="email"
                        value={email}
                        autoComplete="email"
                        readOnly
                      />
                    </div>
                  </label>

                  <label className="settings-field">
                    <span>Home currency</span>

                    <div className="settings-input">
                      <select value={currency} onChange={(event) => setCurrency(event.target.value)}>
                        {CURRENCIES.map((code) => (
                          <option key={code} value={code}>{code}</option>
                        ))}
                      </select>
                    </div>
                  </label>

                  <label className="settings-field">
                    <span>Translate into</span>

                    <div className="settings-input">
                      <select value={language} onChange={(event) => setLanguage(event.target.value)}>
                        {LANGUAGES.map((l) => (
                          <option key={l.code} value={l.code}>{l.name}</option>
                        ))}
                      </select>
                    </div>
                  </label>

                </div>

                <div className="settings-actions">
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={() =>
                      navigate("/dashboard")
                    }
                  >
                    Cancel
                  </button>

                  <button
                    type="submit"
                    className="recommendations-submit"
                    disabled={saving}
                  >
                    <Save size={16} />
                    {saving ? "Saving..." : "Save changes"}
                    <ArrowRight size={15} />
                  </button>
                </div>
              </form>

              {saveError && (
                <div className="password-error">
                  <span>{saveError}</span>
                </div>
              )}

              {saved && (
                <div className="settings-success">
                  <CheckCircle2 size={17} />

                  <span>
                    Your profile has been updated
                    successfully.
                  </span>
                </div>
              )}
            </section>

            {/* ================= SECURITY ================= */}

            <section className="panel security-card">
              <div className="panel-title">
                <LockKeyhole size={15} />
                Security
              </div>

              {!showPasswordForm ? (
                <div className="settings-row">
                  <div className="settings-row-icon">
                    <LockKeyhole size={19} />
                  </div>

                  <div className="settings-row-copy">
                    <h3>Password</h3>

                    <p>
                      Keep your account secure with a strong
                      password.
                    </p>
                  </div>

                  <button
                    type="button"
                    className="card-link-button"
                    onClick={openPasswordForm}
                  >
                    Change password
                    <ArrowRight size={14} />
                  </button>
                </div>
              ) : (
                <div className="password-change-container">
                  <div className="password-change-header">
                    <div>
                      <h3>Change your password</h3>

                      <p>
                        We&apos;ll email a 6-digit code to {email}.
                        Enter it with a new password of at least
                        8 characters.
                      </p>
                    </div>

                    <button
                      type="button"
                      className="password-close-button"
                      aria-label="Close password form"
                      onClick={closePasswordForm}
                    >
                      <X size={18} />
                    </button>
                  </div>

                  <form
                    onSubmit={handlePasswordChange}
                    className="password-form"
                  >
                    <button
                      type="button"
                      className="secondary-button"
                      onClick={handleSendCode}
                      disabled={passwordBusy}
                    >
                      <Mail size={16} />
                      {codeSent ? "Send a new code" : "Email me a code"}
                    </button>

                    <label className="settings-field">
                      <span>Code from your email</span>

                      <div className="settings-input">
                        <Mail size={17} />

                        <input
                          type="text"
                          inputMode="numeric"
                          value={resetCode}
                          placeholder="123456"
                          autoComplete="one-time-code"
                          maxLength={6}
                          onChange={(event) =>
                            setResetCode(event.target.value)
                          }
                          required
                        />
                      </div>
                    </label>

                    <label className="settings-field">
                      <span>New password</span>

                      <div className="settings-input">
                        <LockKeyhole size={17} />

                        <input
                          type="password"
                          value={newPassword}
                          placeholder="At least 8 characters"
                          autoComplete="new-password"
                          onChange={(event) =>
                            setNewPassword(
                              event.target.value
                            )
                          }
                          required
                        />
                      </div>
                    </label>

                    <label className="settings-field">
                      <span>Confirm new password</span>

                      <div className="settings-input">
                        <LockKeyhole size={17} />

                        <input
                          type="password"
                          value={confirmPassword}
                          placeholder="Enter your new password again"
                          autoComplete="new-password"
                          onChange={(event) =>
                            setConfirmPassword(
                              event.target.value
                            )
                          }
                          required
                        />
                      </div>
                    </label>

                    {passwordError && (
                      <div className="password-error">
                        <span>{passwordError}</span>
                      </div>
                    )}

                    {passwordSaved && (
                      <div className="settings-success">
                        <CheckCircle2 size={17} />

                        <span>
                          Your password has been changed
                          successfully.
                        </span>
                      </div>
                    )}

                    <div className="password-actions">
                      <button
                        type="button"
                        className="secondary-button"
                        onClick={closePasswordForm}
                      >
                        Cancel
                      </button>

                      <button
                        type="submit"
                        className="recommendations-submit"
                        disabled={passwordBusy || !codeSent}
                      >
                        <LockKeyhole size={16} />
                        Update password
                      </button>
                    </div>
                  </form>
                </div>
              )}
            </section>
          </div>

          {/* ================= SIDEBAR ================= */}

          <aside className="settings-sidebar-content">

            <section className="panel settings-appearance-card">
              <div className="panel-title">
                {theme === "dark" ? <Moon size={15} /> : <Sun size={15} />}
                Appearance
              </div>

              <p>
                Choose how Roamio looks. This applies to
                every page.
              </p>

              <div
                className="appearance-options"
                role="radiogroup"
                aria-label="Theme"
              >
                <button
                  type="button"
                  role="radio"
                  aria-checked={theme === "light"}
                  className={theme === "light" ? "active" : ""}
                  onClick={() => setTheme("light")}
                >
                  <Sun size={16} />
                  Light
                </button>

                <button
                  type="button"
                  role="radio"
                  aria-checked={theme === "dark"}
                  className={theme === "dark" ? "active" : ""}
                  onClick={() => setTheme("dark")}
                >
                  <Moon size={16} />
                  Dark
                </button>
              </div>
            </section>

            <section className="panel settings-preview-card">
              <div className="panel-title">
                <User size={15} />
                Profile preview
              </div>

              <div className="settings-preview-avatar">
                {photo ? (
                  <img
                    src={photo}
                    alt=""
                  />
                ) : (
                  initials
                )}
              </div>

              <h3>
                {name || "Your name"}
              </h3>

              <p>
                {email || "you@example.com"}
              </p>

              <div className="preview-divider" />

              <div className="preview-detail">
                <span>Profile photo</span>

                <strong>
                  {photo ? "Added" : "Not added"}
                </strong>
              </div>

              <div className="preview-detail">
                <span>Account</span>

                <strong>Roamio</strong>
              </div>
            </section>

            <section className="panel settings-tip-card">
              <div className="settings-tip-icon">
                <Plane size={18} />
              </div>

              <h3>
                Make it yours
              </h3>

              <p>
                Add your own details and profile photo so
                your Roamio account feels personal.
              </p>
            </section>

          </aside>
        </div>
      </main>
    </div>
  );
}