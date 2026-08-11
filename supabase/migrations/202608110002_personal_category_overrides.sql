create table public.user_agenda_category_overrides (
  user_id uuid not null references public.profiles(id) on delete cascade,
  agenda_id uuid not null references public.agendas(id) on delete cascade,
  category text not null check (char_length(category) between 1 and 60),
  updated_at timestamptz not null default now(),
  primary key (user_id, agenda_id)
);

alter table public.user_agenda_category_overrides enable row level security;

create policy "own agenda category overrides" on public.user_agenda_category_overrides
for all to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());
