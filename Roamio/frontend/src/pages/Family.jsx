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
  Castle,
  Coffee,
  Droplets,
  FerrisWheel,
  Fish,
  Landmark,
  Sandwich,
  Utensils,
  Waves,
  Mountain,
  Trees,
} from "lucide-react";
import { Link, useNavigate } from "react-router-dom";

import TravelGroups from "../components/groups/TravelGroups.jsx";
import PageShell from "../components/recommendations/PageShell.jsx";
import { fetchTrips } from "../api/trips";
import { INTEREST_TAGS } from "./recommendations/constants.js";
import "../styles/Family.css";

import { familyStorageKey } from "../store/authStore.js";

// The wizard's own interest tags, so a member's picks can pre-fill the
// wizard's group step as-is (one vocabulary across the app).
const TAG_ICONS = {
  parks: Trees, hiking: Mountain, beaches: Waves, waterparks: Droplets,
  museums: Landmark, historic_sites: Castle,
  restaurants: Utensils, cafes: Coffee, street_food: Sandwich,
  theme_parks: FerrisWheel, zoos_aquariums: Fish, playgrounds: Baby,
};

const INTERESTS = INTEREST_TAGS.map((tag) => ({ id: tag.id, name: tag.label, icon: TAG_ICONS[tag.id] || Compass }));

// picks saved under the old list, mapped to the closest wizard tag
// ("Photography" has none and is dropped)
const LEGACY_INTERESTS = { Beach: "Beaches", Adventure: "Hiking", Nature: "Parks", Culture: "Museums", Food: "Restaurants" };

const COLOR_OPTIONS = [
  "blue",
  "teal",
  "purple",
  "orange",
  "green",
];

const EMPTY_FORM = {
  name: "",
  relationship: "Group member",
  type: "Adult",
  // children only: the wizard's "children's ages" comes from these
  age: "",
  email: "",
  interests: [],
  color: "teal",
};

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

function normalizeMember(member) {
  return {
    ...member,
    relationship:
      member.relationship === "Family member"
        ? "Group member"
        : member.relationship || "Group member",
    trips: Number(member.trips || 0),
    interests: Array.isArray(member.interests)
      ? [...new Set(member.interests.map((name) => LEGACY_INTERESTS[name] || name))]
          .filter((name) => INTERESTS.some((interest) => interest.name === name))
      : [],
    initials:
      member.initials || getInitials(member.name || ""),
    color: member.color || "teal",
    status: member.status || "Active",
  };
}

function normalizeTrip(trip) {
  return {
    ...trip,
    id: trip.id,
    title:
      trip.title ||
      trip.name ||
      "Untitled trip",
    destination:
      trip.destination ||
      "Destination not specified",
    startDate: trip.startDate || null,
    endDate: trip.endDate || null,
    status: trip.status || null,
  };
}

