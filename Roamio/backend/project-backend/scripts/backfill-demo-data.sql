-- Paste this entire file into Supabase SQL Editor in the project you want to seed.
-- The default window ends yesterday (UTC). To pin a window, set end_day below.
-- This inserts fictional analytics activity alongside the data in that project.
-- Demo emails and names are synthetic plaintext. Email hashes are left NULL so
-- the Roamio encryption key stays out of SQL and the demo accounts cannot sign in.

begin;
set local time zone 'UTC';

do $backfill$
declare
  end_day date := current_date - 1; -- Or use a fixed date, e.g. date '2026-11-11'.
  cities text[] := array['Cape Town', 'Lisbon', 'Paris', 'Tokyo'];
  countries text[] := array['South Africa', 'Portugal', 'France', 'Japan'];
  currencies text[] := array['ZAR', 'EUR', 'EUR', 'JPY'];
  languages text[] := array['en', 'en', 'fr', 'ja'];
  themes text[] := array['system', 'light', 'dark'];
  devices text[] := array['desktop', 'mobile', 'mobile'];
  browsers text[] := array['Chrome', 'Safari', 'Chrome'];
  systems text[] := array['Windows', 'iOS', 'Android'];
  categories text[] := array['ACCOMMODATION', 'TRANSPORT', 'FOOD', 'ACTIVITY', 'MISC'];
  expense_titles text[] := array['Booking deposit', 'Local transport', 'Trip supplies'];
  seed_day date;
  day_number integer;
  day_marker text;
  demo_password_hash text;
  person_count integer;
  trip_count integer;
  first_city integer;
  existing_groups integer;
  demo_email text;
  verified boolean;
  user_ids integer[];
  person_id integer;
  device_index integer;
  login_at timestamptz;
  city_index integer;
  currency_code text;
  destination_name text;
  trip_title text;
  cost_scale integer;
  budget_amount integer;
  completed boolean;
  landmark_id integer;
  member_ids integer[];
  group_id integer;
  trip_id integer;
  expense_id text;
  expense_amount integer;
  expense_category public."Expense".category%type;
  chat_id integer;
  added_days integer := 0;
  added_users integer := 0;
  added_trips integer := 0;
