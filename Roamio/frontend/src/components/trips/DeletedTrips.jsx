import { useEffect, useState } from "react";
import { RotateCcw } from "lucide-react";

import { fetchDeletedTrips, restoreTrip } from "../../api/trips.js";
import { useTripStore } from "../../store/tripStore.js";

const DAY_MS = 86_400_000;

// Trips deleted in the last 30 days, with a Restore button. Shows nothing when
// there are none, or when the server can't list them.
export default function DeletedTrips({ onRestored }) {
  const [trips, setTrips] = useState([]);
  const [busyId, setBusyId] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    fetchDeletedTrips().then(setTrips).catch(() => {});
  }, []);

  const restore = async (trip) => {
    setBusyId(trip.id);
    setError("");
    try {
      await restoreTrip(trip.id);
      setTrips((current) => current.filter((item) => item.id !== trip.id));
      useTripStore.getState().load(true);
      onRestored();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusyId(null);
    }
  };

  if (trips.length === 0) return null;

  return (
    <section className="recommendations-results deleted-trips">
      <div className="results-heading">
        <div>
          <h2>Recently deleted</h2>
          <p>Deleted trips can be restored for 30 days.</p>
        </div>
      </div>
      {error && <p className="recommendations-error">{error}</p>}
      <ul>
        {trips.map((trip) => {
          const left = Math.max(1, 30 - Math.floor((Date.now() - new Date(trip.deletedAt)) / DAY_MS));
          return (
            <li key={trip.id}>
              <div>
                <strong>{trip.title}</strong>
                <small>{trip.destination || "Destination not set"} · {left} day{left === 1 ? "" : "s"} left</small>
              </div>
              <button type="button" className="secondary-button" onClick={() => restore(trip)} disabled={busyId === trip.id}>
                <RotateCcw size={15} /> Restore
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
