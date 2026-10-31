-- Run this by hand in the Supabase SQL editor, BEFORE deploying the backend
-- that reads it (schema.prisma's NotificationPreference, UserSession,
-- LoginEvent and SavedTraveller). Same convention as 001-005: the live DB is
-- the source of truth, prisma/migrations must NOT be run against it, and these
-- tables are mirrored into schema.prisma by hand.
--
-- Backs the Settings page (SETTINGS_API.md):
--   NotificationPreference  one row per traveller: which alerts, by which channel
--   UserSession             one row per sign-in; the refresh token carries its id,
--                           so revoking the row ends that device at its next renewal
--   LoginEvent              sign-in history (successful and failed), shown for 30 days
--   SavedTraveller          people a traveller books for. Passport / ID numbers are
--                           NOT stored: only the type, expiry and the last 4 characters.
--
-- Deleting the user removes all of it. Safe to re-run: every statement is a
-- no-op if the object already exists.

create table if not exists "NotificationPreference" (
  id          serial      primary key,
  "userId"    integer     not null unique references "User"(id) on delete cascade,
  prefs       jsonb       not null,
  "updatedAt" timestamptz not null default now()
);

create table if not exists "UserSession" (
  id           text        primary key,
  "userId"     integer     not null references "User"(id) on delete cascade,
  browser      text        not null default '',
  os           text        not null default '',
  "deviceType" text        not null default 'desktop',
  location     text        not null default '',
  "ipAddress"  text        not null default '',
  "createdAt"  timestamptz not null default now(),
  "lastSeenAt" timestamptz not null default now(),
  "revokedAt"  timestamptz
);

create index if not exists "UserSession_userId_idx" on "UserSession" ("userId", "lastSeenAt" desc);

create table if not exists "LoginEvent" (
  id           serial      primary key,
  "userId"     integer     not null references "User"(id) on delete cascade,
  at           timestamptz not null default now(),
  browser      text        not null default '',
  os           text        not null default '',
  "deviceType" text        not null default 'desktop',
  location     text        not null default '',
  "ipAddress"  text        not null default '',
  success      boolean     not null
);

create index if not exists "LoginEvent_userId_idx" on "LoginEvent" ("userId", at desc);

create table if not exists "SavedTraveller" (
  id                 text        primary key,
  "userId"           integer     not null references "User"(id) on delete cascade,
  "firstName"        text        not null,
  "lastName"         text        not null,
  relationship       text        not null,
  "dateOfBirth"      date        not null,
  nationality        text        not null default '',
  email              text        not null default '',
  phone              text        not null default '',
  "documentType"     text        not null default 'passport' check ("documentType" in ('passport', 'id')),
  "documentLast4"    text,
  "documentExpiry"   date,
  "consentGiven"     boolean     not null,
  "consentGuardian"  boolean     not null default false,
  "consentAt"        timestamptz not null default now(),
  "createdAt"        timestamptz not null default now(),
  "updatedAt"        timestamptz not null default now()
);

create index if not exists "SavedTraveller_userId_idx" on "SavedTraveller" ("userId", "createdAt");

-- No policies: only the Node backend (direct Postgres role) reads these tables;
-- the anon/authenticated Supabase API keys get nothing.
alter table "NotificationPreference" enable row level security;
alter table "UserSession" enable row level security;
alter table "LoginEvent" enable row level security;
alter table "SavedTraveller" enable row level security;
