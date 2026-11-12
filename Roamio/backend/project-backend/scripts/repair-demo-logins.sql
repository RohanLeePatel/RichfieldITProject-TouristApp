-- Run in the same Supabase SQL Editor as the demo backfill.
-- Restore a signup-day sign-in only for verified SQL demo users missing one.

do $repair$
declare
  added integer;
begin
  if not pg_try_advisory_xact_lock(hashtext('roamio-demo-backfill-v1')) then
    raise exception 'Another Roamio demo backfill or repair is in progress';
  end if;
  insert into public."LoginEvent" ("userId", at, browser, os, "deviceType", success)
    select u.id, (u."createdAt" at time zone 'UTC') + interval '1 hour', 'Chrome', 'Windows', 'desktop', true
    from public."User" u
    where u."passwordHash" ~ '^ROAMIO_DEMO_SQL_DISABLED:[0-9]{4}-[0-9]{2}-[0-9]{2}$'
      and u."isVerified"
      and u."deletedAt" is null
      and (u."createdAt" at time zone 'UTC') + interval '1 hour' <= now()
      and not exists (
        select 1 from public."LoginEvent" l where l."userId" = u.id and l.success
      );
  get diagnostics added = row_count;
  raise notice 'Added % missing demo sign-ins', added;
end;
$repair$;

select count(*) as verified_demo_users,
  count(*) filter (where exists (
    select 1 from public."LoginEvent" l where l."userId" = u.id and l.success
  )) as users_with_last_login
from public."User" u
where u."passwordHash" ~ '^ROAMIO_DEMO_SQL_DISABLED:[0-9]{4}-[0-9]{2}-[0-9]{2}$'
  and u."isVerified"
  and u."deletedAt" is null;
