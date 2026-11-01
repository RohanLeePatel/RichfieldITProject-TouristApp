import { authedFetch, ensureToken, isDevBypass } from "./client";

// Trip document vault. Files go up as base64 in a JSON body (the backend has
// no multipart parser - see routes/tripDocuments.js) and come back down as a
// blob, which authedFetch can't do since it always parses JSON.

const API_BASE_URL = import.meta.env.VITE_BACKEND_API_URL || "http://127.0.0.1:3000";

export const MAX_DOCUMENT_BYTES = 1024 * 1024;
export const ACCEPTED_TYPES = "application/pdf,image/png,image/jpeg,image/webp";

export const DOCUMENT_KINDS = [
  { id: "TICKET", label: "Ticket" },
  { id: "BOOKING", label: "Booking" },
  { id: "RECEIPT", label: "Receipt" },
  { id: "VISA", label: "Visa" },
  { id: "INSURANCE", label: "Insurance" },
  { id: "OTHER", label: "Other" },
];

// Documents need the real database, so the dev-login bypass has nothing to
// show. Returning empty keeps the trip page rendering instead of erroring.

function readAsBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    // result is "data:<mime>;base64,<payload>" - the API wants just the payload
    reader.onload = () => resolve(String(reader.result).split(",")[1] || "");
    reader.onerror = () => reject(new Error("Could not read that file."));
    reader.readAsDataURL(file);
  });
}

export async function fetchDocuments(tripId) {
  if (isDevBypass()) return [];
  const result = await authedFetch(`/api/trips/${tripId}/documents`);
  return result.documents;
}

export async function uploadDocument(tripId, file, kind) {
  if (isDevBypass()) {
    throw new Error("Documents need a real sign-in - the dev bypass has no database.");
  }
  if (file.size > MAX_DOCUMENT_BYTES) {
    throw new Error("That file is too large (1 MB max).");
  }

  const result = await authedFetch(`/api/trips/${tripId}/documents`, {
    method: "POST",
    body: JSON.stringify({
      filename: file.name,
      mimeType: file.type,
      kind,
      dataBase64: await readAsBase64(file),
    }),
  });
  return result.document;
}

export async function deleteDocument(tripId, documentId) {
  if (isDevBypass()) return;
  await authedFetch(`/api/trips/${tripId}/documents/${documentId}`, { method: "DELETE" });
}

// Opens the file in a new tab. The endpoint needs the bearer token, so the
// bytes are fetched here and handed to the browser as a blob URL rather than
// pointing a link straight at the URL.
export async function openDocument(tripId, documentId) {
  const token = await ensureToken();
  const response = await fetch(
    `${API_BASE_URL.replace(/\/$/, "")}/api/trips/${tripId}/documents/${documentId}`,
    { headers: token ? { Authorization: `Bearer ${token}` } : {} }
  );
  if (!response.ok) throw new Error("Could not open that document.");

  const url = URL.createObjectURL(await response.blob());
  window.open(url, "_blank", "noopener");
  // the tab holds its own reference once open; this just stops the blob
  // leaking for the rest of the session
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
