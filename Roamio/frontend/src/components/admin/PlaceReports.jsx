import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Flag } from "lucide-react";

import { retryUnlessForbidden } from "../../api/admin.js";
import { REPORT_REASONS, adminReportsQuery, closePlaceReports } from "../../api/places.js";
import { formatDate } from "../../utils/format.js";

const reasonLabel = (id) => REPORT_REASONS.find((r) => r.id === id)?.label || id;

// Places travellers have reported, most-reported first. "Flagged" means 3+ different
// travellers. Closing a place clears its open reports; hiding a recommended city is
// done under Content.
export default function PlaceReports() {
  const queryClient = useQueryClient();
  const [actionError, setActionError] = useState("");
  const { data, error, isLoading } = useQuery({ ...adminReportsQuery, retry: retryUnlessForbidden });

  const close = useMutation({
    mutationFn: ({ placeKey, status }) => closePlaceReports(placeKey, status),
    onMutate: () => setActionError(""),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: adminReportsQuery.queryKey }),
    onError: (err) => setActionError(err.message),
  });

  const reports = data?.reports || [];

  return (
    <section className="admin-card" aria-labelledby="admin-reports-title">
      <div className="admin-card-heading">
        <div>
          <h2 id="admin-reports-title"><Flag size={18} /> Reported places</h2>
          <p>Problems travellers have reported. Flagged = {data?.flagAt ?? 3} or more different people.</p>
        </div>
      </div>

      {(error || actionError) && (
        <div className="admin-error" role="alert">
          <AlertTriangle size={18} />
          <span>{error?.message || actionError}</span>
        </div>
      )}

      {isLoading ? (
        <p>Loading...</p>
      ) : !error && reports.length === 0 ? (
        <p>No open reports.</p>
      ) : (
        <ul className="place-reports">
          {reports.map((place) => (
            <li key={place.placeKey} className={place.flagged ? "flagged" : ""}>
              <div className="place-reports-head">
                <strong>{place.name}</strong>
                <span>{place.reportCount} report{place.reportCount === 1 ? "" : "s"}{place.flagged ? " · flagged" : ""}</span>
              </div>
              <ul>
                {place.reports.map((report, index) => (
                  <li key={index}>
                    {reasonLabel(report.reason)}{report.note ? `: ${report.note}` : ""}{" "}
                    <small>{formatDate(report.createdAt)}</small>
                  </li>
                ))}
              </ul>
              <div className="admin-card-actions">
                <button type="button" className="admin-button" disabled={close.isPending} onClick={() => close.mutate({ placeKey: place.placeKey, status: "RESOLVED" })}>
                  Mark resolved
                </button>
                <button type="button" className="admin-button" disabled={close.isPending} onClick={() => close.mutate({ placeKey: place.placeKey, status: "DISMISSED" })}>
                  Dismiss
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
