create or replace function private.activity_financial_exceptions(p_activity uuid)
returns jsonb language sql stable security definer set search_path='' as $$
  with scoped_claims as (select * from public.claims where activity_id=p_activity),
  lines as (
    select i.claim_id,sum(case when i.line_kind='discount' then -i.corrected_line_total_sen else i.corrected_line_total_sen end)
      filter(where i.included) as included,
      sum(case when i.line_kind='discount' then -i.corrected_line_total_sen else i.corrected_line_total_sen end) as gross
    from public.claim_items i join scoped_claims c on c.id=i.claim_id group by i.claim_id
  )
  select jsonb_build_object(
    'inconsistentPayments', (select count(*) from scoped_claims c
      left join public.reimbursement_payments p on p.claim_id=c.id
      left join public.payment_proofs proof on proof.id=p.proof_id and proof.claim_id=c.id
      where (c.status in ('Paid','Received') and (
        p.id is null or p.amount_sen is distinct from c.approved_amount_sen
        or c.approved_amount_sen is distinct from c.claimed_amount_sen
        or not exists(select 1 from public.claim_payment_destinations d where d.claim_id=c.id)
        or proof.upload_status is distinct from 'retained' or proof.finalized_at is null
        or (c.status='Received' and (p.received_at is null or p.received_by is distinct from c.claimant_user_id))
      )) or (p.id is not null and c.status not in ('Paid','Received'))),
    'claimTotalsOrReceipt', (select count(*) from scoped_claims c left join lines l on l.claim_id=c.id
      left join public.claim_receipts r on r.claim_id=c.id and r.is_current and r.upload_status='ready'
      where c.status<>'Draft' and (
        c.claimed_amount_sen is null or c.claimed_amount_sen<=0
        or l.included is distinct from c.claimed_amount_sen or r.id is null
        or r.extraction is null or l.gross is distinct from r.reviewed_total_sen
      )),
    'missingAudit', (select count(*) from scoped_claims c where c.status in ('Received','Rejected') and (
      c.reviewer_uid is null or c.decided_at is null
      or not exists (select 1 from public.claim_status_history h
        where h.claim_id=c.id and h.to_status=c.status)
      or not exists (select 1 from public.audit_events e
        where e.activity_id=c.activity_id and e.record_id=c.id and e.action='Claim '||c.status::text)
    )),
    'missingEvidence', (select count(*) from private.activity_evidence_manifest(p_activity) e
      left join storage.objects o on o.bucket_id=e.bucket and o.name=e.path
      where o.id is null or e.sha256 is null or e.finalized_at is null
        or (o.metadata->>'size') is distinct from e.bytes::text
        or (o.metadata->>'mimetype') is distinct from e.mime)
  );
$$;
