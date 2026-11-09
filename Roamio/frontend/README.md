# Roamio Frontend

The web client for Roamio, a trip-planning app. Built with React 19 and Vite. It talks only to the Core API ([../backend/project-backend](../backend/project-backend)); it never calls the AI service directly, because that needs a server-side secret.

See the [root README](../../README.md) for the whole project.

## Stack

- React 19, Vite
- React Router (routing), TanStack Query (server state), Zustand (client state)
- Leaflet (itinerary maps), Lucide (icons)
- Plain CSS per feature in `src/styles`
- ESLint

## Run it

```bash
npm install
cp .env.example .env
npm run dev          # http://localhost:5173
```

The Core API must be running (default `http://localhost:3000`).

| Script | What it does |
|---|---|
| `npm run dev` | Vite dev server |
| `npm run build` | Production build into `dist/` |
| `npm run preview` | Serve the build locally |
| `npm run lint` | ESLint |

Small `*.selfcheck.mjs` files sit next to some utilities (`src/utils`, `src/pages/recommendations`). Run one with `node path/to/file.selfcheck.mjs`.

## Environment

| Variable | Purpose |
|---|---|
| `VITE_BACKEND_API_URL` | Core API base URL. Defaults to `http://localhost:3000`. |
| `VITE_GA_MEASUREMENT_ID` | Google Analytics 4 ID. Leave empty to turn tracking off. Set at build time. |

## Pages

| Route | Page |
|---|---|
| `/` , `/explore` | Landing / public explore |
| `/login`, `/register`, `/forgot-password`, `/reset-password` | Authentication (emailed code on sign-up) |
| `/dashboard` | Overview of the active trip |
| `/trips`, `/trips/:tripId`, `/trips/:tripId/budget` | Trips, trip detail (hub, documents, itinerary), budget and expenses |
| `/recommendations` | Recommendation wizard, results, comparison, itinerary editor |
| `/calendar` | Calendar |
| `/chat` | Trip assistant (proposes changes, you confirm) |
| `/weather`, `/translator` | Weather and climate; text and photo translation |
| `/family` | Travel groups |
| `/settings` | Profile, security, travellers, notifications, privacy, help |
| `/admin` | Admin dashboard (admin users only) |
| `/invite/:token`, `/join/:code` | Joining a trip or group |
| `/terms`, `/privacy` | Legal |

All routes except the public ones sit behind the authentication check in `src/App.jsx`.

## Structure

```
src/
├── api/          Request helpers per area (client.js is the shared fetch wrapper)
├── components/   UI by feature: admin, auth, chat, dashboard, groups, insights,
│                 layout, onboarding, recommendations, settings, trips
├── hooks/        useActiveTrip, useLogin, useRegister
├── pages/        One file per route (recommendations/ holds wizard constants)
├── services/     authService, push (web-push subscription)
├── store/        Zustand stores: authStore, tipsStore, tripStore
├── styles/       CSS per feature
├── utils/        Formatting, validation, itinerary planner, translator and travel-advice helpers
├── analytics.js  GA4 wiring
├── App.jsx       Routes
└── main.jsx
public/           favicon, social card, sw.js (service worker for push)
vercel.json       SPA rewrite and security headers (CSP)
```

## Auth

The access token is held in memory and the refresh token is an httpOnly cookie set by the Core API, so page scripts cannot read either from storage. `authStore` holds the current user; `AdminRoute` guards `/admin`.

## Deployment

Deployed on Vercel. `vercel.json` rewrites every path to `index.html` and sets the Content-Security-Policy and other headers. If you add a new external origin (fonts, scripts), update the CSP there.
