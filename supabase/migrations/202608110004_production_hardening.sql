begin;

alter table public.sync_runs
  add column if not exists lease_expires_at timestamptz;

update public.sync_runs
set status = 'failed',
    finished_at = coalesce(finished_at, now()),
    error_code = coalesce(error_code, 'closed_by_hardening_migration')
where status = 'running';

create unique index if not exists sync_runs_one_running_per_user_idx
  on public.sync_runs(user_id)
  where status = 'running';

alter table public.gmail_message_receipts
  add column if not exists processing_status text not null default 'succeeded'
    check (processing_status in ('processing', 'succeeded', 'failed')),
  add column if not exists attempt_count integer not null default 1
    check (attempt_count between 1 and 2),
  add column if not exists last_error text,
  add column if not exists updated_at timestamptz not null default now();

create index if not exists audit_events_actor_type_created_idx
  on public.audit_events(actor_id, event_type, created_at desc);

create or replace function public.start_gmail_sync(
  p_user_id uuid,
  p_lease_seconds integer default 75
)
returns table(run_id uuid, acquired boolean)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_run_id uuid;
  v_lease_seconds integer := least(greatest(coalesce(p_lease_seconds, 75), 60), 300);
begin
  if p_user_id is null then
    raise exception 'user_id_required';
  end if;

  update public.sync_runs
  set status = 'failed',
      finished_at = now(),
      error_code = 'sync_lease_expired'
  where user_id = p_user_id
    and status = 'running'
    and coalesce(lease_expires_at, started_at + interval '75 seconds') <= now();

  begin
    insert into public.sync_runs(user_id, status, lease_expires_at)
    values (p_user_id, 'running', now() + make_interval(secs => v_lease_seconds))
    returning id into v_run_id;
  exception when unique_violation then
    return query select null::uuid, false;
    return;
  end;

  return query select v_run_id, true;
end;
$$;

create or replace function public.claim_gmail_message(
  p_user_id uuid,
  p_message_id text,
  p_thread_id text,
  p_internal_date timestamptz
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_claimed text;
begin
  if p_user_id is null or nullif(trim(p_message_id), '') is null then
    return false;
  end if;

  insert into public.gmail_message_receipts(
    user_id,
    message_id,
    thread_id,
    internal_date,
    extraction_outcome,
    processing_status,
    attempt_count,
    processed_at,
    updated_at
  ) values (
    p_user_id,
    p_message_id,
    p_thread_id,
    p_internal_date,
    'processing',
    'processing',
    1,
    now(),
    now()
  )
  on conflict (user_id, message_id) do update
  set thread_id = excluded.thread_id,
      internal_date = excluded.internal_date,
      extraction_outcome = 'processing',
      processing_status = 'processing',
      attempt_count = public.gmail_message_receipts.attempt_count + 1,
      last_error = null,
      updated_at = now()
  where public.gmail_message_receipts.attempt_count < 2
    and (
      public.gmail_message_receipts.processing_status = 'failed'
      or (
        public.gmail_message_receipts.processing_status = 'processing'
        and public.gmail_message_receipts.updated_at < now() - interval '10 minutes'
      )
    )
  returning message_id into v_claimed;

  return v_claimed is not null;
end;
$$;

create or replace function public.consume_ask_kampus_allowance(
  p_user_id uuid,
  p_day_start timestamptz,
  p_day_end timestamptz,
  p_limit integer
)
returns table(allowed boolean, audit_id bigint, used integer, remaining integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_used integer;
  v_audit_id bigint;
  v_limit integer := least(greatest(coalesce(p_limit, 10), 1), 100);
begin
  if p_user_id is null or p_day_start is null or p_day_end is null or p_day_end <= p_day_start then
    raise exception 'invalid_allowance_window';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_user_id::text || ':' || p_day_start::text, 0));

  select count(*)::integer into v_used
  from public.audit_events
  where actor_id = p_user_id
    and event_type = 'ask_kampus_query'
    and created_at >= p_day_start
    and created_at < p_day_end;

  if v_used >= v_limit then
    return query select false, null::bigint, v_used, 0;
    return;
  end if;

  insert into public.audit_events(actor_id, event_type, target_type, metadata)
  values (
    p_user_id,
    'ask_kampus_query',
    'gmail',
    jsonb_build_object('status', 'started', 'source_count', 0, 'input_tokens', 0, 'output_tokens', 0)
  )
  returning id into v_audit_id;

  v_used := v_used + 1;
  return query select true, v_audit_id, v_used, greatest(0, v_limit - v_used);
end;
$$;

create or replace function public.create_shared_agenda(
  p_actor_id uuid,
  p_title text,
  p_category text,
  p_detail text,
  p_deadline timestamptz
)
returns table(agenda_id uuid, stage_id uuid)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_agenda_id uuid;
  v_stage_id uuid;
  v_stable_key text := 'manual-' || gen_random_uuid()::text;
