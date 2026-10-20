-- Run this by hand in the Supabase SQL editor.
--
-- Same convention as 001_trip_document.sql: the live DB is the source of truth,
-- prisma/migrations must NOT be run against it, and this table is mirrored into
-- schema.prisma by hand. It was first committed as ai-features/migrations/,
-- a third place schema changes could live; moved here so there is one.
--
-- Adds translation history for the Translator page, plus the bucket camera
-- photos are stored in. Safe to re-run: every statement is a no-op if it
-- already happened.
create table if not exists public.translation_history (
    id               uuid primary key default gen_random_uuid(),
    user_id          text,                       -- text so it matches whatever id the Core API sends
    translation_type text not null check (translation_type in ('TEXT', 'IMAGE_CAMERA')),
    source_text      text,
    translated_text  text,
    ocr_data         jsonb,
    source_lang      text,
    detected_lang    text,
    target_lang      text not null,
    image_url        text,
    created_at       timestamptz not null default now()
);

create index if not exists translation_history_user_created_idx
    on public.translation_history (user_id, created_at desc);

-- the service uses the service-role key, which bypasses RLS; enabling it keeps
-- the anon key from reading anyone's history
alter table public.translation_history enable row level security;

insert into storage.buckets (id, name, public)
values ('translation-images', 'translation-images', true)
on conflict (id) do nothing;
