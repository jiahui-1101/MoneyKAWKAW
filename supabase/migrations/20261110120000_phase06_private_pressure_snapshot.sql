-- Current authorized snapshot only; no historical outcome/probability is invented.
create function public.claim_pressure_snapshot(p_claim_id uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare c public.claims%rowtype; a public.activities%rowtype; d jsonb;
  a_available bigint; unclaimed_count bigint; pending_count bigint; as_of timestamptz:=now();
begin
  select * into c from public.claims where id=p_claim_id;
  if not found or (select auth.uid()) is null or not private.is_claim_treasurer(c.id)
     or c.claimant_user_id=(select auth.uid()) then
    raise exception 'Independent Treasurer access required' using errcode='42501';
  end if;
  if c.status not in ('Pending','Under Review') then
    raise exception 'Experimental prediction requires a current submitted claim' using errcode='22023';
  end if;
  select * into a from public.activities where id=c.activity_id;
  if a.end_date<=as_of::date or a.start_date>as_of::date then
    raise exception 'No active future prediction horizon for this activity' using errcode='22023';
  end if;
  d:=private.department_finances(c.department_id);
  if (d->>'budget')::bigint<=0 then
    raise exception 'A positive department allocation is required' using errcode='22023';
  end if;
  select a.budget_sen-coalesce(sum((f->>'unclaimed')::bigint+(f->>'pending')::bigint+
      (f->>'liability')::bigint+(f->>'paid')::bigint),0) into a_available
    from public.departments dep cross join lateral
      (select private.department_finances(dep.id) f) q where dep.activity_id=a.id;
  select count(*) filter(where cl.status is null or cl.status='Rejected'),
    count(*) filter(where cl.status in ('Pending','Under Review')) into unclaimed_count,pending_count
    from public.purchase_tasks t left join public.claims cl on cl.purchase_task_id=t.id and cl.status<>'Draft'
    where t.department_id=c.department_id and t.status<>'Cancelled';
  return jsonb_build_object('schema','budget-pressure-v1','claimId',c.id,'revision',c.revision,
    'updatedAt',c.updated_at,'asOf',as_of,'horizonEnd',least(as_of+interval '30 days',a.end_date::timestamptz),
    'raw',jsonb_build_object('activity_budget_sen',a.budget_sen,'allocation_sen',(d->>'budget')::bigint,
      'available_sen',(d->>'available')::bigint,'activity_available_sen',a_available,
      'claim_sen',c.claimed_amount_sen,'estimate_sen',c.item_budget_sen_snapshot,
      'unclaimed_sen',(d->>'unclaimed')::bigint,'pending_sen',(d->>'pending')::bigint,
      'liability_sen',(d->>'liability')::bigint,'paid_sen',(d->>'paid')::bigint,
      'unclaimed_count',unclaimed_count,'pending_count',pending_count,
      'days_elapsed',as_of::date-a.start_date,'days_remaining',a.end_date-as_of::date));
end;
$$;
revoke all on function public.claim_pressure_snapshot(uuid) from public,anon;
grant execute on function public.claim_pressure_snapshot(uuid) to authenticated;
