-- Run this by hand in the Supabase SQL editor.
--
-- prisma/migrations describes an older, different schema and must NOT be run
-- against the live database (see the header in schema.prisma). The live DB is
-- the source of truth, so new tables are added with plain SQL here and then
-- mirrored into schema.prisma by hand.
--
-- Adds the trip document vault: booking confirmations, tickets and receipts
-- attached to a trip.
--
-- ponytail: file bytes live in the table (bytea), not in object storage. Fine
-- at the 1 MB/file, 20 files/trip cap the API enforces; move to Supabase
-- Storage with signed URLs if documents ever get big or numerous.

create table if not exists "TripDocument" (
  id             text        primary key,
  "tripId"       integer     not null references "Trip"(id) on delete cascade,
  "uploadedById" integer     not null references "User"(id),
  filename       text        not null,
  "mimeType"     text        not null,
  "sizeBytes"    integer     not null,
  kind           text        not null default 'OTHER',
  data           bytea       not null,
  "createdAt"    timestamptz not null default now()
);

create index if not exists "TripDocument_tripId_idx" on "TripDocument" ("tripId");

-- No policies: only the Node backend (direct Postgres role) reads this table;
-- the anon/authenticated Supabase API keys get nothing.
alter table "TripDocument" enable row level security;
