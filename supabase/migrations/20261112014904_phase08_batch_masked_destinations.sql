create function public.recorded_payment_destinations()
returns table(claim_id uuid,label text,kind text,holder text,institution text,masked text)
language sql stable security definer set search_path='' as $$
  select d.claim_id,d.label,d.kind,d.holder,d.institution,d.masked
  from public.claim_payment_destinations d
  join public.reimbursement_payments p on p.claim_id=d.claim_id
  where private.can_read_claim(d.claim_id)
  order by d.claim_id;
$$;
revoke all on function public.recorded_payment_destinations() from public,anon;
grant execute on function public.recorded_payment_destinations() to authenticated;
