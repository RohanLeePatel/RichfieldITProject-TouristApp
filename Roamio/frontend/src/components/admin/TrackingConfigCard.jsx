import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, ExternalLink, Radar } from "lucide-react";

import { retryUnlessForbidden, trackingConfigQuery } from "../../api/admin.js";

// The public tracking ids the API hands out. Nothing is loaded from them
// here: injecting the trackers on this page would count admins as visitors.
export default function TrackingConfigCard() {
  const { data, error } = useQuery({ ...trackingConfigQuery, retry: retryUnlessForbidden });

  const rows = [
    { label: "GA4 Measurement ID", value: data?.gaMeasurementId },
    { label: "Clarity Project ID", value: data?.clarityProjectId },
  ];

  return (
    <section className="admin-card" aria-labelledby="admin-tracking-title">
      <div className="admin-card-heading">
        <div>
          <h2 id="admin-tracking-title">
            <Radar size={18} /> Tracking
          </h2>
          <p>Analytics tags in use</p>
        </div>
      </div>

      {error ? (
        <div className="admin-error" role="alert">
          <AlertTriangle size={18} />
          <span>{error.message}</span>
        </div>
      ) : (
        <>
          <dl className="admin-config-list">
            {rows.map(({ label, value }) => (
              <div key={label}>
                <dt>{label}</dt>
                <dd className={value ? "" : "unset"}>{value || "Not set"}</dd>
              </div>
            ))}
          </dl>

          {data?.clarityProjectId && (
            <a
              className="admin-button"
              href={`https://clarity.microsoft.com/projects/view/${encodeURIComponent(data.clarityProjectId)}/dashboard`}
              target="_blank"
              rel="noreferrer"
            >
              Open Clarity <ExternalLink size={15} />
            </a>
          )}
        </>
      )}
    </section>
  );
}
