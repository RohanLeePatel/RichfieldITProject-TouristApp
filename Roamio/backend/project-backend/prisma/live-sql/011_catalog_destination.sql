-- Run this by hand in the Supabase SQL editor, BEFORE deploying the backend
-- that reads it (schema.prisma's CatalogDestination). Same convention as
-- 001-010: the live DB is the source of truth, prisma/migrations must NOT be
-- run against it, and this table is mirrored into schema.prisma by hand.
--
-- The cities the recommendation engine can suggest, managed from the admin
-- dashboard (Destinations) instead of the destinations_seed.json file. Not the
-- same thing as "Destination" (a place inside a trip). The Core API hands the
-- active, enriched rows to the AI service with each request.
--
--   features   provider numbers for the city, filled by the Enrich button:
--              interest_counts, accessibility, accessible_ratio, tagged_total,
--              avg_temp_by_month, avg_rain_mm_by_month. Densities are NOT
--              stored: they are scaled against the whole catalog on every read.
--   enrichedAt when features was last filled (null = never, so not offered yet)
--   enrichError the last failure, shown to the administrator
--
-- 012_catalog_destination_seed.sql copies the existing 108 cities in. Safe to re-run.

create table if not exists "CatalogDestination" (
  id            text             primary key,
  name          text             not null,
  country       text             not null,
  lat           double precision not null check (lat between -90 and 90),
  lon           double precision not null check (lon between -180 and 180),
  "radiusM"     integer          not null default 12000 check ("radiusM" between 1000 and 30000),
  "costIndex"   smallint         not null default 3 check ("costIndex" between 1 and 5),
  "imageUrl"    text,
  active        boolean          not null default true,
  features      jsonb,
  "enrichedAt"  timestamptz,
  "enrichError" text,
  "createdAt"   timestamptz      not null default now(),
  "updatedAt"   timestamptz      not null default now()
);

create index if not exists "CatalogDestination_country_idx" on "CatalogDestination" (country);
