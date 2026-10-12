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

import { useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import useTheme from "../components/recommendations/useTheme.js";
import "../styles/Settings.css";

export default function Settings() {
  const navigate = useNavigate();
  const fileInputRef = useRef(null);

  /*
   * Get the currently saved user.
   * If there is no user yet, create an empty/default profile.
   */
  const getStoredUser = () => {
    try {
      return JSON.parse(localStorage.getItem("user") || "{}");
    } catch {
      return {};
    }
  };

  const storedUser = getStoredUser();

  /* ---------------- PROFILE STATE ---------------- */

  const [name, setName] = useState(storedUser.name || "");
  const [email, setEmail] = useState(storedUser.email || "");
  const [photo, setPhoto] = useState(storedUser.photo || "");

  // app-wide theme - changing it here updates every page
  const { theme, toggle: toggleTheme, setTheme } = useTheme();

  const [saved, setSaved] = useState(false);
  const [photoError, setPhotoError] = useState("");

  /* ---------------- PASSWORD STATE ---------------- */

  const [showPasswordForm, setShowPasswordForm] = useState(false);

  const [currentPassword, setCurrentPassword] = useState("");
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
      setPhoto(reader.result);
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

  const handleSubmit = (event) => {
    event.preventDefault();

    const trimmedName = name.trim();
    const trimmedEmail = email.trim();

    if (!trimmedName) {
      return;
    }

    if (!trimmedEmail) {
      return;
    }

    /*
     * Keep any other user properties that may already
     * exist in localStorage.
     */
    const currentUser = getStoredUser();

    const updatedUser = {
      ...currentUser,
      name: trimmedName,
      email: trimmedEmail,
      photo,
    };

    localStorage.setItem("user", JSON.stringify(updatedUser));

    setName(trimmedName);
    setEmail(trimmedEmail);

    setSaved(true);

    setTimeout(() => {
      setSaved(false);
    }, 3000);
  };

  /* ---------------- PASSWORD ---------------- */

  const openPasswordForm = () => {
    setPasswordError("");
    setPasswordSaved(false);
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setShowPasswordForm(true);
  };

  const closePasswordForm = () => {
    setShowPasswordForm(false);
    setPasswordError("");
    setPasswordSaved(false);
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
  };

  const handlePasswordChange = (event) => {
    event.preventDefault();

    setPasswordError("");
    setPasswordSaved(false);

    /*
     * Your login system should normally store passwords
     * securely on a backend.
     *
     * For this localStorage-based project, we use the
     * password saved in localStorage.
     */
    const storedPassword = localStorage.getItem("user-password");

    /*
     * If the user has never created a password before,
     * allow them to create their first password without
     * requiring an old one.
     */
    if (storedPassword && currentPassword !== storedPassword) {
      setPasswordError("Your current password is incorrect.");
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

    if (storedPassword && newPassword === storedPassword) {
      setPasswordError(
        "Your new password must be different from your current password."
      );
      return;
    }

    /*
     * Save the new password.
     *
     * NOTE:
     * For a real production application, passwords should
     * NEVER be stored directly in localStorage. They should
     * be securely hashed and stored on a server.
     */
    localStorage.setItem("user-password", newPassword);

    setCurrentPassword("");
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

          <div className="recommendations-brand">
            <span>
              <Plane size={18} />
            </span>
            Roamio
          </div>

          <div className="rx-header-right">
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

                      <input
                        type="email"
                        value={email}
                        placeholder="you@example.com"
                        autoComplete="email"
                        onChange={(event) =>
                          setEmail(event.target.value)
                        }
                        required
                      />
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
                  >
                    <Save size={16} />
                    Save changes
                    <ArrowRight size={15} />
                  </button>
                </div>
              </form>

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
                        Choose a strong password that is at
                        least 8 characters long.
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
                    {localStorage.getItem("user-password") && (
                      <label className="settings-field">
                        <span>Current password</span>

                        <div className="settings-input">
                          <LockKeyhole size={17} />

                          <input
                            type="password"
                            value={currentPassword}
                            placeholder="Enter current password"
                            autoComplete="current-password"
                            onChange={(event) =>
                              setCurrentPassword(
                                event.target.value
                              )
                            }
                            required
                          />
                        </div>
                      </label>
                    )}

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
