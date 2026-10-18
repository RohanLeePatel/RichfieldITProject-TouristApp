-- Translation history + camera image bucket. Run in the Supabase SQL editor.
create table if not exists public.translation_history (
    id               uuid primary key default gen_random_uuid(),
    user_id          text,                       -- null = guest; text so it matches whatever id the Core API sends
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
