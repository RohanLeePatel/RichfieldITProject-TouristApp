# Roamio

A trip-planning web app for travellers and groups. Plan a trip, get explainable destination recommendations, track budgets and expenses, translate text and photos, check weather and exchange rates, and chat with a trip assistant, all organised around the active trip.

Built for ITP700 (Richfield), Group 26.

## Architecture

```
Browser (React + Vite)
   │  HTTPS, JWT access token (memory) + httpOnly refresh cookie
   ▼
Core API (Node / Express / Prisma)  ──►  Supabase Postgres
   │  shared secret in `node-secretkey` header
   ▼
Expert & Integration Service (FastAPI)  ──►  Geoapify, OpenWeather, DeepL,
                                              OCR.space, FastForex,
                                              TravelRiskAPI, Gemini
```

The browser never calls the AI service, so provider keys and the shared secret never reach the client.

| Part | Path | Stack |
|---|---|---|
| Frontend | [Roamio/frontend](Roamio/frontend) | React 19, Vite, React Router, TanStack Query, Zustand, Leaflet |
| Core API | [Roamio/backend/project-backend](Roamio/backend/project-backend) | Express 5, Prisma 7, Zod, JWT, nodemailer, web-push |
| AI service | [Roamio/backend/ai-features](Roamio/backend/ai-features) | FastAPI (Python), pytest, ruff, mypy |

## Features

- Sign-up/sign-in with emailed 6-digit code, password reset
- Trips, shared trip groups, invites, calendar and reminders
- Rule-based, explainable destination recommendations (gates + five weighted scorers; group scoring per member)
- Budget and expense tracking with live exchange rates
- Translator (text via DeepL, photos via OCR) with saved history
- Weather, landmarks and safety advisories
- Trip chat assistant that only *proposes* changes until you confirm
- Web-push and in-app notifications, settings with data export/delete
- Admin dashboard (GA4, service health)

## Getting started

Prerequisites: Node 20+, Python 3.14 (as used in CI), a Supabase project.

### 1. AI service

```bash
cd Roamio/backend/ai-features
python -m venv .venv && source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements-dev.txt
cp .env.example .env                                # set superSecretKey at minimum
uvicorn main:app --reload --port 8000
```

Missing provider keys only switch off their own feature; the startup log lists them. See its [README](Roamio/backend/ai-features/README.md) and [MAINTAINING.md](Roamio/backend/ai-features/MAINTAINING.md).

### 2. Core API

```bash
cd Roamio/backend/project-backend
npm install            # also runs prisma generate
cp .env.example .env   # DATABASE_URL, DIRECT_URL, JWT/COOKIE secrets, APP_ENCRYPTION_KEY, superSecretKey, AI_FEATURES_URL...
npm run dev
```

`superSecretKey` must match the AI service. Set `AI_FEATURES_URL` to `http://localhost:8000` for local work. Database migrations live in `prisma/migrations`.

### 3. Frontend

```bash
cd Roamio/frontend
npm install
npm run dev
```

## Checks

```bash
# AI service (same as CI)
cd Roamio/backend/ai-features
ruff check . && mypy && coverage run -m pytest -q && coverage report --fail-under=90

# Core API self-checks
cd Roamio/backend/project-backend && npm run selfcheck

# Frontend
cd Roamio/frontend && npm run lint && npm run build
```

## Deployment

Frontend and backends are deployed on Vercel (`vercel.json` in each). GitHub Actions run the AI-service checks, a dependency audit and a scheduled Supabase backup (`.github/workflows`).

## Documentation

Project documents, phase reports, demo run sheet and marker Q&A are in [documentation](documentation).

## Team

Rohan Patel (AI/integration service), Yatheen (Prisma schema, backend flows), Jordan (authentication), Duran (landing, dashboard, chat page), Savaan (settings, calendar).
