import { useEffect, useState } from "react";
import { LoaderCircle, Plus, Users } from "lucide-react";

import { createGroup, fetchMyGroups } from "../../../api/groups.js";

const NEW = "new";

const groupLabel = (group) =>
  `${group.name} (${group.members.length} ${group.members.length === 1 ? "person" : "people"})`;

// First thing the wizard asks: solo, an existing travel group, or a new one
// made right here. A group trip is visible to everyone in the group, so it's
// decided before planning rather than on the last step.
export default function TripGroupPanel({ form, updateForm }) {
  const [groups, setGroups] = useState(null);
  const [choice, setChoice] = useState(form.travelGroupId ? String(form.travelGroupId) : "");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [created, setCreated] = useState(null);

  useEffect(() => {
    fetchMyGroups().then(setGroups).catch(() => setGroups([]));
  }, []);

  const pick = (group) => {
    updateForm("travelGroupId", group ? group.id : null);
    updateForm("travelGroupName", group ? group.name : "");
  };

  const choose = (value) => {
    setChoice(value);
    setError("");
    if (value !== NEW) pick(groups.find((group) => String(group.id) === value) || null);
  };

  const create = async () => {
    setBusy(true);
    setError("");
    try {
      const group = await createGroup(name.trim());
      setGroups((current) => [...current, group]);
      setChoice(String(group.id));
      setCreated(group);
      setName("");
      pick(group);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Could not create the group.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="panel">
      <h3 className="panel-title"><Users size={15} /> Who&apos;s going?</h3>

      {groups === null ? (
        <p className="wizard-help"><LoaderCircle className="recommendations-spinner" size={14} /> Loading your travel groups...</p>
      ) : (
        <>
          <label className="wizard-field">
            Plan this trip for
            <select value={choice} onChange={(event) => choose(event.target.value)}>
              <option value="">Just me</option>
              {groups.map((group) => (
                <option key={group.id} value={group.id}>{groupLabel(group)}</option>
              ))}
              <option value={NEW}>+ A new travel group</option>
            </select>
          </label>

          {choice === NEW && (
            <div className="trip-group-new">
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Group name, e.g. Cape Town crew"
                aria-label="New group name"
                maxLength={60}
              />
              <button type="button" className="secondary-button" onClick={create} disabled={busy || !name.trim()}>
                <Plus size={14} /> Create group
              </button>
            </div>
          )}

          {error && <p className="recommendations-error">{error}</p>}

          {created && String(created.id) === choice ? (
            <p className="wizard-help">
              Group created. Share the code <strong>{created.inviteCode}</strong> so friends can join it from Travel groups - they&apos;ll see this trip once it&apos;s saved.
            </p>
          ) : (
            <p className="wizard-help">
              {choice && choice !== NEW
                ? "Everyone in the group can open the trip, its itinerary and its documents."
                : "Planning with friends or family? Make it a group trip so everyone can see the plan."}
            </p>
          )}
        </>
      )}
    </section>
  );
}