function formatTripDates(startDate, endDate) {
  if (!startDate && !endDate) {
    return "Dates not set";
  }

  const formatDate = (value) => {
    if (!value) return null;

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return null;
    }

    return date.toLocaleDateString(undefined, {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  };

  const start = formatDate(startDate);
  const end = formatDate(endDate);

  if (start && end) {
    return `${start} – ${end}`;
  }

  return start || end || "Dates not set";
}

function getTripStatus(trip) {
  const start = trip.startDate
    ? new Date(trip.startDate)
    : null;

  const end = trip.endDate
    ? new Date(trip.endDate)
    : null;

  const now = new Date();

  if (
    end &&
    !Number.isNaN(end.getTime()) &&
    now > end
  ) {
    return "Completed";
  }

  if (
    start &&
    !Number.isNaN(start.getTime()) &&
    now >= start
  ) {
    return "Upcoming";
  }

  return "Planning";
}

function getTripColor(index) {
  const colors = ["teal", "blue", "purple"];

  return colors[index % colors.length];
}

function MemberAvatar({ member, large = false }) {
  return (
    <div
      className={`family-avatar family-avatar-${
        member.color || "teal"
      } ${large ? "family-avatar-large" : ""}`}
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
        ? current.interests.filter(
            (item) => item !== interest
          )
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
              TRAVEL GROUP PROFILE
            </span>

            <h2 id="family-modal-title">
              {mode === "edit"
                ? "Edit group member"
                : "Add group member"}
            </h2>

            <p>
              Keep your travel group's details together
              in Roamio.
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
                <option>Group member</option>
                <option>Parent</option>
                <option>Partner</option>
                <option>Sibling</option>
                <option>Child</option>
                <option>Grandparent</option>
                <option>Friend</option>
                <option>Colleague</option>
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

            {form.type === "Child" && (
              <label className="family-form-field">
                <span>Age</span>

                <input
                  type="number"
                  min="0"
                  max="17"
                  inputMode="numeric"
                  value={form.age}
                  onChange={(event) =>
                    setForm({
                      ...form,
                      age: event.target.value,
                    })
                  }
                  placeholder="e.g. 8"
                />
              </label>
            )}

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
                  placeholder="member@example.com"
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
                const selected =
                  form.interests.includes(interest.name);

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
                    form.color === color
                      ? "selected"
                      : ""
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
  const navigate = useNavigate();

  const [members, setMembers] = useState(() => {
    try {
      const saved =
        localStorage.getItem(familyStorageKey());

      if (!saved) {
        return [];
      }

      const parsed = JSON.parse(saved);

      if (!Array.isArray(parsed)) {
        return [];
      }

      return parsed.map(normalizeMember);
    } catch {
      return [];
    }
  });

  const [trips, setTrips] = useState([]);

  const [tripsLoading, setTripsLoading] =
    useState(true);

  const [tripsError, setTripsError] =
    useState("");

  const [search, setSearch] =
    useState("");

  const [filter, setFilter] =
    useState("All");

  const [modalOpen, setModalOpen] =
    useState(false);

  const [modalMode, setModalMode] =
    useState("add");

  const [selectedMember, setSelectedMember] =
    useState(null);

  const [form, setForm] =
    useState(EMPTY_FORM);

  const [menuOpen, setMenuOpen] =
    useState(null);

  const [toast, setToast] =
    useState("");

  /*
   * Load real trips from the Roamio API.
   */
  useEffect(() => {
    let cancelled = false;

    async function loadTrips() {
      setTripsLoading(true);
      setTripsError("");

      try {
        const result = await fetchTrips();

        if (!cancelled) {
          const normalized = Array.isArray(result)
            ? result.map(normalizeTrip)
            : [];

          setTrips(normalized);
        }
      } catch (error) {
        if (!cancelled) {
          setTripsError(
            error?.message ||
              "Unable to load your trips."
          );

          setTrips([]);
        }
      } finally {
        if (!cancelled) {
          setTripsLoading(false);
        }
      }
    }

    loadTrips();

    return () => {
      cancelled = true;
    };
  }, []);

  /*
   * Save real Travel Group members.
   */
  useEffect(() => {
    localStorage.setItem(
      familyStorageKey(),
      JSON.stringify(members)
    );

    window.dispatchEvent(
      new Event("roamio-group-updated")
    );
  }, [members]);

  /*
   * Keep this page synchronized with the Dashboard
   * and other Roamio pages using the same storage key.
   */
  useEffect(() => {
    const handleGroupUpdate = () => {
      try {
        const saved =
          localStorage.getItem(familyStorageKey());

        if (!saved) {
          setMembers([]);
          return;
        }

        const parsed = JSON.parse(saved);

        if (Array.isArray(parsed)) {
          setMembers(
            parsed.map(normalizeMember)
          );
        }
      } catch {
        setMembers([]);
      }
    };

    window.addEventListener(
      "roamio-group-updated",
      handleGroupUpdate
    );

    return () => {
      window.removeEventListener(
        "roamio-group-updated",
        handleGroupUpdate
      );
    };
  }, []);

  /*
   * Toast timer.
   */
  useEffect(() => {
    if (!toast) return undefined;

    const timer = window.setTimeout(() => {
      setToast("");
    }, 2600);

    return () =>
      window.clearTimeout(timer);
  }, [toast]);

  const normalizedTrips = useMemo(
    () =>
      trips.map((trip) => ({
        ...trip,
        calculatedStatus: getTripStatus(trip),
      })),
    [trips]
  );

  const upcomingTrips = useMemo(
    () =>
      normalizedTrips
        .filter(
          (trip) =>
            trip.calculatedStatus !==
            "Completed"
        )
        .sort((a, b) => {
          const aDate = a.startDate
            ? new Date(a.startDate).getTime()
            : Number.MAX_SAFE_INTEGER;

          const bDate = b.startDate
            ? new Date(b.startDate).getTime()
            : Number.MAX_SAFE_INTEGER;

          return aDate - bDate;
        }),
    [normalizedTrips]
  );

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

  const totalMemberTrips = useMemo(
    () =>
      members.reduce(
        (total, member) =>
          total + Number(member.trips || 0),
        0
      ),
    [members]
  );

  const groupInterests = useMemo(() => {
    const counts = {};

    members.forEach((member) => {
      (member.interests || []).forEach(
        (interest) => {
          counts[interest] =
            (counts[interest] || 0) + 1;
        }
      );
    });

    return INTERESTS.map((interest) => ({
      ...interest,
      count:
        counts[interest.name] || 0,
    }))
      .filter((interest) => interest.count > 0)
      .sort(
        (a, b) =>
          b.count - a.count
      )
      .slice(0, 5);
  }, [members]);

  const filteredMembers = useMemo(() => {
    const query =
      search.trim().toLowerCase();

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

      return (
        matchesSearch &&
        matchesFilter
      );
    });
  }, [members, search, filter]);

  const openAddModal = () => {
    setModalMode("add");
    setSelectedMember(null);

    setForm({
      ...EMPTY_FORM,
      interests: [],
    });

    setModalOpen(true);
    setMenuOpen(null);
  };

  const openEditModal = (member) => {
    setModalMode("edit");
    setSelectedMember(member);

    setForm({
      name: member.name,
      relationship:
        member.relationship ===
        "Family member"
          ? "Group member"
          : member.relationship ||
            "Group member",
      type: member.type || "Adult",
      age: member.age ?? "",
      email: member.email || "",
      interests:
        member.interests || [],
      color:
        member.color || "teal",
    });

    setModalOpen(true);
    setMenuOpen(null);
  };

  const closeModal = () => {
    setModalOpen(false);
    setSelectedMember(null);

    setForm({
      ...EMPTY_FORM,
      interests: [],
    });
  };

  const handleSaveMember = (event) => {
    event.preventDefault();

    const cleanName =
      form.name.trim();

    if (!cleanName) return;

    if (
      modalMode === "edit" &&
      selectedMember
    ) {
      setMembers((current) =>
        current.map((member) =>
          member.id ===
          selectedMember.id
            ? {
                ...member,
                name: cleanName,
                relationship:
                  form.relationship ===
                  "Family member"
                    ? "Group member"
                    : form.relationship,
                type: form.type,
                age: form.type === "Child" ? form.age : "",
                email:
                  form.email.trim(),
                initials:
                  getInitials(
                    cleanName
                  ),
                color:
                  form.color,
                interests:
                  form.interests,
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
        relationship:
          form.relationship ===
          "Family member"
            ? "Group member"
            : form.relationship,
        type: form.type,
                age: form.type === "Child" ? form.age : "",
        email:
          form.email.trim(),
        initials:
          getInitials(
            cleanName
          ),
        color:
          form.color,
        interests:
          form.interests,
        trips: 0,
        status: "Active",
      };

      setMembers((current) => [
        ...current,
        newMember,
      ]);

      setToast(
        `${cleanName} was added to your travel group.`
      );
    }

    closeModal();
  };

  const handleDeleteMember = (member) => {
    if (
      member.status ===
      "Organizer"
    ) {
      setToast(
        "The trip organizer cannot be removed."
      );

      setMenuOpen(null);

      return;
    }

    const confirmed =
      window.confirm(
        `Remove ${member.name} from your Roamio travel group?`
      );

    if (!confirmed) return;

    setMembers((current) =>
      current.filter(
        (item) =>
          item.id !== member.id
      )
    );

    setToast(
      `${member.name} was removed from your travel group.`
    );

    setMenuOpen(null);
  };

  const hero = (
    <>
      <p className="recommendations-eyebrow family-hero-eyebrow">
        <Sparkles size={15} />
        Your travel group
      </p>

      <h1>
        Adventures are better
        <span> together.</span>
      </h1>

      <p>
        Keep your travel group organised, remember
        everyone's interests, and plan trips that work
        for everyone.
      </p>
    </>
  );

  return (
    <PageShell
      backLabel="Back to dashboard"
      onBack={() => navigate("/dashboard")}
      hero={hero}
    >
      <div className="family-page-content">

        {/* TRAVEL GROUP OVERVIEW */}

        <section className="family-overview">
          <div className="family-overview-heading">
            <div>
              <span className="family-section-eyebrow">
                <Users size={14} />
                TRAVEL GROUP OVERVIEW
              </span>

              <h2>
                Your travel group at a glance
              </h2>

              <p>
                Everything you need to plan better
                trips together.
              </p>
            </div>

            <button
              type="button"
              className="family-button family-button-primary family-add-top"
              onClick={openAddModal}
            >
              <Plus size={17} />
              Add group member
            </button>
          </div>

          <div className="family-stat-grid">

            <div className="family-stat-card family-stat-primary">
              <div className="family-stat-icon">
                <Users size={20} />
              </div>

              <div>
                <span>
                  Group members
                </span>

                {/* +1 for you - Dashboard counts you too */}
                <strong>
                  {members.length + 1}
                </strong>

                <small>
                  Including you
                </small>
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

                <strong>
                  {adults.length}
                </strong>

                <small>
                  Travel companions
                </small>
              </div>
            </div>

            <div className="family-stat-card">
              <div className="family-stat-icon family-stat-icon-purple">
                <Baby size={20} />
              </div>

              <div>
                <span>
                  Children
                </span>

                <strong>
                  {children.length}
                </strong>

                <small>
                  Little explorers
                </small>
              </div>
            </div>

            <div className="family-stat-card">
              <div className="family-stat-icon family-stat-icon-orange">
                <Plane size={20} />
              </div>

              <div>
                <span>
                  Your trips
                </span>

                <strong>
                  {trips.length}
                </strong>

                <small>
                  {totalMemberTrips} member trips
                </small>
              </div>
            </div>

          </div>
        </section>

        {/* REAL GROUPS - accounts on the server, shared trips, invites */}
        <TravelGroups />

        {/* MAIN TRAVEL GROUP GRID - companions kept on this device */}

        <div className="family-main-grid">

          {/* GROUP MEMBERS */}

          <section className="family-members-panel">

            <div className="family-panel-header">
              <div>
                <span className="family-section-eyebrow">
                  <Users size={14} />
                  Your travel group
                </span>

                <h2>
                  Companions
                </h2>

                <p>
                  People you plan for who don&apos;t need an
                  account, kept on this device. The trip
                  wizard starts with them.
                </p>
              </div>

              <button
                type="button"
                className="family-mobile-add"
                onClick={openAddModal}
                aria-label="Add group member"
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
                    setSearch(
                      event.target.value
                    )
                  }
                  placeholder="Search group members..."
                  aria-label="Search group members"
                />

                {search && (
                  <button
                    type="button"
                    onClick={() =>
                      setSearch("")
                    }
                    aria-label="Clear search"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>

              <div className="family-filter-tabs">
                {[
                  "All",
                  "Adult",
                  "Child",
                ].map((item) => (
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
                ))}
              </div>
            </div>

            {/* MEMBER LIST */}

            {filteredMembers.length > 0 ? (
              <div className="family-member-list">

                {filteredMembers.map(
                  (member) => (
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

                          <h3>
                            {member.name}
                          </h3>

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

                          {member.relationship ===
                          "Family member"
                            ? "Group member"
                            : member.relationship ||
                              "Group member"}

                          <span>
                            •
                          </span>

                          {member.type}

                        </p>

                        <div className="family-member-meta">

                          <span>
                            <Plane size={13} />

                            {member.trips || 0}{" "}
                            {Number(
                              member.trips || 0
                            ) === 1
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

                          {(member.interests ||
                            []).length > 0 ? (
                            member.interests.map(
                              (
                                interest
                              ) => (
                                <span
                                  key={
                                    interest
                                  }
                                >
                                  <InterestIcon
                                    name={
                                      interest
                                    }
                                    size={
                                      12
                                    }
                                  />

                                  {
                                    interest
                                  }
                                </span>
                              )
                            )
                          ) : (
                            <span className="family-no-interests">
                              No travel interests
                              added
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
                            openEditModal(
                              member
                            )
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
                  )
                )}

              </div>
            ) : (
              <div className="family-empty-state">

                <div className="family-empty-icon">
                  <Users size={24} />
                </div>

                <h3>
                  {members.length === 0
                    ? "It's just you so far"
                    : "No group members found"}
                </h3>

                <p>
                  {members.length === 0
                    ? "Add the people you travel with to plan trips together."
                    : "Try another search or clear the current filter."}
                </p>

                {members.length === 0 ? (
                  <button
                    type="button"
                    className="family-button family-button-primary"
                    onClick={openAddModal}
                  >
                    <Plus size={16} />
                    Add group member
                  </button>
                ) : (
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
                )}

              </div>
            )}

            <div className="family-list-footer">

              <span>
                Showing{" "}
                {filteredMembers.length} of{" "}
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

          {/* RIGHT SIDEBAR */}

          <aside className="family-sidebar">

            {/* GROUP INTERESTS */}

            <section className="family-preferences-card">

              <div className="family-card-heading">

                <div>

                  <span className="family-section-eyebrow">
                    <Heart size={14} />
                    TRAVEL DNA
                  </span>

                  <h2>
                    Group interests & preferences
                  </h2>

                </div>

                <Sparkles size={19} />

              </div>

              <p className="family-card-description">
                Shared interests help Roamio create more
                personal destination recommendations.
              </p>

              {groupInterests.length > 0 ? (
                <div className="family-interest-bars">

                  {groupInterests.map(
                    (interest) => {
                      const Icon =
                        interest.icon;

                      const percentage =
                        members.length > 0
                          ? Math.round(
                              (interest.count /
                                members.length) *
                                100
                            )
                          : 0;

                      return (
                        <div
                          className="family-interest-bar"
                          key={
                            interest.name
                          }
                        >

                          <div className="family-interest-bar-top">

                            <span>
                              <Icon
                                size={14}
                              />

                              {
                                interest.name
                              }
                            </span>

                            <strong>
                              {
                                interest.count
                              }
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
                    }
                  )}

                </div>
              ) : (
                <div className="family-empty-state">
                  <div className="family-empty-icon">
                    <Heart size={22} />
                  </div>

                  <h3>
                    No group preferences yet
                  </h3>

                  <p>
                    Add members and their travel
                    interests to build your group's
                    travel profile.
                  </p>
                </div>
              )}

              <Link
                to="/recommendations"
                className="family-card-link"
              >
                Explore group recommendations
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
                  One group. Many adventures.
                </h2>

                <p>
                  Build trips around everyone's
                  interests, and keep the plan in
                  one place.
                </p>

                <Link
                  to="/trips"
                  className="family-button family-button-light"
                >
                  View group trips
                  <ChevronRight size={15} />
                </Link>

              </div>

            </section>

          </aside>

        </div>

        {/* REAL UPCOMING TRIPS */}

        <section className="family-trips-section">

          <div className="family-section-heading-row">

            <div>

              <span className="family-section-eyebrow">
                <CalendarDays size={14} />
                SHARED ADVENTURES
              </span>

              <h2>
                Your upcoming trips
              </h2>

              <p>
                Trips you&apos;re planning, solo or
                with your group.
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

          {tripsLoading ? (
            <div className="family-empty-state">
              <div className="family-empty-icon">
                <CalendarDays size={24} />
              </div>

              <h3>
                Loading your trips
              </h3>

              <p>
                Your Roamio trips are being loaded.
              </p>
            </div>
          ) : tripsError ? (
            <div className="family-empty-state">
              <div className="family-empty-icon">
                <CalendarDays size={24} />
              </div>

              <h3>
                Unable to load trips
              </h3>

              <p>
                {tripsError}
              </p>

              <Link
                to="/trips"
                className="family-button family-button-secondary"
              >
                Open My Trips
              </Link>
            </div>
          ) : upcomingTrips.length === 0 ? (
            <div className="family-empty-state">
              <div className="family-empty-icon">
                <Plane size={24} />
              </div>

              <h3>
                No upcoming trips
              </h3>

              <p>
                Create a trip to start planning your
                next adventure.
              </p>

              <Link
                to="/trips"
                className="family-button family-button-primary"
              >
                <Plus size={16} />
                Create a trip
              </Link>
            </div>
          ) : (
            <div className="family-trip-grid">

              {upcomingTrips.map(
                (trip, index) => {
                  const color =
                    getTripColor(index);

                  return (
                    <Link
                      to="/trips"
                      className={`family-trip-card family-trip-${color}`}
                      key={trip.id}
                    >

                      <div className="family-trip-cover">

                        <div className="family-trip-cover-glow" />

                        <div className="family-trip-icon">
                          <Plane size={22} />
                        </div>

                        <span className="family-trip-status">
                          {
                            trip.calculatedStatus
                          }
                        </span>

                      </div>

                      <div className="family-trip-body">

                        <h3>
                          {trip.title}
                        </h3>

                        <p>
                          <MapPin size={14} />
                          {
                            trip.destination
                          }
                        </p>

                        <div className="family-trip-details">

                          <span>
                            <CalendarDays
                              size={14}
                            />

                            {formatTripDates(
                              trip.startDate,
                              trip.endDate
                            )}
                          </span>

                          {trip.members && (
                            <span>
                              <Users
                                size={14}
                              />

                              {
                                trip.members
                              }{" "}
                              members
                            </span>
                          )}

                        </div>

                        <div className="family-trip-link">
                          Open trip
                          <ChevronRight size={15} />
                        </div>

                      </div>

                    </Link>
                  );
                }
              )}

            </div>
          )}

        </section>

      </div>

      {/* MEMBER MODAL */}

      <MemberModal
        open={modalOpen}
        mode={modalMode}
        form={form}
        setForm={setForm}
        onClose={closeModal}
        onSave={handleSaveMember}
      />

      {/* TOAST */}

      {toast && (
        <div
          className="family-toast"
          role="status"
        >
          <div className="family-toast-icon">
            <Check size={15} />
          </div>

          <span>{toast}</span>
        </div>
      )}

    </PageShell>
  );
}