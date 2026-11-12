# Settings page: backend endpoints

The Settings page calls these endpoints on the Core API (Express). Every one is under
the signed-in traveller (`/me`), needs `Authorization: Bearer <access token>`, and only
ever reads or changes that traveller's own rows. Responses are never cached (`no-store`).

They are built: `src/routes/me.js` (everything under `/api/users/me`) and
`src/routes/support.js`. Tables: `prisma/live-sql/006_settings.sql` (run it by hand in
Supabase before deploying). Checked by `src/routes/me.selfcheck.js`,
`src/services/sessionService.selfcheck.js` and `src/routes/auth.selfcheck.js`.

If an endpoint is missing (an old server), the page falls back to the browser: notifications and
travellers are kept on the device, the export is built there, and problem reports open the
traveller's email app. A 404 whose body is `{ "message": "Not found." }` (or isn't JSON) means
"no such route" and triggers that fallback; any other 404 (for example "Traveller not found.")
is shown to the traveller as it is.

| Feature | Method & path | Body / response |
|---|---|---|
| Notification preferences | `GET /api/users/me/notification-preferences` | `NotificationPrefs` (defaults until saved) |
| | `PUT /api/users/me/notification-preferences` | send and return `NotificationPrefs`; anything that isn't true/false is a 400 |
| Active sessions | `GET /api/users/me/sessions` | `Session[]`, newest first; `current` is the one making the request |
| | `DELETE /api/users/me/sessions/{id}` | 204, or 404 if it isn't theirs / is already over |
| | `DELETE /api/users/me/sessions/others` | 204 (keeps the calling session) |
| Login activity | `GET /api/users/me/login-activity` | `LoginEvent[]`, newest first, last 30 days |
| Saved travellers | `GET /api/users/me/travellers` | `Traveller[]` |
| | `POST /api/users/me/travellers` | `Traveller` without `id` -> 201 and the created `Traveller` (up to 20) |
| | `PUT /api/users/me/travellers/{id}` | `Traveller` -> the updated `Traveller` |
| | `DELETE /api/users/me/travellers/{id}` | 204 |
| Download my data | `GET /api/users/me/export` | `roamio-export-<date>.json` as an attachment |
| Delete account | `DELETE /api/users/me` | body `{ "confirmation": "DELETE", "password": "..." }` -> 204 |
| Report a problem | `POST /api/support/reports` | `Report` -> 201 `{ "reference": "RM-48213" }` |

Errors: `{ "message": "..." }` with a 4xx/5xx status; the page shows that message.

## Shapes

```jsonc
// NotificationPrefs
{
  "channels": { "email": true, "browser": false },
  "topics": {
    "bookingConfirmations": { "email": true, "browser": true },
    "travelUpdates":        { "email": true, "browser": true },
    "flightChanges":        { "email": true, "browser": true },
    "accommodationChanges": { "email": true, "browser": true }
  }
}

// Session
{ "id": "…", "browser": "Chrome", "os": "Windows", "deviceType": "desktop|mobile|tablet",
  "location": "Durban, South Africa", "ipAddress": "102.65.12.4",
  "lastActiveAt": "2026-10-28T14:31:00Z", "current": true }

// LoginEvent
{ "id": "…", "at": "2026-10-28T14:31:00Z", "browser": "Chrome", "os": "Windows",
  "deviceType": "desktop", "location": "Durban, South Africa", "ipAddress": "…", "success": true }

// Traveller
{ "id": "…", "firstName": "Priya", "lastName": "Goindsamy", "relationship": "Partner or spouse",
  "dateOfBirth": "1996-04-12", "nationality": "South African", "email": "", "phone": "",
  "documentType": "passport|id",
  "documentNumber": "A12345678",   // write-only: read to get the last 4, never stored or returned
  "documentLast4": "5678",         // returned instead
  "documentExpiry": "2031-08-01",
  "consent": { "given": true, "guardian": false, "at": "2026-09-14T10:00:00Z" } }

// Report
{ "category": "Something isn't working", "subject": "…", "description": "…", "email": "…",
  "context": { "page": "/settings", "browser": "Chrome on Windows", "screen": "1280×900",
               "language": "en-ZA", "time": "…" } }   // context is optional; only these keys are kept
```

## How it works (and the limits)

- **Sessions.** Every sign-in (login, or the first sign-in after verifying the email) inserts a
  `UserSession` row, and its id (`sid`) goes into both the access and the refresh token. Renewing
  a token (`POST /api/auth/refresh`) checks the row is open and was used in the last 7 days;
  signing a session out (or "sign out everywhere else", logging out, or resetting the password)
  sets `revokedAt`, so that device cannot renew. **An access token already issued still works
  until it expires (15 minutes)**: a revoked device is out within that time, not instantly.
  Tokens issued before this existed have no `sid`; on their next renewal they are given a session.
- **Where from.** The browser, system and device type come from the `User-Agent`. The place
  comes from Vercel's `x-vercel-ip-country` / `x-vercel-ip-city` headers, so it is blank when
  running locally. Sign-in records older than 90 days are deleted on the next sign-in.
- **Travellers.** Consent is required (`consent.given`), plus `consent.guardian` when the date
  of birth makes them under 18. The server sets `consent.at` itself and keeps the original on
  edits. **Passport and ID numbers are not stored**: the number is validated, its last four
  characters are kept as `documentLast4`, and the rest is discarded. If `documentNumber` is
  missing or blank on a `PUT`, the saved digits are kept.
- **Export** (design P-16): profile and preferences, notification preferences, saved
  travellers, the groups they belong to (with members' names and roles, and companions), those
  groups' trips with itinerary items, budgets, expenses and splits, documents they uploaded
  (names and sizes, not the files), notifications, assistant chats, translation history
  (text, with photograph links; left `null` if the translation service can't be reached) and
  sign-in history. Never the password hash or one-time codes.
- **Delete** (design P-17) requires the typed word and the password. The translation service
  erases stored photographs and history first. The account stays open if that step fails, so
  the traveller can retry. One database transaction then deletes their organized trips,
  including trips in shared groups, and any groups where they were the sole member.
  The longest-standing remaining member takes over a shared group if needed. The transaction
  deletes the user's uploads and incoming invitations and resets saved split percentages
  that included them. Deleting the user cascades to their memberships, expenses, expense shares,
  outgoing invitations, notifications, chats, sessions and saved travellers.
- **Reports** are emailed to `SUPPORT_EMAIL` (default `support.roamiio.live@gmail.com`) through the
  same SMTP settings as the verification codes, with the traveller's address as the reply-to.
  Limited to 5 per 15 minutes per IP address.
