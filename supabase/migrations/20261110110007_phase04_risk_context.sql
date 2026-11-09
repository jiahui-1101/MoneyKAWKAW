create or replace function private.claim_risk(p_claim uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare c public.claims%rowtype; d jsonb; a_available bigint; a_budget bigint; other_pending bigint;
  variance bigint; pct numeric; band text; variance_band text; budget_band text; headroom_band text; factors jsonb;
begin
  select * into c from public.claims where id=p_claim;
  d:=private.department_finances(c.department_id);
  select a.budget_sen,a.budget_sen-coalesce(sum((f->>'unclaimed')::bigint+(f->>'pending')::bigint+(f->>'liability')::bigint+(f->>'paid')::bigint),0),
    coalesce(sum((f->>'pending')::bigint),0) into a_budget,a_available,other_pending
    from public.activities a left join public.departments dep on dep.activity_id=a.id
    left join lateral (select private.department_finances(dep.id) f) q on true where a.id=c.activity_id group by a.id;
  variance:=c.claimed_amount_sen-c.item_budget_sen_snapshot;
  pct:=round(variance::numeric*100/c.item_budget_sen_snapshot,2);
  variance_band:=case when pct>=25 then 'High' when pct>=10 then 'Medium' else 'Low' end;
  budget_band:=case when (d->>'available')::bigint<0 or a_available<0 then 'High' else 'Low' end;
  headroom_band:=case when (d->>'available')::numeric*100 < (d->>'budget')::numeric*20 or a_available::numeric*100 < a_budget::numeric*20 then 'Medium' else 'Low' end;
  band:=case when variance_band='High' or budget_band='High' then 'High' when variance_band='Medium' or headroom_band='Medium' then 'Medium' else 'Low' end;
  factors:=jsonb_build_array(
    jsonb_build_object('label','Task variance','detail',variance||' sen / '||pct||'% versus original estimate; Medium from 10%, High from 25%.','level',variance_band),
    jsonb_build_object('label','Budget impact if approved','detail','Department remaining after effective exposure: '||(d->>'available')||' sen; activity: '||a_available||' sen. Negative headroom blocks approval.','level',budget_band),
    jsonb_build_object('label','Budget headroom','detail','Less than 20% remaining in either budget is Medium risk. Pending requests replace their task estimate in effective exposure.','level',headroom_band),
    jsonb_build_object('label','Existing obligations','detail','Unclaimed plans: '||(d->>'unclaimed')||'; Pending: '||(d->>'pending')||'; Approved unpaid: '||(d->>'liability')||'; Paid: '||(d->>'paid')||' sen.','level','Low'));
  return jsonb_build_object('id',c.id,'at',now(),'actor',(select auth.uid()),'band',band,'factors',factors,
    'rules',jsonb_build_object('mediumVariance',10,'highVariance',25,'lowHeadroomPercent',20),
    'variance',variance,'variancePercent',pct,'departmentAvailable',(d->>'available')::bigint,
    'activityAvailable',a_available,'pendingOther',greatest(0,other_pending-case when c.status in ('Pending','Under Review') then c.claimed_amount_sen else 0 end),
    'inputs',jsonb_build_object('department',d,'activityBudget',a_budget,'taskEstimate',c.item_budget_sen_snapshot,'claimed',c.claimed_amount_sen));
end;
$$;
revoke all on function private.claim_risk(uuid) from public,anon,authenticated;
