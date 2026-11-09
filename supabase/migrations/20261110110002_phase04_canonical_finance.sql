create function private.department_finances(p_department uuid)
returns jsonb language sql stable security definer set search_path='' as $$
  with purchases as (
    select t.estimated_budget_sen estimate,c.status,c.claimed_amount_sen amount,c.approved_amount_sen approved
    from public.purchase_tasks t left join public.claims c on c.purchase_task_id=t.id and c.status<>'Draft'
    where t.department_id=p_department and t.status<>'Cancelled'
  ), totals as (
    select coalesce(sum(estimate) filter(where status is null or status in ('Pending','Under Review','Rejected')),0) planned,
      coalesce(sum(estimate) filter(where status is null or status='Rejected'),0) unclaimed,
      coalesce(sum(amount) filter(where status in ('Pending','Under Review')),0) pending,
      coalesce(sum(approved) filter(where status in ('Approved','Payment Pending')),0) liability,
      coalesce(sum(approved) filter(where status in ('Paid','Received')),0) paid from purchases
  ) select jsonb_build_object('departmentId',d.id,'activityId',d.activity_id,'budget',d.allocation_sen,
      'planned',planned,'unclaimed',unclaimed,'pending',pending,'liability',liability,'paid',paid,
      'available',d.allocation_sen-unclaimed-pending-liability-paid,
      'remaining',d.allocation_sen-liability-paid)
    from public.departments d cross join totals where d.id=p_department;
$$;
revoke all on function private.department_finances(uuid) from public,anon,authenticated;
create function public.financial_summaries()
returns jsonb language sql stable security definer set search_path='' as $$
  select coalesce(jsonb_agg(private.department_finances(d.id)),'[]'::jsonb)
    from public.departments d where private.can_read_department(d.id);
$$;
revoke all on function public.financial_summaries() from public,anon;
grant execute on function public.financial_summaries() to authenticated;

create function private.claim_risk(p_claim uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare c public.claims%rowtype; d jsonb; a_available bigint; other_pending bigint; variance bigint; pct numeric;
  band text; factors jsonb;
begin
  select * into c from public.claims where id=p_claim;
  d:=private.department_finances(c.department_id);
  select a.budget_sen-coalesce(sum((f->>'unclaimed')::bigint+(f->>'pending')::bigint+(f->>'liability')::bigint+(f->>'paid')::bigint),0),
    coalesce(sum((f->>'pending')::bigint),0) into a_available,other_pending
    from public.activities a left join public.departments dep on dep.activity_id=a.id
    left join lateral (select private.department_finances(dep.id) f) q on true where a.id=c.activity_id group by a.id;
  variance:=c.claimed_amount_sen-c.item_budget_sen_snapshot;
  pct:=round(variance::numeric*100/c.item_budget_sen_snapshot,2);
  band:=case when (d->>'available')::bigint<0 or a_available<0 or pct>=25 then 'High' when pct>=10 then 'Medium' else 'Low' end;
  factors:=jsonb_build_array(jsonb_build_object('label','Task variance','detail',variance||' sen / '||pct||'% versus original estimate','level',band),
    jsonb_build_object('label','Budget impact','detail','Department remaining after effective exposure: '||(d->>'available')||' sen; activity: '||a_available||' sen',
      'level',case when (d->>'available')::bigint<0 or a_available<0 then 'High' else 'Low' end));
  return jsonb_build_object('id',c.id,'at',now(),'actor',(select auth.uid()),'band',band,'factors',factors,
    'rules',jsonb_build_object('mediumVariance',10,'highVariance',25,'lowHeadroomPercent',20),
    'variance',variance,'variancePercent',pct,'departmentAvailable',(d->>'available')::bigint,
    'activityAvailable',a_available,'pendingOther',greatest(0,other_pending-c.claimed_amount_sen));
end;
$$;
revoke all on function private.claim_risk(uuid) from public,anon,authenticated;
create function public.assess_claim_risk(p_claim_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare c public.claims%rowtype; r jsonb;
begin
  select * into c from public.claims where id=p_claim_id for update;
  if not found or not private.is_claim_treasurer(c.id) or c.claimant_user_id=(select auth.uid()) then
    raise exception 'Independent Treasurer access required' using errcode='42501'; end if;
  r:=private.claim_risk(c.id);
  if c.status in ('Pending','Under Review') then update public.claims set risk_assessment=r where id=c.id; end if;
  return coalesce(c.decision_risk,r);
end;
$$;
revoke all on function public.assess_claim_risk(uuid) from public,anon;
grant execute on function public.assess_claim_risk(uuid) to authenticated;
