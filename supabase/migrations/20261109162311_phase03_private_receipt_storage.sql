create or replace function private.can_read_claim(p_claim_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.claims c where c.id=p_claim_id and (
    (c.claimant_user_id=(select auth.uid()) and private.has_department_role(c.department_id,'Member'))
    or (c.status='Pending' and private.has_club_role(c.club_id,'Treasurer'))));
$$;

create function private.can_upload_receipt_path(p_name text,p_metadata jsonb)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.claim_receipts r join public.claims c on c.id=r.claim_id
    where r.storage_path=p_name and r.upload_status='uploading' and r.uploaded_by=(select auth.uid())
      and c.claimant_user_id=(select auth.uid()) and c.status='Draft'
      and private.has_department_role(c.department_id,'Member')
      and p_metadata->>'mimetype'=r.mime_type
      and (p_metadata->>'size') ~ '^[0-9]+$'
      and (p_metadata->>'size')::bigint=r.size_bytes and r.size_bytes<=1048576);
$$;
create function private.can_delete_draft_receipt(p_name text)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.claim_receipts r join public.claims c on c.id=r.claim_id
    where r.storage_path=p_name and r.upload_status='abandoned' and c.claimant_user_id=(select auth.uid())
      and c.status='Draft' and private.has_department_role(c.department_id,'Member'));
$$;
revoke all on function private.can_upload_receipt_path(text,jsonb),private.can_delete_draft_receipt(text) from public,anon;
grant execute on function private.can_upload_receipt_path(text,jsonb),private.can_delete_draft_receipt(text) to authenticated;

drop policy club_evidence_private_select on storage.objects;
drop policy club_evidence_private_insert on storage.objects;
drop policy club_evidence_private_delete on storage.objects;
create policy club_evidence_private_select on storage.objects as restrictive for select to public
  using (bucket_id not in ('receipts','payment-proofs','financial-archive') or
    (bucket_id='receipts' and exists (select 1 from public.claim_receipts r
      where r.storage_path=storage.objects.name and private.can_read_claim(r.claim_id))));
create policy club_evidence_private_insert on storage.objects as restrictive for insert to public
  with check (bucket_id not in ('receipts','payment-proofs','financial-archive') or
    (bucket_id='receipts' and private.can_upload_receipt_path(name,metadata)));
create policy club_evidence_private_delete on storage.objects as restrictive for delete to public
  using (bucket_id not in ('receipts','payment-proofs','financial-archive') or
    (bucket_id='receipts' and private.can_delete_draft_receipt(name)));
create policy receipts_member_read on storage.objects for select to authenticated
  using (bucket_id='receipts' and exists (select 1 from public.claim_receipts r
    where r.storage_path=storage.objects.name and private.can_read_claim(r.claim_id)));
create policy receipts_member_upload on storage.objects for insert to authenticated
  with check (bucket_id='receipts' and private.can_upload_receipt_path(name,metadata));
create policy receipts_draft_cleanup on storage.objects for delete to authenticated
  using (bucket_id='receipts' and private.can_delete_draft_receipt(name));

create function public.abandon_my_claim_receipt(p_receipt_id uuid)
returns text language plpgsql security definer set search_path = '' as $$
declare v_receipt public.claim_receipts%rowtype; v_claim public.claims%rowtype;
begin
  select * into v_receipt from public.claim_receipts where id=p_receipt_id for update;
  if not found or v_receipt.uploaded_by<>(select auth.uid()) then raise exception 'Receipt unavailable' using errcode='42501'; end if;
  select * into v_claim from public.claims where id=v_receipt.claim_id for update;
  if v_claim.status<>'Draft' or v_claim.claimant_user_id<>(select auth.uid()) or
     not private.has_department_role(v_claim.department_id,'Member') then raise exception 'Claim draft unavailable' using errcode='42501'; end if;
  update public.claim_receipts set upload_status='abandoned',is_current=false where id=p_receipt_id;
  update public.claims set revision=revision+1,
    updated_at=greatest(date_trunc('milliseconds',clock_timestamp()),updated_at+interval '1 millisecond') where id=v_claim.id;
  return v_receipt.storage_path;
end;
$$;
revoke all on function public.abandon_my_claim_receipt(uuid) from public,anon;
grant execute on function public.abandon_my_claim_receipt(uuid) to authenticated;