begin
  if end_day is null or end_day >= current_date or end_day < date '2000-01-30' then
    raise exception 'end_day must be between 2000-01-30 and yesterday (UTC)';
  end if;
  if not pg_try_advisory_xact_lock(hashtext('roamio-demo-backfill-v1')) then
    raise exception 'Another Roamio demo backfill is in progress';
  end if;

  for day_offset in 0..29 loop
    seed_day := end_day - (29 - day_offset);
    day_number := seed_day - date '1970-01-01';
    day_marker := 'roamio-demo-backfill-v1:' || to_char(seed_day, 'YYYY-MM-DD');
    demo_password_hash := 'ROAMIO_DEMO_SQL_DISABLED:' || to_char(seed_day, 'YYYY-MM-DD');
    person_count := 3 + (day_number * 7 + day_number / 7) % 4;
    trip_count := case when person_count >= 5 then 2 else 1 end;
    first_city := 1 + (day_number + day_number / 4) % 4;

    -- The group names also recognize dates seeded by the earlier Node script.
    select count(*) into existing_groups from public."TravelGroup"
      where description = day_marker
        or name = format('[Roamio Demo] %s · %s', cities[first_city], to_char(seed_day, 'YYYY-MM-DD'))
        or (trip_count = 2 and name = format('[Roamio Demo] %s · %s', cities[1 + first_city % 4], to_char(seed_day, 'YYYY-MM-DD')));
    if existing_groups = trip_count then
      continue;
    end if;
    if existing_groups > 0 or exists (
      select 1 from public."User" where "passwordHash" = demo_password_hash
        or email like format('seed-%s-%%@roamio-demo.invalid', to_char(seed_day, 'YYYY-MM-DD'))
    ) then
      raise exception 'Demo records already exist but are incomplete or conflict for %', seed_day;
    end if;

    user_ids := array[]::integer[];
    for person in 1..person_count loop
      demo_email := format('seed-%s-%s@roamio-demo.invalid', to_char(seed_day, 'YYYY-MM-DD'), person);
      verified := person < person_count or day_number % 3 = 0;
      insert into public."User" (email, "fullName", "passwordHash", "isVerified", "createdAt", "updatedAt")
      values (demo_email, format('[Roamio Demo] Traveller %s / %s', to_char(seed_day, 'YYYY-MM-DD'), person),
        demo_password_hash, verified, seed_day + time '08:00', seed_day + time '08:00')
      returning id into person_id;
      user_ids := array_append(user_ids, person_id);

      insert into public."UserPreference" ("userId", language, currency, theme, "emailAlerts", "pushAlerts", "updatedAt")
      values (person_id, languages[1 + (day_number + person - 1) % 4], currencies[1 + (day_number + person - 1) % 4],
        themes[1 + (person - 1) % 3], false, false, seed_day + time '08:00');
      if verified then
        device_index := 1 + (day_number + person - 1) % 3;
        login_at := seed_day + time '09:00';
        insert into public."LoginEvent" ("userId", at, browser, os, "deviceType", success)
          select person_id, login_time, browsers[device_index], systems[device_index], devices[device_index], true
          from (values (login_at), (login_at + interval '25 hours')) as logins(login_time)
          where login_time = login_at or (seed_day < end_day and (day_number + person - 1) % 3 <> 0);
        insert into public."WizardStepEvent" ("userId", step, at)
          select person_id, step, seed_day + time '10:00' + step * interval '6 minutes'
          from generate_series(0, 5 - person - day_number % 2) as steps(step);
      end if;
    end loop;

    for trip_number in 1..trip_count loop
      member_ids := case when trip_number = 1 then user_ids[1:2] else user_ids[3:3] end;
      city_index := 1 + (first_city + trip_number - 2) % 4;
      currency_code := currencies[city_index];
      destination_name := cities[city_index] || ', ' || countries[city_index];
      trip_title := format('[Roamio Demo] %s · %s', cities[city_index], to_char(seed_day, 'YYYY-MM-DD'));
      cost_scale := case currency_code when 'EUR' then 1 when 'ZAR' then 20 else 150 end;
      budget_amount := (380 + (day_number % 9) * 20) * cost_scale;
      completed := seed_day + 2 <= end_day;

      insert into public."TravelGroup" (name, description, "createdAt", "updatedAt")
      values (trip_title, day_marker, seed_day + time '11:00', seed_day + time '11:00') returning id into group_id;
      insert into public."TravelGroupMember" ("travelGroupId", "userId", role, "joinedAt")
        select group_id, member_id, case when member_number = 1 then 'OWNER' else 'MEMBER' end, seed_day + time '11:00'
        from unnest(member_ids) with ordinality as members(member_id, member_number);

      insert into public."Trip" ("travelGroupId", title, description, "startDate", "endDate", status, "createdAt", "updatedAt")
      values (group_id, trip_title,
        jsonb_build_object('destination', destination_name, 'budget', budget_amount, 'currency', currency_code, 'notes', '[Roamio Demo]')::text,
        seed_day + 1, seed_day + 2, case when completed then 'COMPLETED' else 'PLANNING' end,
        seed_day + time '12:00', case when completed then (seed_day + 2)::timestamp else seed_day + time '12:00' end)
      returning id into trip_id;
      insert into public."TripMember" ("tripId", "userId", role, "joinedAt")
        select trip_id, member_id, case when member_number = 1 then 'ORGANIZER' else 'COLLABORATOR' end, seed_day + time '12:00'
        from unnest(member_ids) with ordinality as members(member_id, member_number);

      if completed then
        select d.id into landmark_id from public."Destination" d
          join public."City" c on c.id = d."cityId"
          join public."Country" co on co.id = c."countryId"
          where c.name = cities[city_index] and co.name = countries[city_index]
          order by d.id limit 1;
        if landmark_id is not null then
          insert into public."TripDestination" ("tripId", "destinationId", "scheduledDay", "createdAt")
          values (trip_id, landmark_id, 1, seed_day + time '13:00');
        end if;
      end if;

      insert into public."Budget" ("tripId", "totalAmount", currency, "createdAt", "updatedAt")
      values (trip_id, budget_amount, currency_code, seed_day + time '12:00', seed_day + time '12:00');
      insert into public."ItineraryItem" (id, "tripId", title, location, "dayNumber", "startTime", "createdAt", "updatedAt")
        select gen_random_uuid()::text, trip_id, stop, destination_name, stop_day,
          seed_day + stop_day + time '10:00', seed_day + time '13:00', seed_day + time '13:00'
        from (values ('City walk', 1), ('Local market', 2)) as stops(stop, stop_day);

      for entry in 1..3 loop
        expense_id := gen_random_uuid()::text;
        expense_amount := (case when entry = 1 then 96 else 12 + ((day_number + entry - 1) % 8) * 2 end) * cost_scale;
        expense_category := categories[case when entry < 3 then entry else 3 + day_number % 3 end];
        insert into public."Expense" (id, "tripId", title, amount, currency, "paidById", category, date, "createdAt", "updatedAt")
        values (expense_id, trip_id, expense_titles[entry], expense_amount, currency_code, member_ids[1],
          expense_category, seed_day + make_time(14 + entry, 0, 0), seed_day + make_time(14 + entry, 0, 0), seed_day + make_time(14 + entry, 0, 0));
        insert into public."ExpenseSplit" ("expenseId", "userId", "shareAmount", "isSettled")
          select expense_id, member_id, expense_amount::numeric / cardinality(member_ids), member_number = 1 or day_number % 3 = 0
          from unnest(member_ids) with ordinality as members(member_id, member_number);
      end loop;

      insert into public."ChatConversation" ("userId", "tripId", title, "createdAt", "updatedAt")
      values (member_ids[1], trip_id, '[Roamio Demo] ' || cities[city_index] || ' planning', seed_day + time '14:00', seed_day + time '14:06')
      returning id into chat_id;
      insert into public."ChatMessage" ("conversationId", role, content, "createdAt") values
        (chat_id, 'user', format('What should I pack for a weekend in %s?', cities[city_index]), seed_day + time '14:00'),
        (chat_id, 'assistant', 'Bring comfortable walking shoes, layers and a reusable water bottle.', seed_day + time '14:06');
      insert into public.translation_history (user_id, translation_type, source_lang, detected_lang, target_lang, source_text, translated_text, created_at)
      values (member_ids[1]::text, 'TEXT', 'en', 'en', 'fr', 'Where is the station?', 'Où est la gare ?', seed_day + time '14:00');

      if trip_number = 1 then
        insert into public."Invitation" ("travelGroupId", "inviterId", email, token, status, "createdAt", "expiresAt")
          select group_id, member_ids[1], invite_email, gen_random_uuid()::text, invite_status, seed_day + time '11:00', seed_day + time '23:00'
          from (values
            (format('seed-%s-2@roamio-demo.invalid', to_char(seed_day, 'YYYY-MM-DD')), 'ACCEPTED'),
            (format('guest-%s@roamio-demo.invalid', to_char(seed_day, 'YYYY-MM-DD')), 'EXPIRED')
          ) as invites(invite_email, invite_status)
          where invite_status = 'ACCEPTED' or day_number % 3 = 0;
        insert into public."Notification" ("userId", "tripId", type, title, message, "isRead", "createdAt")
        values (member_ids[2], trip_id, 'TRIP_UPDATE', '[Roamio Demo] Trip ready',
          format('Your group planned a trip to %s.', cities[city_index]), day_number % 3 <> 0, seed_day + time '14:00');
      end if;
    end loop;

    added_days := added_days + 1;
    added_users := added_users + person_count;
    added_trips := added_trips + trip_count;
  end loop;

  raise notice 'Roamio demo backfill (% through % UTC): % days added, % skipped, % users, % trips, % expenses added.',
    end_day - 29, end_day, added_days, 30 - added_days, added_users, added_trips, added_trips * 3;
end;
$backfill$;

commit;
