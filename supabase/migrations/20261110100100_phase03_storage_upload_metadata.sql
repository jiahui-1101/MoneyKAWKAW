create or replace function private.can_upload_receipt_path(p_name text,p_metadata jsonb)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.claim_receipts r join public.claims c on c.id=r.claim_id
    where r.storage_path=p_name and r.upload_status='uploading' and r.uploaded_by=(select auth.uid())
      and c.claimant_user_id=(select auth.uid()) and c.status='Draft'
      and private.has_department_role(c.department_id,'Member')
      and r.size_bytes between 8 and 1048576 and r.mime_type in ('image/png','image/jpeg'));
$$;
update storage.buckets set file_size_limit=1048576 where id='receipts';
