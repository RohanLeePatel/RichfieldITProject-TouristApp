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
} from "lucide-react";

import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import "../styles/Settings.css";

export default function Settings() {
  const navigate = useNavigate();
  const fileInputRef = useRef(null);

  const storedUser = JSON.parse(localStorage.getItem("user") || "{}");

  const [name, setName] = useState(storedUser.name || "Savaan");
  const [email, setEmail] = useState(
    storedUser.email || "savaan@example.com"
  );
  const [photo, setPhoto] = useState(storedUser.photo || "");

  const [theme, setTheme] = useState(
    localStorage.getItem("settings-theme") || "light"
  );

  const [saved, setSaved] = useState(false);
  const [photoError, setPhotoError] = useState("");

  useEffect(() => {
    localStorage.setItem("settings-theme", theme);
  }, [theme]);

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

  const handleSubmit = (e) => {
    e.preventDefault();

    localStorage.setItem(
      "user",
      JSON.stringify({
        name,
        email,
        photo,
      })
    );

    setSaved(true);

    setTimeout(() => {
      setSaved(false);
    }, 3000);
  };

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
      {/* HERO / HEADER */}

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
              onClick={() =>
                setTheme(theme === "light" ? "dark" : "light")
              }
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

      {/* MAIN */}

      <main className="recommendations-content settings-content">
        <div className="settings-layout">
          <div className="settings-main-column">

            {/* PROFILE */}

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

              {/* PHOTO */}

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

              {/* FORM */}

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
                        onChange={(e) =>
                          setName(e.target.value)
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
                        onChange={(e) =>
                          setEmail(e.target.value)
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

            {/* SECURITY */}

            <section className="panel security-card">
              <div className="panel-title">
                <LockKeyhole size={15} />
                Security
              </div>

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
                  onClick={() =>
                    alert(
                      "Change password functionality coming soon."
                    )
                  }
                >
                  Change password
                  <ArrowRight size={14} />
                </button>
              </div>
            </section>
          </div>

          {/* SIDEBAR */}

          <aside className="settings-sidebar-content">

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
                A profile photo makes it easier for family
                and travel companions to recognize you when
                planning adventures together.
              </p>
            </section>

          </aside>
        </div>
      </main>
    </div>
  );
}