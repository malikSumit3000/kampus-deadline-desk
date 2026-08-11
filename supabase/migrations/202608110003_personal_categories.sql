create table public.user_categories (
  user_id uuid not null references public.profiles(id) on delete cascade,
  category text not null check (char_length(category) between 1 and 60),
  created_at timestamptz not null default now(),
  primary key (user_id, category)
);

alter table public.user_categories enable row level security;

create policy "own categories" on public.user_categories
for all to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());
