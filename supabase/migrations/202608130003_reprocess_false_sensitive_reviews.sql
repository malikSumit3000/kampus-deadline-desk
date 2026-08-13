begin;

delete from public.gmail_message_receipts as receipt
using public.review_items as review
where review.kind = 'Sensitive message'
  and review.status = 'open'
  and review.gmail_message_id is not null
  and receipt.user_id = review.user_id
  and receipt.message_id = review.gmail_message_id;

delete from public.review_items
where kind = 'Sensitive message'
  and status = 'open';

commit;
