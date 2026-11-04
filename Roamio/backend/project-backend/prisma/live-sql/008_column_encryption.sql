-- Column-level encryption, phase 1 (src/utils/columnEncryption.js).
-- Schema change only: the two SavedTraveller date columns become text so they can hold
-- ciphertext. Existing values are kept as 'YYYY-MM-DD' and are read normally until
-- scripts/backfill-column-encryption.js encrypts them. Encryption itself is done in Node:
-- Postgres has no AES-GCM and the key must never appear in SQL or query logs.
-- Safe to re-run: each ALTER only fires while the column is still a date.

do $$
begin
  if (select data_type from information_schema.columns
       where table_schema = 'public' and table_name = 'SavedTraveller' and column_name = 'dateOfBirth') = 'date' then
    alter table "SavedTraveller" alter column "dateOfBirth" type text using to_char("dateOfBirth", 'YYYY-MM-DD');
  end if;
  if (select data_type from information_schema.columns
       where table_schema = 'public' and table_name = 'SavedTraveller' and column_name = 'documentExpiry') = 'date' then
    alter table "SavedTraveller" alter column "documentExpiry" type text using to_char("documentExpiry", 'YYYY-MM-DD');
  end if;
end $$;

-- After the backfill, each of these should return 0:
-- select count(*) from "SavedTraveller" where "firstName" not like 'enc:v1:%' or "dateOfBirth" not like 'enc:v1:%';
-- select count(*) from "PushSubscription" where p256dh not like 'enc:v1:%' or auth not like 'enc:v1:%';
-- select count(*) from "UserSession" where "ipAddress" <> '' and "ipAddress" not like 'enc:v1:%';
-- select count(*) from "LoginEvent" where "ipAddress" <> '' and "ipAddress" not like 'enc:v1:%';
-- select count(*) from "TripDocument" where substring(data from 1 for 6) <> convert_to('RMENC1', 'UTF8');
