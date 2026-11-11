-- Run this by hand in the Supabase SQL editor, BEFORE deploying the backend that
-- reads it (schema.prisma's PlaceReview / PlaceReport). Same convention as 001-012:
-- the live DB is the source of truth, prisma/migrations must NOT be run against it,
-- and the tables are mirrored into schema.prisma by hand.
--
-- Ratings (1-5) and problem reports for a place. A place is a trip's destination
-- text (Trip.description JSON, e.g. "Cape Town, South Africa"), lowercased and
-- trimmed into "placeKey"; "placeName" keeps the wording for display. One review and
-- one report per traveller per place. The routes only accept a review from a member
-- of a finished trip to that place, and a report from a member of any trip to it.
--
-- Safe to re-run: every statement is a no-op if the object already exists.

create table if not exists "PlaceReview" (
  "id"        serial primary key,
  "userId"    integer not null references "User"("id") on delete cascade,
  "placeKey"  varchar(160) not null,
  "placeName" varchar(160) not null,
  "tripId"    integer references "Trip"("id") on delete set null,
  "rating"    smallint not null check ("rating" between 1 and 5),
  "comment"   varchar(500),
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now(),
  unique ("userId", "placeKey")
);
create index if not exists "PlaceReview_placeKey_idx" on "PlaceReview"("placeKey");

create table if not exists "PlaceReport" (
  "id"        serial primary key,
  "userId"    integer not null references "User"("id") on delete cascade,
  "placeKey"  varchar(160) not null,
  "placeName" varchar(160) not null,
  "reason"    varchar(20) not null,   -- CLOSED, UNSAFE, WRONG_INFO, SCAM, OTHER
  "note"      varchar(300),
  "status"    varchar(20) not null default 'OPEN', -- OPEN, RESOLVED, DISMISSED
  "createdAt" timestamptz not null default now(),
  unique ("userId", "placeKey")
);
create index if not exists "PlaceReport_placeKey_status_idx" on "PlaceReport"("placeKey", "status");
