-- Run in Supabase SQL Editor after backfill-demo-data.sql.
-- Gmail does not allow underscores in usernames, so these demo emails have no mailbox.
-- Also upgrades profiles already renamed by the earlier @inbox.example version.

do $profiles$
declare
  updated_profiles integer;
  updated_invites integer;
begin
  if not pg_try_advisory_xact_lock(hashtext('roamio-demo-backfill-v1')) then
    raise exception 'Another Roamio demo backfill or repair is in progress';
  end if;

  with names as (
    select
      array['Aisha', 'Amara', 'Amelia', 'Ayanda', 'Chloe', 'Daniel', 'Elena', 'Ethan',
            'Farah', 'Gabriel', 'Isabel', 'Jade', 'Jordan', 'Kai', 'Leila', 'Lerato',
            'Liam', 'Maya', 'Nadia', 'Noah', 'Priya', 'Samira', 'Sofia', 'Zane'] as given,
      array['Adams', 'Botha', 'Chen', 'Costa', 'Daniels', 'Dlamini', 'Fernandes', 'Hassan',
            'Jacobs', 'Khan', 'Kim', 'Lewis', 'Martin', 'Mokoena', 'Naidoo', 'Nguyen',
            'Patel', 'Reed', 'Silva', 'Singh', 'Taylor', 'Williams', 'Wilson', 'Zulu'] as family
  ), targets as (
    select u.id, u.email as old_email, u."fullName" as old_name,
      ((u.id::bigint * 37) % 576)::integer as name_index
    from public."User" u
    where u."passwordHash" ~ '^ROAMIO_DEMO_SQL_DISABLED:[0-9]{4}-[0-9]{2}-[0-9]{2}$'
      and (u.email ~ '^seed-[0-9]{4}-[0-9]{2}-[0-9]{2}-[1-6]@roamio-demo[.]invalid$'
        or u.email ~ '^[a-z]+[.][a-z]+[0-9]*@inbox[.]example$')
      and u."emailHash" is null
      and u."deletedAt" is null
  ), identities as (
    select t.id, t.old_email,
      case when t.old_email like '%@inbox.example' then t.old_name
        else n.given[1 + t.name_index % 24] || ' ' || n.family[1 + t.name_index / 24] end as full_name
    from targets t cross join names n
  ), handles as (
    select i.*,
      case when i.old_email like '%@inbox.example' then replace(split_part(i.old_email, '@', 1), '.', '_')
        else lower(replace(i.full_name, ' ', '_')) end as handle
    from identities i
  ), profiles as (
    select h.*,
      h.handle || case
        when row_number() over (partition by h.handle order by h.id) > 1
          or exists (select 1 from public."User" u where u.email = h.handle || '@gmail.com')
        then '_' || h.id::text else '' end || '@gmail.com' as new_email
    from handles h
  ), changed_users as (
    update public."User" u set "fullName" = p.full_name, email = p.new_email
    from profiles p where u.id = p.id
    returning p.old_email, p.new_email
  ), changed_invites as (
    update public."Invitation" i set email = p.new_email
    from changed_users p, public."User" inviter
    where i.email = p.old_email
      and i."emailHash" is null
      and i.status = 'ACCEPTED'
      and inviter.id = i."inviterId"
      and inviter."passwordHash" ~ '^ROAMIO_DEMO_SQL_DISABLED:[0-9]{4}-[0-9]{2}-[0-9]{2}$'
    returning i.id
  )
  select (select count(*) from changed_users), (select count(*) from changed_invites)
    into updated_profiles, updated_invites;

  raise notice 'Updated % demo profiles and % demo invitations', updated_profiles, updated_invites;
end;
$profiles$;

select "fullName" as name, email
from public."User"
where "passwordHash" ~ '^ROAMIO_DEMO_SQL_DISABLED:[0-9]{4}-[0-9]{2}-[0-9]{2}$'
  and email ~ '^[a-z]+_[a-z]+[0-9]*(_[0-9]+)?@gmail[.]com$'
  and "deletedAt" is null
order by id desc
limit 8;
