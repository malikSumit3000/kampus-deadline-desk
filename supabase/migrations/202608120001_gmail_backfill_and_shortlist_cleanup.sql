alter table public.gmail_connections
  add column if not exists backfill_completed_at timestamptz;

update public.gmail_connections
set scan_after = connected_at - interval '7 days',
    backfill_completed_at = null,
    updated_at = now()
where revoked_at is null
  and backfill_completed_at is null;

delete from public.review_items
where status = 'open'
  and title ~* '(shortlist|shortlisted|selection[[:space:]]+list|placement[[:space:]]+result)';
