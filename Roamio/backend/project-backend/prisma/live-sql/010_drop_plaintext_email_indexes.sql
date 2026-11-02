-- Run LAST, after 009, the new code is deployed and the backfill has encrypted every row.
-- The unique/plain indexes on "email" now index random ciphertext and protect nothing:
-- uniqueness and lookups go through "emailHash" (009). Dropping them also stops the
-- planner and the stats from holding what used to be plaintext addresses.
-- Safe to re-run.

alter table "User" drop constraint if exists "User_email_key";
drop index if exists "User_email_key";
drop index if exists "User_email_idx";
drop index if exists "Invitation_email_idx";
