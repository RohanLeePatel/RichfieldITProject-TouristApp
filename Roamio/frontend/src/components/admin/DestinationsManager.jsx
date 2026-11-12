import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Eye, EyeOff, ImagePlus, MapPin, Plus, RefreshCw, Search, Trash2 } from "lucide-react";

import {
  adminDestinationsQuery,
  bulkSetDestinations,
  createDestination,
  deleteDestination,
  refreshDestination,
  retryUnlessForbidden,
  updateDestination,
} from "../../api/admin.js";
import { confirmDialog } from "../../store/confirmStore.js";

const PAGE = 30;

// matches COST_BAND_ZAR_RANGE in the recommendation engine (ai-features/engine/weights.py)
const COST_LEVELS = [
  { value: 1, label: "1 - Budget (under R500 a day)" },
  { value: 2, label: "2 - Affordable (R500-900)" },
  { value: 3, label: "3 - Moderate (R900-1,500)" },
  { value: 4, label: "4 - Pricey (R1,500-2,500)" },
  { value: 5, label: "5 - Luxury (R2,500+)" },
];

const formatDate = (iso) => new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });

// The status pill for a city. The checks run in order: hidden first, then no data
// yet (shown as down), then data older than the staleness limit (shown as degraded).
// A city that is visible and has fresh data is live.
function status(d) {
  if (!d.active) return ["degraded", "Hidden"];
  if (!d.enrichedAt) return ["down", "Needs data"];
  if (d.stale) return ["degraded", "Data is old"];
  return ["online", "Live"];
}

const ISSUE_LABELS = {
  no_photo: "No photo",
  no_data: "No data yet",
  old_data: "Data is old",
  fetch_failed: "Last fetch failed",
};

// the views the owner can narrow the list to; "thin" is the one to work on first:
// cities travellers already use that still have something missing
const VIEWS = [
  { id: "all", label: "All", test: () => true },
  { id: "attention", label: "Needs attention", test: (d) => d.active && d.issues.length > 0 },
  { id: "thin", label: "Popular but thin", test: (d) => d.tripCount > 0 && d.issues.length > 0 },
  { id: "photo", label: "No photo", test: (d) => d.issues.includes("no_photo") },
  { id: "hidden", label: "Hidden", test: (d) => !d.active },
];

const EMPTY_FORM = { name: "", country: "", costIndex: "3", lat: "", lon: "", radiusM: "12000" };

// Same limits as the server (catalogService.js), so mistakes show before the 30-second request.
function inRange(value, label, min, max, integer) {
  const n = Number(value);
  if (String(value).trim() === "" || !Number.isFinite(n) || (integer && !Number.isInteger(n)) || n < min || n > max) {
    return `${label} must be ${integer ? "a whole number" : "a number"} from ${min} to ${max}.`;
  }
  return null;
}

function validateForm(form, manual) {
  const errors = {};
  for (const [field, label] of [["name", "City"], ["country", "Country"]]) {
    const v = form[field].trim();
    if (!v) errors[field] = `${label} is required.`;
    else if (v.length > 120) errors[field] = `${label} must be 120 characters or fewer.`;
    else if (!/[a-z0-9]/i.test(v)) errors[field] = "Use English letters or numbers.";
  }
  if (manual) {
    const lat = inRange(form.lat, "Latitude", -90, 90);
    const lon = inRange(form.lon, "Longitude", -180, 180);
    const radiusM = inRange(form.radiusM, "Search radius", 1000, 30000, true);
    if (lat) errors.lat = lat;
    if (lon) errors.lon = lon;
    if (radiusM) errors.radiusM = radiusM;
  }
  return errors;
}

// "" removes the photo; anything else must be an https address
function photoUrlError(value) {
  if (!value) return null;
  try {
    if (new URL(value).protocol === "https:" && value.length <= 500) return null;
  } catch {
    // falls through to the message
  }
  return "Photo must be a web address starting with https:// (500 characters at most).";
}

