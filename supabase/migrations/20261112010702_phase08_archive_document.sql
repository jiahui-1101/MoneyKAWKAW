create function private.activity_archive_document(p_archive uuid)
returns text language sql stable security definer set search_path='' set timezone='UTC' set datestyle='ISO, YMD' as $$
  with archive as (select * from public.archive_records where id=p_archive),
  claims as (select c.* from public.claims c join archive a on a.activity_id=c.activity_id),
  records as (
    select 'departments' as name,d.id::text as ordering,to_jsonb(d) as row
      from public.departments d join archive a on a.activity_id=d.activity_id
    union all select 'tasks',t.id::text,to_jsonb(t)-'request_key'
      from public.purchase_tasks t join archive a on a.activity_id=t.activity_id
    union all select 'activityMemberships',m.user_id::text,to_jsonb(m)
      from public.activity_memberships m join archive a on a.activity_id=m.activity_id
    union all select 'departmentMemberships',m.department_id::text||m.user_id::text,to_jsonb(m)
      from public.department_memberships m join archive a on a.activity_id=m.activity_id
    union all select 'activityRoles',g.user_id::text||g.role::text,to_jsonb(g)
      from public.activity_role_grants g join archive a on a.activity_id=g.activity_id
    union all select 'claims',c.id::text,to_jsonb(c)-array['idempotency_key','draft_payment_account_id']
      from claims c
    union all select 'items',i.id::text,to_jsonb(i)
      from public.claim_items i join claims c on c.id=i.claim_id
    union all select 'receipts',r.id::text,to_jsonb(r)
      from public.claim_receipts r join claims c on c.id=r.claim_id
    union all select 'receiptModifications',m.id::text,to_jsonb(m)
      from public.receipt_modifications m join claims c on c.id=m.claim_id
    union all select 'claimHistory',h.id::text,to_jsonb(h)
      from public.claim_status_history h join claims c on c.id=h.claim_id
    union all select 'payments',p.id::text,to_jsonb(p)-'request_key'
      from public.reimbursement_payments p join claims c on c.id=p.claim_id
    union all select 'proofs',p.id::text,to_jsonb(p)
      from public.payment_proofs p join claims c on c.id=p.claim_id
    union all select 'notifications',n.id::text,to_jsonb(n)-'read_at'
      from public.financial_notifications n join claims c on c.id=n.claim_id
    union all select 'advisories',r.id::text,to_jsonb(r)
      from public.claim_pressure_advice r join claims c on c.id=r.claim_id
    union all select 'paymentMethods',d.claim_id::text,jsonb_build_object(
      'claim_id',d.claim_id,'kind',d.kind,'masked',d.masked,'selected_at',d.selected_at)
      from public.claim_payment_destinations d join claims c on c.id=d.claim_id
    union all select 'audit',e.id::text,to_jsonb(e)
      from public.audit_events e join archive a on a.activity_id=e.activity_id
    union all select 'evidence',e.record_id::text,to_jsonb(e)||jsonb_build_object('retention','Retained original')
      from archive a cross join lateral private.activity_evidence_manifest(a.activity_id) e
  ), groups as (
    select name,jsonb_agg(row order by ordering) as rows from records group by name
  )
  select jsonb_build_object('schema','moneykawkaw-financial-archive','version',1,
    'archiveId',a.id,'capturedAt',a.created_at,'revision',a.source_revision,
    'activity',to_jsonb(activity)-array['updated_at','archived_by','archived_at','retain_until','legal_hold','closing_revision'],
    'reconciliation',to_jsonb(r)-'request_key','approval',to_jsonb(d)-'request_key',
    'records',coalesce((select jsonb_object_agg(name,rows) from groups),'{}'))::text
  from archive a join public.activities activity on activity.id=a.activity_id
    join public.activity_reconciliations r on r.id=a.reconciliation_id
    join public.activity_closing_decisions d on d.id=a.approval_id;
$$;
revoke all on function private.activity_archive_document(uuid) from public,anon,authenticated;
