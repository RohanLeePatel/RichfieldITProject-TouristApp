-- Run this by hand in the Supabase SQL editor, BEFORE deploying the backend that uses it
-- (schema.prisma's UserSession.refreshJti and User.failedLogins / lockedUntil). Same
-- convention as 001-014: the live DB is the source of truth, prisma/migrations must NOT
-- be run against it, and the columns are mirrored into schema.prisma by hand.
--
-- refreshJti: the one refresh token a session accepts; each use replaces it, so a token
--   that was already used is recognised as a copy. null = the session has not rotated yet.
-- failedLogins / lockedUntil: wrong-password lockout, kept in the database so every
--   server instance sees the same count.
--
-- Safe to re-run.

alter table "UserSession" add column if not exists "refreshJti" text;
alter table "User" add column if not exists "failedLogins" integer not null default 0;
alter table "User" add column if not exists "lockedUntil" timestamptz;
