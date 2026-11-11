import { useEffect } from "react";
import { X } from "lucide-react";

import { formatDimension } from "../../pages/recommendations/constants.js";

// Side-by-side table: one column per shortlisted destination, one row per
// scoring dimension (the bar is that dimension's 0-1 score). Best in each row is bolded.
export default function CompareView({ items, onRemove, onClose }) {
  const dimensions = [...new Set(items.flatMap((item) => (item.breakdown || []).map((entry) => entry.dimension)))];
  const scoreOf = (item, dimension) => item.breakdown?.find((entry) => entry.dimension === dimension)?.value;

  useEffect(() => {
    const onKey = (event) => { if (event.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [onClose]);

  return (
    <div className="compare-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <section className="compare-view" role="dialog" aria-modal="true" aria-label="Compare destinations">
      <div className="compare-heading">
        <h3>Compare destinations</h3>
        <button type="button" className="secondary-button" onClick={onClose}>Close</button>
      </div>
      <div className="compare-scroll">
        <table>
          <thead>
            <tr>
              <th />
              {items.map((item) => (
                <th key={item.id}>
                  {item.name || item.id}
                  <button type="button" className="compare-remove" onClick={() => onRemove(item)} aria-label={`Remove ${item.name || item.id}`}>
                    <X size={14} />
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr>
              <th scope="row">Overall match</th>
              {items.map((item) => (
                <td key={item.id}><b>{Math.round(item.total_score * 100)}%</b></td>
              ))}
            </tr>
            {dimensions.map((dimension) => {
              const scores = items.map((item) => scoreOf(item, dimension));
              const best = Math.max(...scores.map((s) => s ?? -1));
              return (
                <tr key={dimension}>
                  <th scope="row">{formatDimension(dimension)}</th>
                  {items.map((item, i) => (
                    <td key={item.id} className={scores[i] === best ? "best" : ""}>
                      {scores[i] == null ? "–" : (
                        <>
                          <span className="compare-bar"><i style={{ width: `${Math.round(scores[i] * 100)}%` }} /></span>
                          {Math.round(scores[i] * 100)}%
                        </>
                      )}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
    </div>
  );
}
