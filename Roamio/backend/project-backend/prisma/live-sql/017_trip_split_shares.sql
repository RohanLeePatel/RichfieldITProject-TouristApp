-- Run this by hand in the Supabase SQL editor, BEFORE deploying the code that reads it.
--
-- Same convention as the other live-sql files: the live DB is the source of truth and
-- schema.prisma is mirrored by hand. Adds the trip's saved split of new expenses,
-- { "<userId>": percent }; NULL or {} means split evenly. Safe to re-run.
ALTER TABLE "Trip" ADD COLUMN IF NOT EXISTS "splitShares" JSONB;
