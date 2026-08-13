begin;

alter table public.profiles
  add column if not exists is_admin boolean not null default false,
  add column if not exists account_status text not null default 'active'
    check (account_status in ('active', 'blocked')),
  add column if not exists blocked_at timestamptz,
  add column if not exists blocked_by uuid references public.profiles(id) on delete set null;

alter table public.agendas drop constraint if exists agendas_created_by_fkey;
alter table public.agendas add constraint agendas_created_by_fkey foreign key (created_by) references public.profiles(id) on delete set null;
alter table public.moderator_proposals drop constraint if exists moderator_proposals_resolved_by_fkey;
alter table public.moderator_proposals add constraint moderator_proposals_resolved_by_fkey foreign key (resolved_by) references public.profiles(id) on delete set null;

create index if not exists profiles_account_status_created_idx
  on public.profiles(account_status, created_at desc);

update public.profiles
set is_admin = true,
    updated_at = now()
where lower(email) = 'mba26sumit@iimk.ac.in';

create or replace function public.is_active_account()
returns boolean language sql stable security definer set search_path = public
as $$ select exists(select 1 from public.profiles where id = auth.uid() and account_status = 'active') $$;

create or replace function public.is_moderator()
returns boolean language sql stable security definer set search_path = public
as $$ select exists(select 1 from public.profiles where id = auth.uid() and role = 'moderator' and account_status = 'active') $$;

drop policy if exists "profiles own read" on public.profiles;
create policy "profiles own read" on public.profiles for select using (id = auth.uid() and public.is_active_account());

drop policy if exists "authenticated read approved agendas" on public.agendas;
create policy "authenticated read approved agendas" on public.agendas for select to authenticated using (approved_at is not null and public.is_active_account());
drop policy if exists "authenticated read stages" on public.agenda_stages;
create policy "authenticated read stages" on public.agenda_stages for select to authenticated using (public.is_active_account() and exists(select 1 from public.agendas a where a.id = agenda_id and a.approved_at is not null));

drop policy if exists "own private agendas" on public.private_agendas;
create policy "own private agendas" on public.private_agendas for all to authenticated using (user_id = auth.uid() and public.is_active_account()) with check (user_id = auth.uid() and public.is_active_account());
drop policy if exists "own progress" on public.user_progress;
create policy "own progress" on public.user_progress for all to authenticated using (user_id = auth.uid() and public.is_active_account()) with check (user_id = auth.uid() and public.is_active_account());
drop policy if exists "own deadline overrides" on public.private_deadline_overrides;
create policy "own deadline overrides" on public.private_deadline_overrides for all to authenticated using (user_id = auth.uid() and public.is_active_account()) with check (user_id = auth.uid() and public.is_active_account());
drop policy if exists "own reviews" on public.review_items;
create policy "own reviews" on public.review_items for all to authenticated using (user_id = auth.uid() and public.is_active_account()) with check (user_id = auth.uid() and public.is_active_account());
drop policy if exists "own agenda category overrides" on public.user_agenda_category_overrides;
create policy "own agenda category overrides" on public.user_agenda_category_overrides for all to authenticated using (user_id = auth.uid() and public.is_active_account()) with check (user_id = auth.uid() and public.is_active_account());
drop policy if exists "own categories" on public.user_categories;
create policy "own categories" on public.user_categories for all to authenticated using (user_id = auth.uid() and public.is_active_account()) with check (user_id = auth.uid() and public.is_active_account());

create or replace function public.clear_private_agendas(p_user_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_deleted integer;
begin
  if p_user_id is null or not exists(select 1 from public.profiles where id = p_user_id and account_status = 'active') then
    raise exception 'active_account_required';
  end if;

  delete from public.private_agendas where user_id = p_user_id;
  get diagnostics v_deleted = row_count;

  insert into public.audit_events(actor_id, event_type, target_type, target_id, metadata)
  values (p_user_id, 'private_agendas.cleared', 'profile', p_user_id::text, jsonb_build_object('deleted_count', v_deleted));

  return v_deleted;
end;
$$;

create or replace function public.set_account_status(
  p_actor_id uuid,
  p_target_id uuid,
  p_status text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_target public.profiles%rowtype;
begin
  if not exists(select 1 from public.profiles where id = p_actor_id and is_admin = true and account_status = 'active') then
    raise exception 'admin_required';
  end if;
  if p_status not in ('active', 'blocked') then
    raise exception 'invalid_account_status';
  end if;

  select * into v_target from public.profiles where id = p_target_id for update;
  if not found then raise exception 'account_not_found'; end if;
  if p_target_id = p_actor_id then raise exception 'cannot_manage_self'; end if;
  if v_target.is_admin then raise exception 'cannot_manage_admin'; end if;

  update public.profiles
  set account_status = p_status,
      blocked_at = case when p_status = 'blocked' then now() else null end,
      blocked_by = case when p_status = 'blocked' then p_actor_id else null end,
      updated_at = now()
  where id = p_target_id;

  if p_status = 'blocked' then
    delete from public.gmail_connections where user_id = p_target_id;
  end if;

  insert into public.audit_events(actor_id, event_type, target_type, target_id, metadata)
  values (p_actor_id, 'admin.account_' || p_status, 'profile', p_target_id::text, jsonb_build_object('status', 'succeeded'));

  return jsonb_build_object('id', p_target_id, 'status', p_status, 'gmailConnected', false);
end;
$$;

create or replace function public.list_admin_accounts(p_actor_id uuid, p_limit integer default 200)
returns table(
  id uuid,
  display_name text,
  email text,
  role public.user_role,
  is_admin boolean,
  account_status text,
  created_at timestamptz,
  gmail_connected boolean,
  last_sync_at timestamptz,
  sync_error_code text,
  private_task_count bigint,
  open_review_count bigint
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists(select 1 from public.profiles where profiles.id = p_actor_id and profiles.is_admin = true and profiles.account_status = 'active') then
    raise exception 'admin_required';
  end if;

  return query
  select
    p.id,
    p.display_name,
    p.email,
    p.role,
    p.is_admin,
    p.account_status,
    p.created_at,
    (gc.user_id is not null and gc.revoked_at is null) as gmail_connected,
    gc.last_sync_at,
    latest_sync.error_code as sync_error_code,
    (select count(*) from public.private_agendas pa where pa.user_id = p.id) as private_task_count,
    (select count(*) from public.review_items ri where ri.user_id = p.id and ri.status = 'open') as open_review_count
  from public.profiles p
  left join public.gmail_connections gc on gc.user_id = p.id
  left join lateral (
    select sr.error_code
    from public.sync_runs sr
    where sr.user_id = p.id and sr.status = 'failed'
    order by sr.started_at desc
    limit 1
  ) latest_sync on true
  order by p.created_at desc
  limit least(greatest(coalesce(p_limit, 200), 1), 200);
end;
$$;

revoke all on function public.clear_private_agendas(uuid) from public, anon, authenticated;
revoke all on function public.set_account_status(uuid, uuid, text) from public, anon, authenticated;
revoke all on function public.list_admin_accounts(uuid, integer) from public, anon, authenticated;
grant execute on function public.clear_private_agendas(uuid) to service_role;
grant execute on function public.set_account_status(uuid, uuid, text) to service_role;
grant execute on function public.list_admin_accounts(uuid, integer) to service_role;

commit;
