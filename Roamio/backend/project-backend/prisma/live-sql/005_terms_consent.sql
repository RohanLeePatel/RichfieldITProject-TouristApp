-- Run this by hand in the Supabase SQL editor, BEFORE deploying the backend
-- that reads it (schema.prisma's User.termsAcceptedAt / termsVersion). Same
-- convention as 001-004: the live DB is the source of truth, prisma/migrations
-- must NOT be run against it, and the columns are mirrored into schema.prisma
-- by hand.
--
-- Records when each account agreed to the Terms and Privacy Policy and which
-- version of the wording that was (POPIA: be able to show who agreed to what).
-- Accounts created before this have both columns empty.
--
-- Safe to re-run: every statement is a no-op if the object already exists.

alter table "User" add column if not exists "termsAcceptedAt" timestamptz;
alter table "User" add column if not exists "termsVersion"    text;
