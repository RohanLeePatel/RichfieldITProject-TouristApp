import { useEffect } from "react";
import { useSearchParams } from "react-router-dom";

import { defaultTrip, useTripStore } from "../store/tripStore.js";

// The active trip for this page: ?trip=<id> wins (and becomes the saved
// choice), else the saved choice, else the next upcoming trip. `trip` is null
// while loading or when the user has no trips - pages show their free-search
// state then, never an invented trip.
export default function useActiveTrip() {
  const [params] = useSearchParams();
  const { trips, loaded, activeTripId, load, setActiveTrip } = useTripStore();
  const fromUrl = params.get("trip");

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (fromUrl && fromUrl !== activeTripId) setActiveTrip(fromUrl);
  }, [fromUrl, activeTripId, setActiveTrip]);

  const wanted = fromUrl || activeTripId;
  const trip = trips.find((t) => String(t.id) === String(wanted)) || (loaded ? defaultTrip(trips) : null);

  return { trip, trips, loaded, setActiveTrip };
}
