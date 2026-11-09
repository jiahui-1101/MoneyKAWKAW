create or replace function public.finalize_claim_receipt(p_receipt_id uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_receipt public.claim_receipts%rowtype; v_claim public.claims%rowtype; v_size bigint; v_mime text;
begin
  select * into v_receipt from public.claim_receipts where id=p_receipt_id for update;
  if not found or v_receipt.uploaded_by <> (select auth.uid()) or v_receipt.upload_status <> 'uploading' then
    raise exception 'Receipt upload unavailable' using errcode='42501';
  end if;
  select * into v_claim from public.claims where id=v_receipt.claim_id for update;
  if v_claim.status <> 'Draft' or v_claim.claimant_user_id <> (select auth.uid()) or
     not private.has_department_role(v_claim.department_id,'Member') then
    raise exception 'Claim draft unavailable' using errcode='42501';
  end if;
  select (o.metadata->>'size')::bigint,o.metadata->>'mimetype' into v_size,v_mime
    from storage.objects o where o.bucket_id='receipts' and o.name=v_receipt.storage_path
      and o.owner_id=(select auth.uid())::text;
  if not found or v_size is distinct from v_receipt.size_bytes or v_mime is distinct from v_receipt.mime_type then
    raise exception 'Uploaded receipt could not be verified; retry the upload' using errcode='23514';
  end if;
  update public.claim_receipts set is_current=false,upload_status='abandoned'
    where claim_id=v_claim.id and id<>p_receipt_id and (is_current or upload_status='uploading');
  update public.claim_receipts set is_current=true,upload_status='ready',uploaded_at=now() where id=p_receipt_id;
  update public.claims set revision=revision+1,
    updated_at=greatest(date_trunc('milliseconds',clock_timestamp()),updated_at+interval '1 millisecond')
    where id=v_claim.id;
  return v_claim.id;
end;
$$;
revoke all on function public.finalize_claim_receipt(uuid) from public,anon;
grant execute on function public.finalize_claim_receipt(uuid) to authenticated;
