begin;

create or replace function public.resolve_review_item(
  p_actor_id uuid,
  p_review_id uuid,
  p_action text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_review public.review_items%rowtype;
  v_status public.review_status;
  v_agenda public.private_agendas%rowtype;
  v_payload jsonb;
begin
  if p_action not in ('approve', 'correct', 'dismiss') then
    raise exception 'invalid_review_action';
  end if;

  select * into v_review
  from public.review_items
  where id = p_review_id and user_id = p_actor_id and status = 'open'
  for update;
  if not found then raise exception 'review_not_open'; end if;

  if p_action = 'approve' then
    if v_review.proposed_deadline is null then raise exception 'review_deadline_required'; end if;
    v_payload := v_review.extraction;
    insert into public.private_agendas(user_id, title, category, detail, source_label, confidence, deadline)
    values (
      p_actor_id,
      coalesce(nullif(v_payload ->> 'title', ''), v_review.title),
      coalesce(nullif(v_payload ->> 'category', ''), 'Academics'),
      coalesce(v_payload ->> 'detail', v_review.reason),
      'Gmail review',
      greatest(0, least(1, coalesce((v_payload ->> 'confidence')::numeric, 0.9))),
      v_review.proposed_deadline
    ) returning * into v_agenda;
    v_status := 'approved';
  elsif p_action = 'correct' then
    v_status := 'corrected';
  else
    v_status := 'dismissed';
  end if;

  update public.review_items
  set status = v_status, resolved_at = now()
  where id = p_review_id;

  insert into public.audit_events(actor_id, event_type, target_type, target_id)
  values (p_actor_id, 'review.' || v_status::text, 'review_item', p_review_id::text);

  return jsonb_build_object(
    'status', v_status,
    'agenda', case when v_status = 'approved' then jsonb_build_object(
      'id', v_agenda.id,
      'title', v_agenda.title,
      'category', v_agenda.category,
      'detail', v_agenda.detail,
      'source_label', v_agenda.source_label,
      'confidence', v_agenda.confidence,
      'deadline', v_agenda.deadline,
      'status', v_agenda.status
    ) else null end
  );
end;
$$;

revoke all on function public.resolve_review_item(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.resolve_review_item(uuid, uuid, text) to service_role;

commit;
