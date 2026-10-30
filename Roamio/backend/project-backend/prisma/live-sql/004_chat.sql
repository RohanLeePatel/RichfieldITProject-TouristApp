-- Run this by hand in the Supabase SQL editor, BEFORE deploying the backend
-- that reads it (schema.prisma's ChatConversation / ChatMessage). Same
-- convention as 001-003: the live DB is the source of truth, prisma/migrations
-- must NOT be run against it, and these tables are mirrored into schema.prisma
-- by hand.
--
-- Saved conversations with the trip assistant (FR-37). A conversation belongs
-- to one traveller and, optionally, the trip it was about; deleting the trip
-- keeps the conversation, deleting the user removes it.
--
-- Safe to re-run: every statement is a no-op if the object already exists.

create table if not exists "ChatConversation" (
  id          serial      primary key,
  "userId"    integer     not null references "User"(id) on delete cascade,
  "tripId"    integer     references "Trip"(id) on delete set null,
  title       text        not null,
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now()
);

create index if not exists "ChatConversation_userId_idx" on "ChatConversation" ("userId", "updatedAt" desc);

create table if not exists "ChatMessage" (
  id               serial      primary key,
  "conversationId" integer     not null references "ChatConversation"(id) on delete cascade,
  role             text        not null check (role in ('user', 'assistant')),
  content          text        not null,
  "createdAt"      timestamptz not null default now()
);

create index if not exists "ChatMessage_conversationId_idx" on "ChatMessage" ("conversationId", id);

-- No policies: only the Node backend (direct Postgres role) reads these tables;
-- the anon/authenticated Supabase API keys get nothing.
alter table "ChatConversation" enable row level security;
alter table "ChatMessage" enable row level security;
