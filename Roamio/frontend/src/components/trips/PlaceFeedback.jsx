import { useEffect, useState } from "react";
import { Flag, Star } from "lucide-react";

import { REPORT_REASONS, fetchPlaceRating, ratePlace, reportPlace } from "../../api/places.js";

// "How was it?" for a trip's destination: a 1-5 rating once the trip is over, and
// "Report a problem" at any time. The API enforces both rules; this only hides the
// form that would be refused.
export default function PlaceFeedback({ trip }) {
  const place = trip.destination;
  const finished = trip.status === "COMPLETED" || (trip.endDate && new Date(trip.endDate) < new Date());

  const [summary, setSummary] = useState(null);
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [reason, setReason] = useState("");
  const [note, setNote] = useState("");
  const [reporting, setReporting] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetchPlaceRating(place)
      .then((data) => {
        if (cancelled) return;
        setSummary(data);
        if (data.mine) {
          setRating(data.mine.rating);
          setComment(data.mine.comment || "");
        }
      })
      .catch(() => {}); // the rating is a nicety; the page works without it
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
    if (!rating) return setError("Pick a star rating first.");
    if (await run(() => ratePlace(place, rating, comment.trim()), "Thanks, your rating is saved.")) {
      fetchPlaceRating(place).then(setSummary).catch(() => {});
    }
  };

  const submitReport = async (event) => {
    event.preventDefault();
    if (!reason) return setError("Choose what is wrong.");
    if (await run(() => reportPlace(place, reason, note.trim()), "Thanks, we will look into it.")) {
      setReporting(false);
      setReason("");
      setNote("");
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
              : "No ratings yet."}
          </p>
        </div>
      </div>

      {finished ? (
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
          />
          <button type="submit" className="recommendations-submit" disabled={busy}>
            {summary?.mine ? "Update rating" : "Save rating"}
          </button>
        </form>
      ) : (
        <p className="wizard-help">You can rate this place once your trip has finished.</p>
      )}

      {reporting ? (
        <form className="place-feedback-form" onSubmit={submitReport}>
          <select value={reason} onChange={(event) => setReason(event.target.value)} aria-label="What is wrong">
            <option value="">What is wrong?</option>
            {REPORT_REASONS.map(({ id, label }) => <option key={id} value={id}>{label}</option>)}
          </select>
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
            <button type="button" className="secondary-button" onClick={() => setReporting(false)}>Cancel</button>
          </div>
        </form>
      ) : (
        <button type="button" className="secondary-button place-report-link" onClick={() => { setReporting(true); setMessage(""); setError(""); }}>
          <Flag size={14} /> Report a problem with this place
        </button>
      )}

      {message && <p className="wizard-help" role="status">{message}</p>}
      {error && <p className="recommendations-error" role="alert">{error}</p>}
    </section>
  );
}
