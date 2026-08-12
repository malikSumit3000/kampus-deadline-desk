begin;

alter table public.gmail_message_receipts
  drop constraint if exists gmail_message_receipts_attempt_count_check;

alter table public.gmail_message_receipts
  add constraint gmail_message_receipts_attempt_count_check
  check (attempt_count between 1 and 5);

alter table public.private_agendas
  add column if not exists gmail_message_id text,
  add column if not exists gmail_task_index integer;

create unique index if not exists private_agendas_gmail_task_idx
  on public.private_agendas(user_id, gmail_message_id, gmail_task_index)
  where gmail_message_id is not null and gmail_task_index is not null;

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
    user_id, message_id, thread_id, internal_date, extraction_outcome,
    processing_status, attempt_count, processed_at, updated_at
  ) values (
    p_user_id, p_message_id, p_thread_id, p_internal_date, 'processing',
    'processing', 1, now(), now()
  )
  on conflict (user_id, message_id) do update
  set thread_id = excluded.thread_id,
      internal_date = excluded.internal_date,
      extraction_outcome = 'processing',
      processing_status = 'processing',
      attempt_count = public.gmail_message_receipts.attempt_count + 1,
      last_error = null,
      updated_at = now()
  where public.gmail_message_receipts.attempt_count < 5
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

revoke all on function public.claim_gmail_message(uuid, text, text, timestamptz) from public, anon, authenticated;
grant execute on function public.claim_gmail_message(uuid, text, text, timestamptz) to service_role;

commit;
