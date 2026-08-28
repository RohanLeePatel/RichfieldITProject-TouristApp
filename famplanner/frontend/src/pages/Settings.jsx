import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  LockKeyhole,
  Mail,
  Plane,
  Save,
  Settings as SettingsIcon,
  User,
} from "lucide-react";

import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import "../styles/settings.css";

export default function Settings() {
  const navigate = useNavigate();

  // Current user data
  const [name, setName] = useState("Savaan");
  const [email, setEmail] = useState("savaan@example.com");

  const [saved, setSaved] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();

    // For now, save locally.
    // Replace this with your API/update-profile hook later.
    localStorage.setItem(
      "user",
      JSON.stringify({
        name,
        email,
      })
    );

    setSaved(true);

    setTimeout(() => {
      setSaved(false);
    }, 3000);
  };

  return (
    <div className="settings-page">

      {/* SIDEBAR */}

      <aside className="settings-sidebar">

        <div className="settings-logo">

          <div className="settings-logo-icon">
            <Plane size={20} />
          </div>

          <span>
            Rom<span>io</span>
          </span>

        </div>


        <nav className="settings-nav">

          <Link to="/dashboard">
            <ArrowLeft size={18} />
            Back to dashboard
          </Link>

        </nav>


        <div className="settings-sidebar-bottom">

          <div className="settings-tip">

            <div>
              <SettingsIcon size={18} />
            </div>

            <span>
              Manage your account and profile
              information.
            </span>

          </div>

        </div>

      </aside>


      {/* MAIN */}

      <main className="settings-main">

        {/* HEADER */}

        <header className="settings-header">

          <div>

            <span className="settings-eyebrow">
              ACCOUNT SETTINGS
            </span>

            <h1>
              Edit your profile
            </h1>

            <p>
              Update your personal information and
              keep your Roamio profile up to date.
            </p>

          </div>

        </header>


        {/* CONTENT */}

        <div className="settings-content">


          {/* PROFILE CARD */}

          <section className="profile-card">

            <div className="profile-card-header">

              <div>

                <span className="settings-section-label">
                  YOUR PROFILE
                </span>

                <h2>
                  Personal information
                </h2>

                <p>
                  This information will be used for
                  your Roamio account.
                </p>

              </div>


              {/* AVATAR */}

              <div className="large-profile-avatar">
                {name
                  ? name.charAt(0).toUpperCase()
                  : "U"}
              </div>

            </div>


            <form onSubmit={handleSubmit}>

              {/* NAME */}

              <div className="settings-input-group">

                <label htmlFor="profile-name">
                  Full name
                </label>

                <div className="settings-input">

                  <User size={18} />

                  <input
                    id="profile-name"
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

              </div>


              {/* EMAIL */}

              <div className="settings-input-group">

                <label htmlFor="profile-email">
                  Email address
                </label>

                <div className="settings-input">

                  <Mail size={18} />

                  <input
                    id="profile-email"
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

              </div>


              {/* SAVE */}

              <div className="settings-actions">

                <button
                  type="button"
                  className="settings-cancel"
                  onClick={() =>
                    navigate("/dashboard")
                  }
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="settings-save"
                >

                  <Save size={17} />

                  Save changes

                  <ArrowRight size={16} />

                </button>

              </div>

            </form>


            {/* SUCCESS */}

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


          {/* PASSWORD CARD */}

          <section className="password-card">

            <div className="password-icon">

              <LockKeyhole size={20} />

            </div>

            <div className="password-info">

              <span className="settings-section-label">
                SECURITY
              </span>

              <h2>
                Password
              </h2>

              <p>
                Keep your account secure by using a
                strong password.
              </p>

            </div>

            <button
              type="button"
              className="change-password-button"
              onClick={() =>
                alert(
                  "Change password functionality coming soon."
                )
              }
            >
              Change password
              <ArrowRight size={15} />
            </button>

          </section>


          {/* ACCOUNT INFO */}

          <section className="account-info-card">

            <div className="account-plane">
              <Plane size={28} />
            </div>

            <div>

              <span className="settings-section-label">
                Roamio ACCOUNT
              </span>

              <h3>
                Plan better. Travel happier.
              </h3>

              <p>
                Your profile information helps your
                family recognize you when planning
                adventures together.
              </p>

            </div>

          </section>

        </div>

      </main>

    </div>
  );
}