create function private.guard_resolved_purchase()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  if tg_table_name='claims' then
    if exists(select 1 from public.purchase_tasks where id=new.purchase_task_id and closing_resolution is not null) then
      raise exception 'This purchase was resolved without a reimbursement' using errcode='23514';
    end if;
    return new;
  end if;
  if old.closing_resolution is not null then
    raise exception 'The recorded purchase resolution is immutable' using errcode='23514';
  end if;
  if tg_op='DELETE' then return old; end if;
  return new;
end;
$$;
revoke all on function private.guard_resolved_purchase() from public,anon,authenticated;
create trigger phase08_resolved_purchase before update or delete on public.purchase_tasks
  for each row execute function private.guard_resolved_purchase();
create trigger phase08_no_resolved_claim before insert on public.claims
  for each row execute function private.guard_resolved_purchase();

create or replace function private.can_delete_draft_receipt(p_name text)
returns boolean language sql stable security definer set search_path='' as $$
  select exists (select 1 from public.claim_receipts r join public.claims c on c.id=r.claim_id
    where r.storage_path=p_name and r.upload_status='abandoned' and r.uploaded_at is null
      and c.claimant_user_id=auth.uid() and c.status='Draft'
      and private.has_department_role(c.department_id,'Member'));
$$;

create or replace function private.can_delete_proof(p_name text)
returns boolean language sql stable security definer set search_path='' as $$
  select exists(select 1 from public.payment_proofs p join public.claims c on c.id=p.claim_id
    where p.storage_path=p_name and p.upload_status='abandoned' and p.finalized_at is null
      and p.uploaded_by=auth.uid() and c.status='Payment Pending' and private.is_claim_treasurer(c.id));
$$;

create or replace function private.activity_evidence_manifest(p_activity uuid)
returns table(kind text,record_id uuid,claim_id uuid,bucket text,path text,bytes bigint,mime text,sha256 text,finalized_at timestamptz)
language sql stable security definer set search_path='' as $$
  select 'receipt',r.id,r.claim_id,'receipts',r.storage_path,r.size_bytes,r.mime_type,r.sha256,r.uploaded_at
    from public.claim_receipts r join public.claims c on c.id=r.claim_id
    where c.activity_id=p_activity and (r.uploaded_at is not null or r.upload_status='ready')
  union all
  select 'payment proof',p.id,p.claim_id,'payment-proofs',p.storage_path,p.size_bytes,p.mime_type,p.sha256,p.finalized_at
    from public.payment_proofs p join public.claims c on c.id=p.claim_id
    where c.activity_id=p_activity and (p.finalized_at is not null or p.upload_status='retained');
$$;
