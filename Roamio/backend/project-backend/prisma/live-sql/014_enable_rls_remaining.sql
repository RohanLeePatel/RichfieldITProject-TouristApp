-- Run this by hand in the Supabase SQL editor (same convention as 001-013).
--
-- 007, 011 and 013 created tables without row level security, so with the anon key
-- Supabase's PostgREST API could read and write them directly. The Core API connects
-- as the database owner through Prisma, which bypasses RLS, so enabling it with no
-- policies blocks the public API and leaves the app unaffected.
--
-- Safe to re-run.

alter table "PlannerDraft"       enable row level security;
alter table "CatalogDestination" enable row level security;
alter table "PlaceReview"        enable row level security;
alter table "PlaceReport"        enable row level security;
