import { useEffect, useRef, useState } from "react";
import { FileText, Image as ImageIcon, LoaderCircle, Paperclip, Upload, X } from "lucide-react";

import {
  ACCEPTED_TYPES,
  DOCUMENT_KINDS,
  deleteDocument,
  fetchDocuments,
  openDocument,
  uploadDocument,
} from "../../api/tripDocuments.js";

function formatSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const kindLabel = (id) => DOCUMENT_KINDS.find((kind) => kind.id === id)?.label || "Other";

export default function TripDocuments({ tripId }) {
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [kind, setKind] = useState("BOOKING");
  const fileInputRef = useRef(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    fetchDocuments(tripId)
      .then((list) => active && setDocuments(list))
      .catch(() => active && setError("Could not load this trip's documents."))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [tripId]);

  const handleFile = async (event) => {
    const file = event.target.files?.[0];
    // clear the input so picking the same file twice still fires a change
    event.target.value = "";
    if (!file) return;

    setBusy(true);
    setError("");
    try {
      const saved = await uploadDocument(tripId, file, kind);
      setDocuments((current) => [saved, ...current]);
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "Could not attach that file.");
    } finally {
      setBusy(false);
    }
  };

  const handleOpen = async (documentId) => {
    setError("");
    try {
      await openDocument(tripId, documentId);
    } catch {
      setError("Could not open that document.");
    }
  };

  const handleDelete = async (documentId) => {
    setBusy(true);
    setError("");
    try {
      await deleteDocument(tripId, documentId);
      setDocuments((current) => current.filter((document) => document.id !== documentId));
    } catch {
      setError("Could not remove that document.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="recommendations-results trip-documents">
      <div className="results-heading">
        <div>
          <h2>Tickets &amp; bookings</h2>
          <p>
            Keep confirmations, tickets and receipts on the trip itself, instead of hunting through email.
          </p>
        </div>
        <div className="print-hide trip-document-upload">
          <label className="wizard-field">
            Type
            <select value={kind} onChange={(event) => setKind(event.target.value)}>
              {DOCUMENT_KINDS.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <input
            ref={fileInputRef}
            type="file"
            accept={ACCEPTED_TYPES}
            onChange={handleFile}
            hidden
          />
          <button
            type="button"
            className="secondary-button"
            onClick={() => fileInputRef.current?.click()}
            disabled={busy}
          >
            {busy ? <LoaderCircle className="recommendations-spinner" size={15} /> : <Upload size={15} />} Attach a file
          </button>
        </div>
      </div>

      {error && <p className="recommendations-error">{error}</p>}

      {loading ? (
        <p className="wizard-help">
          <LoaderCircle className="recommendations-spinner" size={16} /> Loading documents...
        </p>
      ) : documents.length === 0 ? (
        <div className="results-empty">
          <h3>Nothing attached yet.</h3>
          <p>Add a booking confirmation, boarding pass or receipt. PDFs and images up to 1 MB.</p>
        </div>
      ) : (
        <ul className="trip-document-list">
          {documents.map((document) => (
            <li key={document.id} className="trip-document">
              <span className="trip-document-icon" aria-hidden="true">
                {document.mimeType === "application/pdf" ? <FileText size={17} /> : <ImageIcon size={17} />}
              </span>
              <button type="button" className="trip-document-name" onClick={() => handleOpen(document.id)}>
                {document.filename}
              </button>
              <span className="trip-document-meta">
                {kindLabel(document.kind)} · {formatSize(document.sizeBytes)}
                {document.uploadedBy?.fullName ? ` · ${document.uploadedBy.fullName}` : ""}
              </span>
              <button
                type="button"
                className="itinerary-stop-remove print-hide"
                onClick={() => handleDelete(document.id)}
                disabled={busy}
                aria-label={`Remove ${document.filename}`}
              >
                <X size={14} />
              </button>
            </li>
          ))}
        </ul>
      )}

      <p className="print-hide wizard-help trip-document-note">
        <Paperclip size={13} /> Everyone on this trip can see and download what you attach.
      </p>
    </section>
  );
}
