-- Run this by hand in the Supabase SQL editor, BEFORE deploying the backend
-- that reads it (schema.prisma's PlannerDraft). Same convention as 001-006: the
-- live DB is the source of truth, prisma/migrations must NOT be run against it,
-- and this table is mirrored into schema.prisma by hand.
--
-- The trip planner's unfinished plan (wizard answers, results, landmarks,
-- itinerary), one row per traveller, so a plan started on one device can be
-- finished on another. data is the page's own snapshot. Deleting the user
-- removes it. Safe to re-run.

create table if not exists "PlannerDraft" (
  id          serial      primary key,
  "userId"    integer     not null unique references "User"(id) on delete cascade,
  data        jsonb       not null,
  "updatedAt" timestamptz not null default now()
);