begin
  if not exists(select 1 from public.profiles where id = p_actor_id and role = 'moderator') then
    raise exception 'moderator_required';
  end if;
  if nullif(trim(p_title), '') is null
    or char_length(trim(p_title)) > 180
    or p_category not in ('Case Comps', 'Committees', 'Placements', 'Academics')
    or char_length(coalesce(p_detail, '')) > 500
    or p_deadline is null then
    raise exception 'invalid_shared_agenda';
  end if;

  insert into public.agendas(stable_key, title, category, detail, source_label, confidence, created_by, approved_at)
  values (v_stable_key, trim(p_title), p_category, trim(coalesce(p_detail, '')), 'Verified by moderator', 1, p_actor_id, now())
  returning id into v_agenda_id;

  insert into public.agenda_stages(agenda_id, stable_key, name, deadline, note, position)
  values (v_agenda_id, v_stable_key || '-stage', 'Deadline', p_deadline, 'Verified and added by a moderator.', 1)
  returning id into v_stage_id;

  return query select v_agenda_id, v_stage_id;
end;
$$;

create or replace function public.resolve_moderator_proposal(
  p_actor_id uuid,
  p_proposal_id uuid,
  p_action text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_proposal public.moderator_proposals%rowtype;
  v_payload jsonb;
  v_status public.proposal_status;
  v_agenda_id uuid;
  v_deadline timestamptz;
begin
  if not exists(select 1 from public.profiles where id = p_actor_id and role = 'moderator') then
    raise exception 'moderator_required';
  end if;
  if p_action not in ('approve', 'private', 'reject') then
    raise exception 'invalid_moderator_action';
  end if;

  select * into v_proposal
  from public.moderator_proposals
  where id = p_proposal_id and status = 'open'
  for update;
  if not found then
    raise exception 'proposal_not_open';
  end if;

  v_payload := v_proposal.payload;
  if nullif(v_payload ->> 'deadline', '') is not null then
    v_deadline := (v_payload ->> 'deadline')::timestamptz;
  end if;

  if p_action = 'approve' then
    if v_deadline is null then raise exception 'proposal_deadline_required'; end if;
    if v_proposal.action = 'new' then
      insert into public.agendas(stable_key, title, category, detail, source_label, confidence, created_by, approved_at)
      values (
        'gmail-' || v_proposal.id::text,
        coalesce(nullif(v_payload ->> 'title', ''), v_proposal.title),
        coalesce(nullif(v_payload ->> 'category', ''), 'Academics'),
        coalesce(v_payload ->> 'detail', 'Approved from a batch announcement.'),
        v_proposal.source_summary,
        v_proposal.confidence,
        p_actor_id,
        now()
      ) returning id into v_agenda_id;
      insert into public.agenda_stages(agenda_id, stable_key, name, deadline, note, position)
      values (v_agenda_id, 'gmail-stage-' || v_proposal.id::text, 'Deadline', v_deadline, 'Approved by an IIMK moderator.', 1);
    elsif v_proposal.matched_stage_id is not null then
      update public.agenda_stages set deadline = v_deadline, updated_at = now() where id = v_proposal.matched_stage_id;
      if not found then raise exception 'matched_stage_not_found'; end if;
    else
      raise exception 'matched_stage_required';
    end if;
    v_status := 'approved';
  elsif p_action = 'private' then
    if v_proposal.submitted_by is null or v_deadline is null then
      raise exception 'private_target_required';
    end if;
    insert into public.private_agendas(user_id, title, category, detail, source_label, confidence, deadline)
    values (
      v_proposal.submitted_by,
      coalesce(nullif(v_payload ->> 'title', ''), v_proposal.title),
      coalesce(nullif(v_payload ->> 'category', ''), 'Academics'),
      coalesce(v_payload ->> 'detail', 'Marked private by a moderator.'),
      v_proposal.source_summary,
      v_proposal.confidence,
      v_deadline
    );
    v_status := 'private';
  else
    v_status := 'rejected';
  end if;

  update public.moderator_proposals
  set status = v_status, resolved_at = now(), resolved_by = p_actor_id
  where id = p_proposal_id;

  insert into public.audit_events(actor_id, event_type, target_type, target_id)
  values (p_actor_id, 'proposal.' || v_status::text, 'moderator_proposal', p_proposal_id::text);

  return jsonb_build_object('status', v_status, 'agendaId', v_agenda_id);
end;
$$;

revoke all on function public.start_gmail_sync(uuid, integer) from public, anon, authenticated;
revoke all on function public.claim_gmail_message(uuid, text, text, timestamptz) from public, anon, authenticated;
revoke all on function public.consume_ask_kampus_allowance(uuid, timestamptz, timestamptz, integer) from public, anon, authenticated;
revoke all on function public.create_shared_agenda(uuid, text, text, text, timestamptz) from public, anon, authenticated;
revoke all on function public.resolve_moderator_proposal(uuid, uuid, text) from public, anon, authenticated;

grant execute on function public.start_gmail_sync(uuid, integer) to service_role;
grant execute on function public.claim_gmail_message(uuid, text, text, timestamptz) to service_role;
grant execute on function public.consume_ask_kampus_allowance(uuid, timestamptz, timestamptz, integer) to service_role;
grant execute on function public.create_shared_agenda(uuid, text, text, text, timestamptz) to service_role;
grant execute on function public.resolve_moderator_proposal(uuid, uuid, text) to service_role;

commit;
