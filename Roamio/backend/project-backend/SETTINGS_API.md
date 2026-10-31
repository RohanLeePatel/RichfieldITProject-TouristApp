# Settings page: backend endpoints

The new settings page calls these endpoints on your Spring Boot backend. All are under
the signed-in user (`/me`) and need the usual JWT `Authorization: Bearer …` header.

Until an endpoint exists (it returns 404, 405 or 501), the page falls back gracefully:
notifications and travellers are saved in the browser, the data export is built in the
browser, and problem reports open the user's email app. Nothing breaks while you build these.

| Feature | Method & path | Body / response |
|---|---|---|
| Notification preferences | `GET /api/users/me/notification-preferences` | `NotificationPrefs` |
| | `PUT /api/users/me/notification-preferences` | send and return `NotificationPrefs` |
| Active sessions | `GET /api/users/me/sessions` | `Session[]` |
| | `DELETE /api/users/me/sessions/{id}` | 204 |
| | `DELETE /api/users/me/sessions/others` | 204 (keep the calling session) |
| Login activity | `GET /api/users/me/login-activity` | `LoginEvent[]`, newest first, last 30 days |
| Saved travellers | `GET /api/users/me/travellers` | `Traveller[]` |
| | `POST /api/users/me/travellers` | `Traveller` without `id` → created `Traveller` |
| | `PUT /api/users/me/travellers/{id}` | `Traveller` → updated `Traveller` |
| | `DELETE /api/users/me/travellers/{id}` | 204 |
| Download my data | `GET /api/users/me/export` | `application/json` or `application/zip` file |
| Delete account | `DELETE /api/users/me` | body `{ "confirmation": "DELETE" }` → 204 |
| Report a problem | `POST /api/support/reports` | `Report` → `{ "reference": "RM-48213" }` |

Error responses: send `{ "message": "…" }` with a 4xx/5xx status and the page shows that message.

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
  "documentNumber": "A12345678",   // write-only: accept it, never return it
  "documentLast4": "5678",         // return this instead
  "documentExpiry": "2031-08-01",
  "consent": { "given": true, "guardian": false, "at": "2026-09-14T10:00:00Z" } }

// Report
{ "category": "Something isn't working", "subject": "…", "description": "…", "email": "…",
  "context": { "page": "/settings", "browser": "Chrome on Windows", "screen": "1280×900",
               "language": "en-ZA", "time": "…" } }   // context is optional
```

## Privacy notes (POPIA)

- **Document numbers:** encrypt at rest (for example a JPA `AttributeConverter` with AES-GCM),
  never log them, and return only `documentLast4`. If `documentNumber` is missing on PUT,
  keep the stored value.
- **Consent:** reject a traveller unless `consent.given` is true, and also require
  `consent.guardian` when the date of birth makes them under 18. Store `consent.at`.
- **Sessions:** to list and revoke sessions you need a server-side session or refresh-token table
  (id, user, user agent, IP, created, last seen, revoked). Check `revoked` when a token is
  refreshed or validated.
- **Login activity:** record successful and failed sign-ins in your login handler.
- **Delete account:** delete or anonymise the user's rows in one transaction, revoke all
  sessions, and keep only records the law requires (such as payments).
- **Export:** include everything stored about the user (profile, preferences, notification
  settings, travellers with full document numbers, trips they own, login activity).
