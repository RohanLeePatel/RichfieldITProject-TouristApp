import { useEffect, useMemo, useState } from "react";
import {
  Baby,
  BriefcaseBusiness,
  CalendarDays,
  Check,
  ChevronRight,
  Edit3,
  Heart,
  MapPin,
  MoreHorizontal,
  Plus,
  Search,
  ShieldCheck,
  Sparkles,
  Trash2,
  UserRound,
  Users,
  X,
  Plane,
  Compass,
  Camera,
  Utensils,
  Waves,
  Mountain,
  Trees,
  Globe2,
} from "lucide-react";
import { Link } from "react-router-dom";

import PageShell from "../components/recommendations/PageShell.jsx";
import "../styles/family.css";

const STORAGE_KEY = "roamio_family_members_v1";

const DEFAULT_MEMBERS = [
  {
    id: "member-1",
    name: "Duran",
    relationship: "Trip organizer",
    type: "Adult",
    email: "",
    initials: "DU",
    color: "blue",
    interests: ["Nature", "Culture", "Food"],
    trips: 4,
    status: "Organizer",
  },
  {
    id: "member-2",
    name: "Savaan",
    relationship: "Family member",
    type: "Adult",
    email: "",
    initials: "SA",
    color: "teal",
    interests: ["Adventure", "Beach"],
    trips: 3,
    status: "Active",
  },
  {
    id: "member-3",
    name: "Rohan",
    relationship: "Family member",
    type: "Adult",
    email: "",
    initials: "RO",
    color: "purple",
    interests: ["Nature", "Photography"],
    trips: 2,
    status: "Active",
  },
  {
    id: "member-4",
    name: "Yatheen",
    relationship: "Family member",
    type: "Adult",
    email: "",
    initials: "YA",
    color: "orange",
    interests: ["Adventure", "Beach"],
    trips: 2,
    status: "Active",
  },
  {
    id: "member-5",
    name: "Jordan",
    relationship: "Family member",
    type: "Adult",
    email: "",
    initials: "JO",
    color: "green",
    interests: ["Food", "Culture"],
    trips: 1,
    status: "Active",
  },
];

const INTERESTS = [
  {
    name: "Beach",
    icon: Waves,
  },
  {
    name: "Adventure",
    icon: Mountain,
  },
  {
    name: "Nature",
    icon: Trees,
  },
  {
    name: "Culture",
    icon: Globe2,
  },
  {
    name: "Food",
    icon: Utensils,
  },
  {
    name: "Photography",
    icon: Camera,
  },
];

const COLOR_OPTIONS = [
  "blue",
  "teal",
  "purple",
  "orange",
  "green",
];

const EMPTY_FORM = {
  name: "",
  relationship: "Family member",
  type: "Adult",
  email: "",
  interests: [],
  color: "teal",
};

const upcomingTrips = [
  {
    id: 1,
    title: "Durban Family Escape",
    destination: "Durban, South Africa",
    dates: "14–18 Aug 2026",
    members: 5,
    status: "Upcoming",
    color: "teal",
  },
  {
    id: 2,
    title: "Cape Town Adventure",
    destination: "Cape Town, South Africa",
    dates: "12–18 Sep 2026",
    members: 4,
    status: "Planning",
    color: "blue",
  },
  {
    id: 3,
    title: "Zanzibar Getaway",
    destination: "Zanzibar, Tanzania",
    dates: "10–16 Dec 2026",
    members: 5,
    status: "Planning",
    color: "purple",
  },
];

const recentActivity = [
  {
    id: 1,
    icon: Plus,
    title: "Yatheen was added to the family",
    time: "2 days ago",
  },
  {
    id: 2,
    icon: Plane,
    title: "Durban Family Escape was updated",
    time: "4 days ago",
  },
  {
    id: 3,
    icon: Heart,
    title: "Family travel preferences were updated",
    time: "1 week ago",
  },
];

function getInitials(name) {
  return (
    name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part.charAt(0))
      .join("")
      .toUpperCase() || "RM"
  );
}

function MemberAvatar({ member, large = false }) {
  return (
    <div
      className={`family-avatar family-avatar-${member.color || "teal"} ${
        large ? "family-avatar-large" : ""
      }`}
      aria-hidden="true"
    >
      {member.initials || getInitials(member.name)}
    </div>
  );
}

function InterestIcon({ name, size = 14 }) {
  const match = INTERESTS.find(
    (interest) => interest.name === name
  );

  const Icon = match?.icon || Compass;

  return <Icon size={size} />;
}

