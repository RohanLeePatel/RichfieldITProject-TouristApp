-- Encrypting User.email / User.fullName / Invitation.email (src/utils/columnEncryption.js).
-- Ciphertext is random, so the app matches emails through "emailHash": an HMAC of the
-- lowercased address, written by the app (the key never touches SQL).
-- Additive only: the running code ignores these columns, so apply this BEFORE deploying.
-- Safe to re-run.

alter table "User" add column if not exists "emailHash" text;
alter table "Invitation" add column if not exists "emailHash" text;

-- Several NULLs are allowed, so rows without a hash yet do not collide.
create unique index if not exists "User_emailHash_key" on "User" ("emailHash");
create index if not exists "Invitation_emailHash_idx" on "Invitation" ("emailHash");

-- Order of work:
--   1. apply this file
--   2. node scripts/backfill-column-encryption.js --hashes-only   (fills emailHash from the plaintext emails)
--   3. deploy the new code
--   4. node scripts/backfill-column-encryption.js                 (encrypts, and hashes anyone who signed up in between)
--   5. apply 010_drop_plaintext_email_indexes.sql