// The cities the recommendation engine can suggest. Adding one looks it up on the
// map and fetches its numbers (points of interest, climate, accessibility), which
// takes up to half a minute; nothing here needs a code change or a deploy.
export default function DestinationsManager() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [shown, setShown] = useState(PAGE);
  const [adding, setAdding] = useState(false);
  const [manual, setManual] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [notice, setNotice] = useState(null); // { tone: "error" | "ok", text }
  const [view, setView] = useState("all");
  const [sort, setSort] = useState("name");
  const [selected, setSelected] = useState(() => new Set());

  const { data, isPending, error, refetch, isFetching } = useQuery({ ...adminDestinationsQuery, retry: retryUnlessForbidden });
  const refresh = () => queryClient.invalidateQueries({ queryKey: adminDestinationsQuery.queryKey });
  const fail = (err) => setNotice({ tone: "error", text: err.message });

  const add = useMutation({
    mutationFn: () => {
      const fields = { name: form.name, country: form.country, costIndex: Number(form.costIndex) };
      if (manual) Object.assign(fields, { lat: form.lat, lon: form.lon, radiusM: form.radiusM });
      return createDestination(fields);
    },
    onSuccess: ({ destination, enrichError }) => {
      refresh();
      setForm(EMPTY_FORM);
      setAdding(false);
      setNotice(
        enrichError
          ? { tone: "error", text: `${destination.name} was added, but its data could not be fetched: ${enrichError} Use the refresh button to try again.` }
          : { tone: "ok", text: `${destination.name} was added and will now appear in recommendations.` },
      );
    },
    onError: fail,
  });
  const change = useMutation({ mutationFn: ({ id, fields }) => updateDestination(id, fields), onSuccess: refresh, onError: fail });
  const refetchData = useMutation({
    mutationFn: refreshDestination,
    onSuccess: () => {
      refresh();
      setNotice({ tone: "ok", text: "Data refreshed." });
    },
    onError: (err) => {
      refresh();
      fail(err);
    },
  });
  const remove = useMutation({ mutationFn: deleteDestination, onSuccess: refresh, onError: fail });
  const bulk = useMutation({
    mutationFn: ({ active }) => bulkSetDestinations([...selected], active),
    onSuccess: ({ updated }, { active }) => {
      refresh();
      setSelected(new Set());
      setNotice({ tone: "ok", text: `${updated} ${updated === 1 ? "city" : "cities"} ${active ? "shown in" : "hidden from"} recommendations.` });
    },
    onError: fail,
  });

  const all = data?.destinations || [];
  const needle = search.trim().toLowerCase();
  const viewTest = VIEWS.find((v) => v.id === view).test;
  const matching = all.filter((d) => viewTest(d) && (!needle || `${d.name} ${d.country}`.toLowerCase().includes(needle)));
  // the API sends them by country and name; "popular" puts the most-used cities first
  const rows = sort === "popular" ? [...matching].sort((a, b) => b.tripCount - a.tripCount) : matching;
  const attention = all.filter((d) => d.active && (!d.enrichedAt || d.stale)).length;
  const toggleSelected = (id) =>
    setSelected((current) => {
      const next = new Set(current);
      if (!next.delete(id)) next.add(id);
      return next;
    });
  const shownRows = rows.slice(0, shown);
  const allShownSelected = shownRows.length > 0 && shownRows.every((d) => selected.has(d.id));
  // the row a request is still working on, so its buttons wait
  const working = (id) =>
    (change.isPending && change.variables?.id === id) ||
    (refetchData.isPending && refetchData.variables === id) ||
    (remove.isPending && remove.variables === id);

  const [errors, setErrors] = useState({});
  const set = (field) => (event) => {
    setForm((f) => ({ ...f, [field]: event.target.value }));
    setErrors((e) => ({ ...e, [field]: undefined }));
  };
  const fieldError = (field) => errors[field] && <span className="admin-field-error" role="alert">{errors[field]}</span>;

  return (
    <section className="admin-card admin-destinations" aria-labelledby="admin-destinations-title">
      <div className="admin-card-heading">
        <div>
          <h2 id="admin-destinations-title">
            <MapPin size={18} /> Destinations
          </h2>
          <p>
            {data
              ? `${all.length} cities the recommendations can suggest${attention ? `, ${attention} need attention` : ""}`
              : "Loading destinations…"}
          </p>
        </div>

        <div className="admin-card-actions">
          <label className="admin-search">
            <Search size={15} aria-hidden="true" />
            <input
              type="search"
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setShown(PAGE);
              }}
              placeholder="Search cities"
              aria-label="Search destinations"
            />
          </label>
          <button type="button" className="admin-icon-button" onClick={() => refetch()} disabled={isFetching} aria-label="Reload destinations" title="Reload destinations">
            <RefreshCw size={16} className={isFetching ? "admin-spin" : ""} />
          </button>
          <button type="button" className="admin-button" onClick={() => setAdding((open) => !open)} aria-expanded={adding}>
            <Plus size={15} /> Add destination
          </button>
        </div>
      </div>

      {notice && (
        <p className={`admin-notice ${notice.tone}`} role={notice.tone === "error" ? "alert" : "status"}>
          <span>{notice.text}</span>
          <button type="button" onClick={() => setNotice(null)} aria-label="Dismiss">
            &times;
          </button>
        </p>
      )}

      {adding && (
        <form
          className="admin-dest-form"
          noValidate
          onSubmit={(event) => {
            event.preventDefault();
            setNotice(null);
            const found = validateForm(form, manual);
            setErrors(found);
            if (Object.keys(found).length === 0) add.mutate();
          }}
        >
          <label>
            City
            <input value={form.name} onChange={set("name")} placeholder="Kyoto" required maxLength={120} aria-invalid={!!errors.name} />
            {fieldError("name")}
          </label>
          <label>
            Country
            <input value={form.country} onChange={set("country")} placeholder="Japan" required maxLength={120} aria-invalid={!!errors.country} />
            {fieldError("country")}
          </label>
          <label>
            Cost level
            <select value={form.costIndex} onChange={set("costIndex")}>
              {COST_LEVELS.map((level) => (
                <option key={level.value} value={level.value}>
                  {level.label}
                </option>
              ))}
            </select>
          </label>

          <label className="admin-dest-check">
            <input type="checkbox" checked={manual} onChange={(event) => setManual(event.target.checked)} />
            Enter the coordinates myself (otherwise the city is found by name)
          </label>
          {manual && (
            <>
              <label>
                Latitude
                <input value={form.lat} onChange={set("lat")} inputMode="decimal" placeholder="35.0116" required aria-invalid={!!errors.lat} />
                {fieldError("lat")}
              </label>
              <label>
                Longitude
                <input value={form.lon} onChange={set("lon")} inputMode="decimal" placeholder="135.7681" required aria-invalid={!!errors.lon} />
                {fieldError("lon")}
              </label>
              <label>
                Search radius (metres)
                <input value={form.radiusM} onChange={set("radiusM")} inputMode="numeric" placeholder="12000" required aria-invalid={!!errors.radiusM} />
                {fieldError("radiusM")}
              </label>
            </>
          )}

          <div className="admin-dest-form-actions">
            <button type="submit" className="admin-button" disabled={add.isPending}>
              {add.isPending ? "Adding… this can take up to 30 seconds" : "Add and fetch data"}
            </button>
            <button type="button" className="admin-link-button" onClick={() => setAdding(false)} disabled={add.isPending}>
              Cancel
            </button>
          </div>
        </form>
      )}

      {data && (
        <div className="admin-dest-toolbar">
          <div className="admin-chips" role="group" aria-label="Show destinations">
            {VIEWS.map((v) => (
              <button
                key={v.id}
                type="button"
                className={view === v.id ? "active" : ""}
                aria-pressed={view === v.id}
                onClick={() => {
                  setView(v.id);
                  setShown(PAGE);
                }}
              >
                {v.label} <span>{all.filter(v.test).length}</span>
              </button>
            ))}
          </div>
          <select className="admin-select" value={sort} onChange={(event) => setSort(event.target.value)} aria-label="Sort destinations">
            <option value="name">A to Z</option>
            <option value="popular">Most used in trips</option>
          </select>
        </div>
      )}

      {selected.size > 0 && (
        <div className="admin-bulk" role="status">
          <strong>{selected.size} selected</strong>
          <button type="button" className="admin-link-button" disabled={bulk.isPending} onClick={() => bulk.mutate({ active: true })}>
            Show in recommendations
          </button>
          <button type="button" className="admin-link-button" disabled={bulk.isPending} onClick={() => bulk.mutate({ active: false })}>
            Hide
          </button>
          <button type="button" className="admin-link-button" onClick={() => setSelected(new Set())}>
            Clear
          </button>
        </div>
      )}

      {error && !data ? (
        <div className="admin-error" role="alert">
          <AlertTriangle size={18} />
          <span>{error.message}</span>
        </div>
      ) : isPending ? (
        <p className="admin-user-empty">Loading…</p>
      ) : rows.length === 0 ? (
        <p className="admin-user-empty">{needle || view !== "all" ? "No destinations match that." : "No destinations yet. Add one above."}</p>
      ) : (
        <ul className="admin-dest-list">
          <li className="admin-dest-selectall">
            <label>
              <input
                type="checkbox"
                checked={allShownSelected}
                onChange={() => setSelected(allShownSelected ? new Set() : new Set(shownRows.map((d) => d.id)))}
              />
              Select all shown
            </label>
          </li>
          {shownRows.map((d) => {
            const [tone, label] = status(d);
            const busy = working(d.id);
            return (
              <li className={`admin-dest ${d.active ? "" : "hidden"}`} key={d.id}>
                <input
                  type="checkbox"
                  className="admin-dest-pick"
                  checked={selected.has(d.id)}
                  onChange={() => toggleSelected(d.id)}
                  aria-label={`Select ${d.name}`}
                />
                <div className="admin-dest-name">
                  <strong>{d.name}</strong>
                  <span>
                    {d.country}
                    {d.enrichedAt ? ` · data from ${formatDate(d.enrichedAt)}` : " · no data yet"}
                    {` · used in ${d.tripCount} ${d.tripCount === 1 ? "trip" : "trips"}`}
                  </span>
                  {d.issues.length > 0 && (
                    <span className="admin-dest-issues">{d.issues.map((issue) => ISSUE_LABELS[issue]).join(" · ")}</span>
                  )}
                  {d.enrichError && <span className="admin-dest-error">{d.enrichError}</span>}
                </div>

                <span className={`admin-status-pill ${tone}`}>
                  <span className="admin-status-dot" aria-hidden="true" />
                  {label}
                </span>

                <select
                  className="admin-dest-cost"
                  value={d.costIndex}
                  aria-label={`Cost level for ${d.name}`}
                  disabled={busy}
                  onChange={(event) => change.mutate({ id: d.id, fields: { costIndex: Number(event.target.value) } })}
                >
                  {COST_LEVELS.map((level) => (
                    <option key={level.value} value={level.value}>
                      {level.label}
                    </option>
                  ))}
                </select>

                <div className="admin-dest-actions">
                  <button
                    type="button"
                    className="admin-icon-button"
                    disabled={busy}
                    onClick={() => change.mutate({ id: d.id, fields: { active: !d.active } })}
                    aria-label={d.active ? `Hide ${d.name} from recommendations` : `Show ${d.name} in recommendations`}
                    title={d.active ? "Hide from recommendations" : "Show in recommendations"}
                  >
                    {d.active ? <Eye size={16} /> : <EyeOff size={16} />}
                  </button>
                  <button
                    type="button"
                    className="admin-icon-button"
                    disabled={busy}
                    onClick={() => {
                      const url = window.prompt(`Photo address for ${d.name} (https://…). Leave empty to remove it.`, d.imageUrl || "");
                      if (url === null) return;
                      const problem = photoUrlError(url.trim());
                      if (problem) setNotice({ tone: "error", text: problem });
                      else change.mutate({ id: d.id, fields: { imageUrl: url.trim() } });
                    }}
                    aria-label={`Set photo for ${d.name}`}
                    title="Set photo"
                  >
                    <ImagePlus size={16} />
                  </button>
                  <button
                    type="button"
                    className="admin-icon-button"
                    disabled={busy}
                    onClick={() => refetchData.mutate(d.id)}
                    aria-label={`Fetch fresh data for ${d.name}`}
                    title="Fetch fresh data (takes up to 30 seconds)"
                  >
                    <RefreshCw size={16} className={refetchData.isPending && refetchData.variables === d.id ? "admin-spin" : ""} />
                  </button>
                  <button
                    type="button"
                    className="admin-icon-button danger"
                    disabled={busy}
                    onClick={async () => (await confirmDialog(`Delete ${d.name}? Hiding it instead keeps its data.`, "Delete")) && remove.mutate(d.id)}
                    aria-label={`Delete ${d.name}`}
                    title="Delete"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {rows.length > shown && (
        <button type="button" className="admin-link-button admin-dest-more" onClick={() => setShown((n) => n + PAGE)}>
          Show more ({rows.length - shown} left)
        </button>
      )}
    </section>
  );
}
