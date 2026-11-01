import { useState } from "react";
import { LoaderCircle } from "lucide-react";

import { updateTrip } from "../../api/trips.js";

const dateValue = (iso) => (iso ? String(iso).slice(0, 10) : "");

// Edits a saved trip in place. The dates move together; stops keep their day
// numbers, so they move with the trip. Dates that would leave stops outside the
// trip are refused by the server, which names them.
export default function TripEditForm({ trip, onSaved, onCancel }) {
  const [form, setForm] = useState({
    title: trip.title || "",
    destination: trip.destination || "",
    startDate: dateValue(trip.startDate),
    endDate: dateValue(trip.endDate),
    budget: trip.budget ?? "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const set = (key) => (event) => setForm((current) => ({ ...current, [key]: event.target.value }));

  const submit = async (event) => {
    event.preventDefault();
    setError("");
    if (!form.title.trim()) return setError("Give the trip a name.");
    if (!form.destination.trim()) return setError("Add a destination.");
    if (!form.startDate !== !form.endDate) return setError("Set both dates, or clear both.");

    setSaving(true);
    try {
      await updateTrip(trip.id, {
        title: form.title.trim(),
        destination: form.destination.trim(),
        startDate: form.startDate || null,
        endDate: form.endDate || null,
        budget: form.budget === "" ? null : Number(form.budget),
      });
      onSaved();
    } catch (requestError) {
      const stops = requestError.data?.items;
      setError(
        stops?.length
          ? `${requestError.message} ${stops.map((stop) => `${stop.title} (day ${stop.dayNumber})`).join(", ")}.`
          : requestError.message
      );
      setSaving(false);
    }
  };

  return (
    <form className="trip-edit print-hide" onSubmit={submit}>
      <label className="wizard-field">
        Trip name
        <input value={form.title} onChange={set("title")} maxLength={100} />
      </label>
      <label className="wizard-field">
        Destination
        <input value={form.destination} onChange={set("destination")} />
      </label>
      <label className="wizard-field">
        Start date
        <input type="date" value={form.startDate} onChange={set("startDate")} />
      </label>
      <label className="wizard-field">
        End date
        <input type="date" value={form.endDate} min={form.startDate} onChange={set("endDate")} />
      </label>
      <label className="wizard-field">
        Budget
        <input type="number" min="0" step="any" value={form.budget} onChange={set("budget")} />
      </label>
      {error && <p className="recommendations-error trip-edit-error">{error}</p>}
      <div className="trip-detail-actions trip-edit-actions">
        <button type="submit" className="recommendations-submit" disabled={saving}>
          {saving ? <LoaderCircle className="recommendations-spinner" size={15} /> : null} Save changes
        </button>
        <button type="button" className="secondary-button" onClick={onCancel} disabled={saving}>
          Cancel
        </button>
      </div>
    </form>
  );
}
