-- Meetings table for Meeting Notes app
create table if not exists public.meetings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text,
  summary text,
  transcript text,
  audio_url text,
  status text not null default 'pending' check (status in ('pending', 'processing', 'processed', 'failed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists meetings_user_id_idx on public.meetings(user_id);
create index if not exists meetings_created_at_idx on public.meetings(created_at desc);

-- RLS: users can only see and insert their own meetings; service role can update any (for backend)
alter table public.meetings enable row level security;

create policy "Users can read own meetings"
  on public.meetings for select
  using (auth.uid() = user_id);

create policy "Users can insert own meetings"
  on public.meetings for insert
  with check (auth.uid() = user_id);

-- Backend updates via service role key (bypasses RLS). No update policy for anon/authenticated needed for backend.
create policy "Users can update own meetings"
  on public.meetings for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Storage bucket for recordings (create via dashboard or API; policy below)
insert into storage.buckets (id, name, public)
values ('recordings', 'recordings', true)
on conflict (id) do nothing;

create policy "Authenticated users can upload to own folder"
  on storage.objects for insert
  with check (
    bucket_id = 'recordings'
    and auth.role() = 'authenticated'
    and (storage.foldername(name))[1] = 'meetings'
  );

create policy "Public read for recordings"
  on storage.objects for select
  using (bucket_id = 'recordings');

create policy "Users can update own objects"
  on storage.objects for update
  using (bucket_id = 'recordings' and auth.uid()::text = (storage.foldername(name))[2]);
