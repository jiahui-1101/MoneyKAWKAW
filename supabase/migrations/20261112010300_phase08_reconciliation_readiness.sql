create function private.activity_closing_facts(p_activity uuid)
returns jsonb language sql stable security definer set search_path='' as $$
  with departments as (
    select d.id,private.department_finances(d.id)||jsonb_build_object('name',d.name) as facts
    from public.departments d where d.activity_id=p_activity
  ), balances as (
    select coalesce(jsonb_agg(facts order by id),'[]') as items,
      coalesce(sum((facts->>'budget')::bigint),0) as allocated,
      coalesce(sum((facts->>'paid')::bigint),0) as paid,
      coalesce(sum((facts->>'pending')::bigint),0) as pending,
      coalesce(sum((facts->>'liability')::bigint),0) as liability,
      coalesce(sum((facts->>'unclaimed')::bigint),0) as reserved,
      coalesce(sum((facts->>'planned')::bigint),0) as planned,
      coalesce(bool_or((facts->>'available')::bigint<0),false) as department_deficit
    from departments
  ), claims as (select * from public.claims where activity_id=p_activity),
  payments as (
    select p.* from public.reimbursement_payments p join claims c on c.id=p.claim_id
  ), totals as (
    select count(*) as count,coalesce(sum(amount_sen),0) as paid,
      count(*) filter(where received_at is not null) as confirmed,
      count(*) filter(where discrepancy_at is not null and resolved_at is null) as discrepancies
    from payments
  ), tasks as (select * from public.purchase_tasks where activity_id=p_activity),
  audits as (select id,created_at from public.audit_events where activity_id=p_activity)
  select jsonb_build_object(
    'schema',1,'activityId',a.id,'currency',a.currency,'budget',a.budget_sen,
    'allocated',b.allocated,'paid',b.paid,'unspentAllocated',b.allocated-b.paid,
    'unallocated',a.budget_sen-b.allocated,'planned',b.planned,'reserved',b.reserved,
    'pending',b.pending,'liability',b.liability,'available',a.budget_sen-b.paid-b.pending-b.liability-b.reserved,
    'departments',b.items,'payments',p.count,'paymentTotal',p.paid,'confirmed',p.confirmed,
    'taskCount',(select count(*) from tasks),
    'estimated',(select coalesce(sum(estimated_budget_sen),0) from tasks where status<>'Cancelled'),
    'claimStates',(select coalesce(jsonb_object_agg(status,amount),'{}')
      from (select status,count(*) amount from claims group by status) counts),
    'evidenceCount',(select count(*) from private.activity_evidence_manifest(a.id)),
    'audit',jsonb_build_object('count',(select count(*) from audits),
      'first',(select id from audits order by created_at,id limit 1),
      'last',(select id from audits order by created_at desc,id desc limit 1)),
    'blockers',private.activity_financial_exceptions(a.id)||jsonb_build_object(
      'unresolvedTasks',(select count(*) from tasks t where t.status<>'Cancelled' and t.closing_resolution is null
        and not exists(select 1 from claims c where c.purchase_task_id=t.id and c.status='Received')),
      'draftClaims',(select count(*) from claims where status='Draft'),
      'pendingClaims',(select count(*) from claims where status='Pending'),
      'underReview',(select count(*) from claims where status='Under Review'),
      'approvedUnpaid',(select count(*) from claims where status='Approved'),
      'paymentPending',(select count(*) from claims where status='Payment Pending'),
      'unconfirmedPaid',(select count(*) from claims where status='Paid'),
      'openDiscrepancies',p.discrepancies,
      'stagedReceipts',(select count(*) from public.claim_receipts r join claims c on c.id=r.claim_id
        where r.upload_status='uploading'),
      'stagedProofs',(select count(*) from public.payment_proofs r join claims c on c.id=r.claim_id
        where r.upload_status='uploading'),
      'budgetInconsistency',case when b.allocated>a.budget_sen or b.paid<>p.paid
        or b.department_deficit or a.budget_sen<b.paid+b.pending+b.liability+b.reserved
        or (b.reserved<>0 and not exists(select 1 from tasks t where t.status<>'Cancelled' and t.closing_resolution is null
          and not exists(select 1 from claims c where c.purchase_task_id=t.id and c.status='Received')))
        then 1 else 0 end
    ))
  from public.activities a cross join balances b cross join totals p where a.id=p_activity;
$$;
revoke all on function private.activity_closing_facts(uuid) from public,anon,authenticated;

create function public.activity_closing_readiness(p_activity uuid,p_role text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare activity public.activities; facts jsonb;
begin
  if p_role is null or p_role not in ('Director','Treasurer') then
    raise exception 'Authorized activity role required' using errcode='42501';
  end if;
  select * into activity from private.lock_closing_activity(p_activity,p_role);
  facts:=private.activity_closing_facts(activity.id);
  perform private.append_business_audit(activity.club_id,'Closing readiness evaluated','activity',
    activity.id,activity.id,null,jsonb_build_object('revision',activity.closing_revision,'blockers',facts->'blockers'));
  return facts||jsonb_build_object('state',activity.financial_state,'revision',activity.closing_revision);
end;
$$;
revoke all on function public.activity_closing_readiness(uuid,text) from public,anon;
grant execute on function public.activity_closing_readiness(uuid,text) to authenticated;
