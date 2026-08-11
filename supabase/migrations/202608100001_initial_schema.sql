begin;

create extension if not exists pgcrypto;

create type public.user_role as enum ('student', 'moderator');
create type public.stage_status as enum ('to-do', 'in progress', 'submitted');
create type public.review_status as enum ('open', 'approved', 'corrected', 'dismissed');
create type public.proposal_status as enum ('open', 'approved', 'private', 'rejected');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique check (lower(email) ~ '^[^@[:space:]]+@iimk\.ac\.in$'),
  display_name text not null,
  avatar_url text,
  role public.user_role not null default 'student',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.agendas (
  id uuid primary key default gen_random_uuid(),
  stable_key text not null unique,
  title text not null,
  category text not null check (category in ('Case Comps', 'Committees', 'Placements', 'Academics')),
  detail text not null default '',
  source_label text not null,
  confidence numeric(4,3) not null check (confidence between 0 and 1),
  created_by uuid references public.profiles(id),
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.agenda_stages (
  id uuid primary key default gen_random_uuid(),
  agenda_id uuid not null references public.agendas(id) on delete cascade,
  stable_key text not null unique,
  name text not null,
  deadline timestamptz not null,
  note text not null default '',
  position integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.private_agendas (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  category text not null,
  detail text not null default '',
  source_label text not null,
  confidence numeric(4,3) not null check (confidence between 0 and 1),
  deadline timestamptz not null,
  status public.stage_status not null default 'to-do',
  private_override date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.user_progress (
  user_id uuid not null references public.profiles(id) on delete cascade,
  stage_id uuid not null references public.agenda_stages(id) on delete cascade,
  status public.stage_status not null default 'to-do',
  updated_at timestamptz not null default now(),
  primary key (user_id, stage_id)
);

create table public.private_deadline_overrides (
  user_id uuid not null references public.profiles(id) on delete cascade,
  stage_id uuid not null references public.agenda_stages(id) on delete cascade,
  deadline date not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, stage_id)
);

create table public.review_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  kind text not null,
  title text not null,
  reason text not null,
  proposed_deadline timestamptz,
  gmail_message_id text,
  status public.review_status not null default 'open',
  extraction jsonb not null default '{}'::jsonb,
  received_at timestamptz not null,
  resolved_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.moderator_proposals (
  id uuid primary key default gen_random_uuid(),
  action text not null check (action in ('extension', 'new', 'correction')),
  title text not null,
  matched_stage_id uuid references public.agenda_stages(id),
  before_value text not null,
  proposed_value text not null,
  source_summary text not null,
  confidence numeric(4,3) not null check (confidence between 0 and 1),
  payload jsonb not null default '{}'::jsonb,
  submitted_by uuid references public.profiles(id) on delete set null,
  status public.proposal_status not null default 'open',
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by uuid references public.profiles(id)
);

-- Server-only: encrypted refresh tokens never pass through browser/RLS clients.
create table public.gmail_connections (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  google_email text not null check (lower(google_email) ~ '^[^@[:space:]]+@iimk\.ac\.in$'),
  encrypted_refresh_token text not null,
  connected_at timestamptz not null default now(),
  scan_after timestamptz not null default now(),
  last_sync_at timestamptz,
  last_error text,
  revoked_at timestamptz,
  updated_at timestamptz not null default now()
);

create table public.gmail_message_receipts (
  user_id uuid not null references public.profiles(id) on delete cascade,
  message_id text not null,
  thread_id text,
  internal_date timestamptz not null,
  extraction_outcome text not null,
  content_hash text,
  processed_at timestamptz not null default now(),
  primary key (user_id, message_id)
);

create table public.sync_runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  status text not null check (status in ('running', 'succeeded', 'failed')),
  messages_scanned integer not null default 0,
  candidates_found integer not null default 0,
  error_code text
);

create table public.audit_events (
  id bigint generated always as identity primary key,
  actor_id uuid references public.profiles(id) on delete set null,
  event_type text not null,
  target_type text,
  target_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create or replace function public.is_moderator()
returns boolean language sql stable security definer set search_path = public
as $$ select exists(select 1 from public.profiles where id = auth.uid() and role = 'moderator') $$;

alter table public.profiles enable row level security;
alter table public.agendas enable row level security;
alter table public.agenda_stages enable row level security;
alter table public.private_agendas enable row level security;
alter table public.user_progress enable row level security;
alter table public.private_deadline_overrides enable row level security;
alter table public.review_items enable row level security;
alter table public.moderator_proposals enable row level security;
alter table public.gmail_connections enable row level security;
alter table public.gmail_message_receipts enable row level security;
alter table public.sync_runs enable row level security;
alter table public.audit_events enable row level security;

create policy "profiles own read" on public.profiles for select using (id = auth.uid());
create policy "profiles own insert" on public.profiles for insert with check (
  id = auth.uid() and role = 'student' and lower(email) = lower(auth.jwt() ->> 'email')
);

create policy "authenticated read approved agendas" on public.agendas for select to authenticated using (approved_at is not null);
create policy "moderators manage agendas" on public.agendas for all to authenticated using (public.is_moderator()) with check (public.is_moderator());
create policy "authenticated read stages" on public.agenda_stages for select to authenticated using (exists(select 1 from public.agendas a where a.id = agenda_id and a.approved_at is not null));
create policy "moderators manage stages" on public.agenda_stages for all to authenticated using (public.is_moderator()) with check (public.is_moderator());

create policy "own private agendas" on public.private_agendas for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own progress" on public.user_progress for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own deadline overrides" on public.private_deadline_overrides for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own reviews" on public.review_items for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "moderators read proposals" on public.moderator_proposals for select to authenticated using (public.is_moderator());
create policy "moderators update proposals" on public.moderator_proposals for update to authenticated using (public.is_moderator()) with check (public.is_moderator());

-- No user policies for token/receipt/sync/audit tables. Service-role routes only.

create index agenda_stages_deadline_idx on public.agenda_stages(deadline);
create index review_items_user_status_idx on public.review_items(user_id, status, received_at desc);
create index sync_runs_user_started_idx on public.sync_runs(user_id, started_at desc);
create index receipts_user_date_idx on public.gmail_message_receipts(user_id, internal_date desc);

commit;