function MemberModal({
  open,
  mode,
  form,
  setForm,
  onClose,
  onSave,
}) {
  if (!open) return null;

  const toggleInterest = (interest) => {
    setForm((current) => ({
      ...current,
      interests: current.interests.includes(interest)
        ? current.interests.filter((item) => item !== interest)
        : [...current.interests, interest],
    }));
  };

  return (
    <div
      className="family-modal-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        className="family-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="family-modal-title"
      >
        <div className="family-modal-header">
          <div>
            <span className="family-modal-eyebrow">
              <Users size={14} />
              FAMILY PROFILE
            </span>

            <h2 id="family-modal-title">
              {mode === "edit"
                ? "Edit family member"
                : "Add family member"}
            </h2>

            <p>
              Keep your family's travel details together in Roamio.
            </p>
          </div>

          <button
            type="button"
            className="family-modal-close"
            onClick={onClose}
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={onSave}>
          <div className="family-form-grid">
            <label className="family-form-field family-form-field-wide">
              <span>Full name</span>

              <div className="family-input-wrap">
                <UserRound size={16} />

                <input
                  type="text"
                  value={form.name}
                  onChange={(event) =>
                    setForm({
                      ...form,
                      name: event.target.value,
                    })
                  }
                  placeholder="e.g. Sarah Smith"
                  required
                  autoFocus
                />
              </div>
            </label>

            <label className="family-form-field">
              <span>Relationship</span>

              <select
                value={form.relationship}
                onChange={(event) =>
                  setForm({
                    ...form,
                    relationship: event.target.value,
                  })
                }
              >
                <option>Family member</option>
                <option>Parent</option>
                <option>Partner</option>
                <option>Sibling</option>
                <option>Child</option>
                <option>Grandparent</option>
                <option>Other</option>
              </select>
            </label>

            <label className="family-form-field">
              <span>Age group</span>

              <select
                value={form.type}
                onChange={(event) =>
                  setForm({
                    ...form,
                    type: event.target.value,
                  })
                }
              >
                <option>Adult</option>
                <option>Child</option>
              </select>
            </label>

            <label className="family-form-field family-form-field-wide">
              <span>
                Email <small>Optional</small>
              </span>

              <div className="family-input-wrap">
                <BriefcaseBusiness size={16} />

                <input
                  type="email"
                  value={form.email}
                  onChange={(event) =>
                    setForm({
                      ...form,
                      email: event.target.value,
                    })
                  }
                  placeholder="family@example.com"
                />
              </div>
            </label>
          </div>

          <div className="family-form-section">
            <div className="family-form-section-heading">
              <div>
                <strong>Travel interests</strong>

                <span>
                  Choose what they enjoy when travelling.
                </span>
              </div>
            </div>

            <div className="family-interest-picker">
              {INTERESTS.map((interest) => {
                const selected = form.interests.includes(
                  interest.name
                );

                const Icon = interest.icon;

                return (
                  <button
                    type="button"
                    key={interest.name}
                    className={`family-interest-option ${
                      selected ? "selected" : ""
                    }`}
                    onClick={() =>
                      toggleInterest(interest.name)
                    }
                  >
                    <Icon size={17} />

                    <span>{interest.name}</span>

                    {selected && <Check size={14} />}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="family-form-section">
            <div className="family-form-section-heading">
              <div>
                <strong>Profile colour</strong>

                <span>
                  Choose an avatar colour.
                </span>
              </div>
            </div>

            <div className="family-colour-picker">
              {COLOR_OPTIONS.map((color) => (
                <button
                  type="button"
                  key={color}
                  className={`family-colour-option family-colour-${color} ${
                    form.color === color ? "selected" : ""
                  }`}
                  onClick={() =>
                    setForm({
                      ...form,
                      color,
                    })
                  }
                  aria-label={`Use ${color} avatar`}
                >
                  {form.color === color && (
                    <Check size={15} />
                  )}
                </button>
              ))}
            </div>
          </div>

          <div className="family-modal-actions">
            <button
              type="button"
              className="family-button family-button-secondary"
              onClick={onClose}
            >
              Cancel
            </button>

            <button
              type="submit"
              className="family-button family-button-primary"
              disabled={!form.name.trim()}
            >
              <Check size={16} />

              {mode === "edit"
                ? "Save changes"
                : "Add member"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function Family() {
  const [members, setMembers] = useState(() => {
    /*
     * Always start with the new Roamio family.
     *
     * This intentionally replaces the previous demo names:
     * Roamio User, Maya, Jayden and Ari.
     */
    try {
      const saved = localStorage.getItem(STORAGE_KEY);

      if (saved) {
        const parsed = JSON.parse(saved);

        if (Array.isArray(parsed) && parsed.length > 0) {
          const oldNames = [
            "Roamio User",
            "Maya",
            "Jayden",
            "Ari",
          ];

          const containsOldDemoData = parsed.some((member) =>
            oldNames.includes(member.name)
          );

          if (!containsOldDemoData) {
            return parsed;
          }
        }
      }
    } catch {
      // Fall back to the new default family.
    }

    return DEFAULT_MEMBERS;
  });

  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("All");
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState("add");
  const [selectedMember, setSelectedMember] =
    useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [menuOpen, setMenuOpen] = useState(null);
  const [toast, setToast] = useState("");

  useEffect(() => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(members)
    );
  }, [members]);

  useEffect(() => {
    if (!toast) return undefined;

    const timer = window.setTimeout(() => {
      setToast("");
    }, 2600);

    return () => window.clearTimeout(timer);
  }, [toast]);

  const adults = useMemo(
    () =>
      members.filter(
        (member) => member.type === "Adult"
      ),
    [members]
  );

  const children = useMemo(
    () =>
      members.filter(
        (member) => member.type === "Child"
      ),
    [members]
  );

  const totalTrips = useMemo(
    () =>
      members.reduce(
        (total, member) =>
          total + Number(member.trips || 0),
        0
      ),
    [members]
  );

  const familyInterests = useMemo(() => {
    const counts = {};

    members.forEach((member) => {
      (member.interests || []).forEach((interest) => {
        counts[interest] =
          (counts[interest] || 0) + 1;
      });
    });

    return INTERESTS.map((interest) => ({
      ...interest,
      count: counts[interest.name] || 0,
    }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  }, [members]);

  const filteredMembers = useMemo(() => {
    const query = search.trim().toLowerCase();

    return members.filter((member) => {
      const matchesSearch =
        !query ||
        member.name
          .toLowerCase()
          .includes(query) ||
        member.relationship
          .toLowerCase()
          .includes(query) ||
        member.type
          .toLowerCase()
          .includes(query);

      const matchesFilter =
        filter === "All" ||
        member.type === filter;

      return matchesSearch && matchesFilter;
    });
  }, [members, search, filter]);

  const openAddModal = () => {
    setModalMode("add");
    setSelectedMember(null);
    setForm(EMPTY_FORM);
    setModalOpen(true);
    setMenuOpen(null);
  };

  const openEditModal = (member) => {
    setModalMode("edit");
    setSelectedMember(member);

    setForm({
      name: member.name,
      relationship: member.relationship,
      type: member.type,
      email: member.email || "",
      interests: member.interests || [],
      color: member.color || "teal",
    });

    setModalOpen(true);
    setMenuOpen(null);
  };

  const closeModal = () => {
    setModalOpen(false);
    setSelectedMember(null);
    setForm(EMPTY_FORM);
  };

  const handleSaveMember = (event) => {
    event.preventDefault();

    const cleanName = form.name.trim();

    if (!cleanName) return;

    if (modalMode === "edit" && selectedMember) {
      setMembers((current) =>
        current.map((member) =>
          member.id === selectedMember.id
            ? {
                ...member,
                name: cleanName,
                relationship:
                  form.relationship,
                type: form.type,
                email: form.email.trim(),
                initials: getInitials(cleanName),
                color: form.color,
                interests: form.interests,
              }
            : member
        )
      );

      setToast(
        `${cleanName}'s profile was updated.`
      );
    } else {
      const newMember = {
        id: `member-${Date.now()}`,
        name: cleanName,
        relationship: form.relationship,
        type: form.type,
        email: form.email.trim(),
        initials: getInitials(cleanName),
        color: form.color,
        interests: form.interests,
        trips: 0,
        status: "Active",
      };

      setMembers((current) => [
        ...current,
        newMember,
      ]);

      setToast(
        `${cleanName} was added to your family.`
      );
    }

    closeModal();
  };

  const handleDeleteMember = (member) => {
    if (member.status === "Organizer") {
      setToast(
        "The trip organizer cannot be removed."
      );

      setMenuOpen(null);

      return;
    }

    const confirmed = window.confirm(
      `Remove ${member.name} from your Roamio family?`
    );

    if (!confirmed) return;

    setMembers((current) =>
      current.filter(
        (item) => item.id !== member.id
      )
    );

    setToast(
      `${member.name} was removed from your family.`
    );

    setMenuOpen(null);
  };

  const hero = (
    <>
      <p className="recommendations-eyebrow family-hero-eyebrow">
        <Sparkles size={15} />
        Your travel crew
      </p>

      <h1>
        Adventures are better
        <span> together.</span>
      </h1>

      <p>
        Keep your family organised, remember everyone's
        interests, and plan trips that work for the
        people you love.
      </p>
    </>
  );

  return (
    <PageShell
      backTo="/dashboard"
      backLabel="Back to dashboard"
      hero={hero}
    >
      <div className="family-page-content">

        {/* ================================
            FAMILY OVERVIEW
        ================================= */}

        <section className="family-overview">
          <div className="family-overview-heading">
            <div>
              <span className="family-section-eyebrow">
                <Users size={14} />
                FAMILY OVERVIEW
              </span>

              <h2>Your family at a glance</h2>

              <p>
                Everything you need to plan better trips
                together.
              </p>
            </div>

            <button
              type="button"
              className="family-button family-button-primary family-add-top"
              onClick={openAddModal}
            >
              <Plus size={17} />
              Add family member
            </button>
          </div>

          <div className="family-stat-grid">

            <div className="family-stat-card family-stat-primary">
              <div className="family-stat-icon">
                <Users size={20} />
              </div>

              <div>
                <span>Family members</span>
                <strong>{members.length}</strong>
                <small>Planning together</small>
              </div>

              <div className="family-stat-decoration">
                <Users size={64} />
              </div>
            </div>

            <div className="family-stat-card">
              <div className="family-stat-icon family-stat-icon-teal">
                <UserRound size={20} />
              </div>

              <div>
                <span>Adults</span>
                <strong>{adults.length}</strong>
                <small>Travel companions</small>
              </div>
            </div>

            <div className="family-stat-card">
              <div className="family-stat-icon family-stat-icon-purple">
                <Baby size={20} />
              </div>

              <div>
                <span>Children</span>
                <strong>{children.length}</strong>
                <small>Little explorers</small>
              </div>
            </div>

            <div className="family-stat-card">
              <div className="family-stat-icon family-stat-icon-orange">
                <Plane size={20} />
              </div>

              <div>
                <span>Family trips</span>
                <strong>
                  {Math.max(
                    3,
                    upcomingTrips.length
                  )}
                </strong>

                <small>
                  {totalTrips} member trips
                </small>
              </div>
            </div>

          </div>
        </section>

        {/* ================================
            MAIN FAMILY GRID
        ================================= */}

        <div className="family-main-grid">

          {/* FAMILY MEMBERS */}

          <section className="family-members-panel">
            <div className="family-panel-header">
              <div>
                <span className="family-section-eyebrow">
                  <Users size={14} />
                  YOUR PEOPLE
                </span>

                <h2>Family members</h2>

                <p>
                  Manage the people you travel and plan
                  with.
                </p>
              </div>

              <button
                type="button"
                className="family-mobile-add"
                onClick={openAddModal}
                aria-label="Add family member"
              >
                <Plus size={18} />
              </button>
            </div>

            {/* SEARCH + FILTER */}

            <div className="family-member-toolbar">
              <div className="family-search">
                <Search size={16} />

                <input
                  type="search"
                  value={search}
                  onChange={(event) =>
                    setSearch(event.target.value)
                  }
                  placeholder="Search family members..."
                  aria-label="Search family members"
                />

                {search && (
                  <button
                    type="button"
                    onClick={() => setSearch("")}
                    aria-label="Clear search"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>

              <div className="family-filter-tabs">
                {["All", "Adult", "Child"].map(
                  (item) => (
                    <button
                      type="button"
                      key={item}
                      className={
                        filter === item
                          ? "active"
                          : ""
                      }
                      onClick={() =>
                        setFilter(item)
                      }
                    >
                      {item}
                    </button>
                  )
                )}
              </div>
            </div>

            {/* MEMBER LIST */}

            {filteredMembers.length > 0 ? (
              <div className="family-member-list">
                {filteredMembers.map((member) => (
                  <article
                    className="family-member-card"
                    key={member.id}
                  >
                    <MemberAvatar
                      member={member}
                      large
                    />

                    <div className="family-member-main">

                      <div className="family-member-name-row">
                        <h3>{member.name}</h3>

                        {member.status ===
                        "Organizer" ? (
                          <span className="family-organizer-badge">
                            <ShieldCheck size={12} />
                            Organizer
                          </span>
                        ) : (
                          <span className="family-active-dot">
                            <i />
                            Active
                          </span>
                        )}
                      </div>

                      <p className="family-member-role">
                        {member.relationship}
                        <span>•</span>
                        {member.type}
                      </p>

                      <div className="family-member-meta">
                        <span>
                          <Plane size={13} />

                          {member.trips}{" "}
                          {member.trips === 1
                            ? "trip"
                            : "trips"}
                        </span>

                        {member.email && (
                          <span>
                            <BriefcaseBusiness
                              size={13}
                            />
                            {member.email}
                          </span>
                        )}
                      </div>

                      <div className="family-member-interests">
                        {(member.interests || [])
                          .length > 0 ? (
                          member.interests.map(
                            (interest) => (
                              <span key={interest}>
                                <InterestIcon
                                  name={interest}
                                  size={12}
                                />
                                {interest}
                              </span>
                            )
                          )
                        ) : (
                          <span className="family-no-interests">
                            No travel interests added
                          </span>
                        )}
                      </div>
                    </div>

                    {/* ACTIONS */}

                    <div className="family-member-actions">
                      <button
                        type="button"
                        className="family-icon-button"
                        onClick={() =>
                          openEditModal(member)
                        }
                        aria-label={`Edit ${member.name}`}
                        title="Edit member"
                      >
                        <Edit3 size={16} />
                      </button>

                      <div className="family-more-wrap">
                        <button
                          type="button"
                          className="family-icon-button"
                          onClick={() =>
                            setMenuOpen(
                              menuOpen ===
                                member.id
                                ? null
                                : member.id
                            )
                          }
                          aria-label={`More options for ${member.name}`}
                        >
                          <MoreHorizontal
                            size={17}
                          />
                        </button>

                        {menuOpen ===
                          member.id && (
                          <div className="family-member-menu">
                            <button
                              type="button"
                              onClick={() =>
                                openEditModal(
                                  member
                                )
                              }
                            >
                              <Edit3 size={14} />
                              Edit profile
                            </button>

                            <button
                              type="button"
                              className="danger"
                              onClick={() =>
                                handleDeleteMember(
                                  member
                                )
                              }
                            >
                              <Trash2 size={14} />
                              Remove member
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <div className="family-empty-state">
                <div className="family-empty-icon">
                  <Search size={24} />
                </div>

                <h3>No family members found</h3>

                <p>
                  Try another search or clear the
                  current filter.
                </p>

                <button
                  type="button"
                  className="family-button family-button-secondary"
                  onClick={() => {
                    setSearch("");
                    setFilter("All");
                  }}
                >
                  Clear filters
                </button>
              </div>
            )}

            <div className="family-list-footer">
              <span>
                Showing {filteredMembers.length} of{" "}
                {members.length} members
              </span>

              <button
                type="button"
                onClick={openAddModal}
              >
                <Plus size={14} />
                Add another member
              </button>
            </div>
          </section>

          {/* ================================
              RIGHT SIDEBAR
          ================================= */}

          <aside className="family-sidebar">

            {/* TRAVEL DNA */}

            <section className="family-preferences-card">
              <div className="family-card-heading">
                <div>
                  <span className="family-section-eyebrow">
                    <Heart size={14} />
                    TRAVEL DNA
                  </span>

                  <h2>What your family loves</h2>
                </div>

                <Sparkles size={19} />
              </div>

              <p className="family-card-description">
                Shared interests help Roamio create more
                personal destination recommendations.
              </p>

              <div className="family-interest-bars">
                {familyInterests.map((interest) => {
                  const Icon = interest.icon;

                  const percentage =
                    members.length > 0
                      ? Math.max(
                          8,
                          Math.round(
                            (interest.count /
                              members.length) *
                              100
                          )
                        )
                      : 0;

                  return (
                    <div
                      className="family-interest-bar"
                      key={interest.name}
                    >
                      <div className="family-interest-bar-top">
                        <span>
                          <Icon size={14} />
                          {interest.name}
                        </span>

                        <strong>
                          {interest.count}
                        </strong>
                      </div>

                      <div className="family-interest-track">
                        <span
                          style={{
                            width: `${percentage}%`,
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>

              <Link
                to="/recommendations"
                className="family-card-link"
              >
                Explore family recommendations
                <ChevronRight size={15} />
              </Link>
            </section>

            {/* PLAN TOGETHER */}

            <section className="family-together-card">
              <div className="family-together-art">
                <div className="family-together-circle circle-one" />
                <div className="family-together-circle circle-two" />

                <div className="family-together-plane">
                  <Plane size={24} />
                </div>

                <div className="family-mini-pin pin-one">
                  <MapPin size={13} />
                </div>

                <div className="family-mini-pin pin-two">
                  <MapPin size={13} />
                </div>
              </div>

              <div className="family-together-content">
                <span className="family-section-eyebrow">
                  <Compass size={14} />
                  PLAN TOGETHER
                </span>

                <h2>
                  One family. Many adventures.
                </h2>

                <p>
                  Build trips around everyone's
                  interests and create memories worth
                  keeping.
                </p>

                <Link
                  to="/trips"
                  className="family-button family-button-light"
                >
                  View family trips
                  <ChevronRight size={15} />
                </Link>
              </div>
            </section>
          </aside>
        </div>

        {/* ================================
            UPCOMING TRIPS
        ================================= */}

        <section className="family-trips-section">
          <div className="family-section-heading-row">
            <div>
              <span className="family-section-eyebrow">
                <CalendarDays size={14} />
                SHARED ADVENTURES
              </span>

              <h2>Upcoming family trips</h2>

              <p>
                Trips where your family can plan,
                explore and travel together.
              </p>
            </div>

            <Link
              to="/trips"
              className="family-outline-link"
            >
              View all trips
              <ChevronRight size={15} />
            </Link>
          </div>

          <div className="family-trip-grid">
            {upcomingTrips.map((trip) => (
              <Link
                to="/trips"
                className={`family-trip-card family-trip-${trip.color}`}
                key={trip.id}
              >
                <div className="family-trip-cover">
                  <div className="family-trip-cover-glow" />

                  <div className="family-trip-icon">
                    <Plane size={22} />
                  </div>

                  <span className="family-trip-status">
                    {trip.status}
                  </span>
                </div>

                <div className="family-trip-body">
                  <h3>{trip.title}</h3>

                  <p>
                    <MapPin size={14} />
                    {trip.destination}
                  </p>

                  <div className="family-trip-details">
                    <span>
                      <CalendarDays size={14} />
                      {trip.dates}
                    </span>

                    <span>
                      <Users size={14} />
                      {trip.members} members
                    </span>
                  </div>

                  <div className="family-trip-link">
                    Open trip
                    <ChevronRight size={15} />
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </section>

        {/* ================================
            BOTTOM SECTION
        ================================= */}

        <section className="family-bottom-grid">

          {/* RECENT ACTIVITY */}

          <div className="family-activity-card">
            <div className="family-section-heading-row compact">
              <div>
                <span className="family-section-eyebrow">
                  <Sparkles size={14} />
                  RECENT ACTIVITY
                </span>

                <h2>What's happening</h2>
              </div>
            </div>

            <div className="family-activity-list">
              {recentActivity.map((activity) => {
                const Icon = activity.icon;

                return (
                  <div
                    className="family-activity-item"
                    key={activity.id}
                  >
                    <div className="family-activity-icon">
                      <Icon size={16} />
                    </div>

                    <div>
                      <strong>
                        {activity.title}
                      </strong>

                      <span>
                        {activity.time}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* INVITE */}

          <div className="family-invite-card">
            <div className="family-invite-icon">
              <Users size={22} />
            </div>

            <div>
              <span className="family-section-eyebrow">
                GROW YOUR CREW
              </span>

              <h2>
                Travelling with someone new?
              </h2>

              <p>
                Add another family member so they can be
                part of your next Roamio adventure.
              </p>

              <button
                type="button"
                className="family-button family-button-primary"
                onClick={openAddModal}
              >
                <Plus size={16} />
                Add family member
              </button>
            </div>
          </div>
        </section>
      </div>

      {/* ================================
          MEMBER MODAL
      ================================= */}

      <MemberModal
        open={modalOpen}
        mode={modalMode}
        form={form}
        setForm={setForm}
        onClose={closeModal}
        onSave={handleSaveMember}
      />

      {/* ================================
          TOAST
      ================================= */}

      {toast && (
        <div className="family-toast" role="status">
          <div className="family-toast-icon">
            <Check size={15} />
          </div>

          <span>{toast}</span>
        </div>
      )}
    </PageShell>
  );
}

