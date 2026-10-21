-- Run this by hand in the Supabase SQL editor, BEFORE deploying the backend
-- that reads it (schema.prisma's Expense.exchangeRate). Same convention as
-- 001/002: the live DB is the source of truth, prisma/migrations must NOT be
-- run against it, and this column is mirrored into schema.prisma by hand.
--
-- An expense keeps the amount and currency it was paid in. exchangeRate is
-- what one unit of that currency was worth in the trip's budget currency when
-- it was recorded, so totals add up in one currency (Phase 3 §3.8.4 noted the
-- live table had no rate). NULL = already in the budget currency (rate 1),
-- which is every expense recorded before this column existed.
--
-- Safe to re-run: a no-op if the column is already there.
alter table public."Expense"
    add column if not exists "exchangeRate" numeric(18, 8);
