import { useEffect, useState } from "react";
import { Flag, Star } from "lucide-react";

import { REPORT_REASONS, fetchPlaceRating, ratePlace, reportPlace } from "../../api/places.js";

// A destination rating after the trip and reports about the destination or its stops.
export default function PlaceFeedback({ trip }) {
  const place = trip.destination;
  const finished = trip.status === "COMPLETED" || (trip.endDate && new Date(trip.endDate) < new Date());

  const [summary, setSummary] = useState(null);
  const [ratingLoadFailed, setRatingLoadFailed] = useState(false);
  const [submittedReview, setSubmittedReview] = useState(null);
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [reason, setReason] = useState("");
  const [stopId, setStopId] = useState("");
  const [note, setNote] = useState("");
  const [reportOpenedAt, setReportOpenedAt] = useState(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const savedReview = submittedReview ?? summary?.mine;
  const eligibleStops = (trip.itinerary ?? []).filter((stop) => stop.scheduledAt && Date.parse(stop.scheduledAt) <= reportOpenedAt);

  useEffect(() => {
    let cancelled = false;
    fetchPlaceRating(place)
      .then((data) => {
        if (!cancelled) setSummary(data);
      })
      .catch(() => { if (!cancelled) setRatingLoadFailed(true); });
    return () => { cancelled = true; };
  }, [place]);

  const run = async (action, done) => {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await action();
      setMessage(done);
      return true;
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Something went wrong. Please try again.");
      return false;
    } finally {
      setBusy(false);
    }
  };

  const submitRating = async (event) => {
    event.preventDefault();
    if (busy || savedReview) return;
    if (!rating) return setError("Pick a star rating first.");
    await run(async () => {
      const { review } = await ratePlace(place, rating, comment.trim());
      setSubmittedReview(review);
    }, "Rating submitted successfully!");
    fetchPlaceRating(place).then(setSummary).catch(() => {});
  };

  const submitReport = async (event) => {
    event.preventDefault();
    if (busy) return;
    if (!reason) return setError("Choose what is wrong.");
    if (stopId && !eligibleStops.some((stop) => stop.id === stopId)) return setError("Choose a stop whose scheduled start time has passed.");
    const report = { place, reason, note: note.trim(), tripId: trip.id, itineraryItemId: stopId || undefined };
    if (await run(() => reportPlace(report), "Thanks, we will look into it.")) {
      setReportOpenedAt(null);
      setReason("");
      setNote("");
      setStopId("");
    }
  };

  return (
    <section className="recommendations-results place-feedback print-hide" aria-labelledby="place-feedback-title">
      <div className="results-heading">
        <div>
          <h2 id="place-feedback-title">How was {place.split(",")[0]}?</h2>
          <p>
            {summary?.reviewCount
              ? `${summary.avgRating} out of 5 from ${summary.reviewCount} traveller${summary.reviewCount === 1 ? "" : "s"}.`
              : summary ? "No ratings yet." : ""}
          </p>
        </div>
      </div>

      {savedReview ? (
        <div className="place-feedback-form">
          <p><strong>Your rating</strong> · {savedReview.rating} out of 5</p>
          {savedReview.comment && <p>{savedReview.comment}</p>}
        </div>
      ) : !finished ? (
        <p className="wizard-help">You can rate this place once your trip has finished.</p>
      ) : ratingLoadFailed ? (
        <p className="recommendations-error" role="alert">Could not load your rating. Reload the page to try again.</p>
      ) : !summary ? (
        <p className="wizard-help" role="status">Loading ratings…</p>
      ) : (
        <form className="place-feedback-form" onSubmit={submitRating}>
          <div className="place-stars" role="radiogroup" aria-label="Your rating">
            {[1, 2, 3, 4, 5].map((value) => (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={rating === value}
                aria-label={`${value} star${value === 1 ? "" : "s"}`}
                className={value <= rating ? "on" : ""}
                onClick={() => setRating(value)}
                disabled={busy}
              >
                <Star size={22} fill={value <= rating ? "currentColor" : "none"} />
              </button>
            ))}
          </div>
          <textarea
            value={comment}
            onChange={(event) => setComment(event.target.value)}
            maxLength={500}
            rows={2}
            placeholder="Anything other travellers should know? (optional)"
            aria-label="Comment"
            disabled={busy}
          />
          <button type="submit" className="recommendations-submit" disabled={busy}>
            Submit rating
          </button>
        </form>
      )}

      {reportOpenedAt !== null ? (
        <form className="place-feedback-form" onSubmit={submitReport}>
          <select value={reason} onChange={(event) => setReason(event.target.value)} aria-label="What is wrong">
            <option value="">What is wrong?</option>
            {REPORT_REASONS.map(({ id, label }) => <option key={id} value={id}>{label}</option>)}
          </select>
          <label>
            Itinerary stop (optional)
            <select value={stopId} onChange={(event) => setStopId(event.target.value)} disabled={busy}>
              <option value="">General destination issue</option>
              {eligibleStops.map((stop) => (
                <option key={stop.id} value={stop.id}>Day {stop.dayNumber} · {stop.startTime} · {stop.title}</option>
              ))}
            </select>
          </label>
          <p className="wizard-help">
            {eligibleStops.length ? "Choose a stop to include it in your report." : "Stops are available once their scheduled start time has passed."}
          </p>
          <textarea
            value={note}
            onChange={(event) => setNote(event.target.value)}
            maxLength={300}
            rows={2}
            placeholder="Add details (optional)"
            aria-label="Details"
          />
          <div className="place-feedback-row">
            <button type="submit" className="recommendations-submit" disabled={busy}>Send report</button>
            <button type="button" className="secondary-button" onClick={() => setReportOpenedAt(null)} disabled={busy}>Cancel</button>
          </div>
        </form>
      ) : (
        <button type="button" className="secondary-button place-report-link" onClick={() => { setReportOpenedAt(Date.now()); setMessage(""); setError(""); }} disabled={busy}>
          <Flag size={14} /> Report a problem with this place
        </button>
      )}

      {message && <p className="wizard-help" role="status">{message}</p>}
      {error && <p className="recommendations-error" role="alert">{error}</p>}
    </section>
  );
}
