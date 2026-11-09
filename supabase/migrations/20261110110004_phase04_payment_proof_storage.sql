create function private.can_stage_proof(p_name text)
returns boolean language sql stable security definer set search_path='' as $$
  select exists(select 1 from public.payment_proofs p join public.claims c on c.id=p.claim_id
    where p.storage_path=p_name and p.upload_status='uploading' and p.uploaded_by=(select auth.uid())
      and c.status='Payment Pending' and c.claimant_user_id<>(select auth.uid()) and private.is_claim_treasurer(c.id));
$$;
create function private.can_read_proof(p_name text)
returns boolean language sql stable security definer set search_path='' as $$
  select exists(select 1 from public.payment_proofs p join public.claims c on c.id=p.claim_id
    where p.storage_path=p_name and ((p.upload_status='retained' and private.can_read_claim(c.id)) or
      (c.status='Payment Pending' and p.uploaded_by=(select auth.uid()) and private.is_claim_treasurer(c.id))));
$$;
create function private.can_delete_proof(p_name text)
returns boolean language sql stable security definer set search_path='' as $$
  select exists(select 1 from public.payment_proofs p join public.claims c on c.id=p.claim_id
    where p.storage_path=p_name and p.upload_status='abandoned' and p.uploaded_by=(select auth.uid())
      and c.status='Payment Pending' and private.is_claim_treasurer(c.id));
$$;
revoke all on function private.can_stage_proof(text),private.can_read_proof(text),private.can_delete_proof(text) from public,anon;
grant execute on function private.can_stage_proof(text),private.can_read_proof(text),private.can_delete_proof(text) to authenticated;
drop policy club_evidence_private_insert on storage.objects;
drop policy club_evidence_private_select on storage.objects;
drop policy club_evidence_private_delete on storage.objects;
create policy club_evidence_private_insert on storage.objects as restrictive for insert to public with check (
  bucket_id not in ('receipts','payment-proofs','financial-archive') or
  (bucket_id='receipts' and private.can_upload_receipt_path(name,metadata)) or
  (bucket_id='payment-proofs' and private.can_stage_proof(name)));
create policy club_evidence_private_select on storage.objects as restrictive for select to public using (
  bucket_id not in ('receipts','payment-proofs','financial-archive') or
  (bucket_id='receipts' and exists(select 1 from public.claim_receipts r where r.storage_path=name and private.can_read_claim(r.claim_id))) or
  (bucket_id='payment-proofs' and private.can_read_proof(name)));
create policy club_evidence_private_delete on storage.objects as restrictive for delete to public using (
  bucket_id not in ('receipts','payment-proofs','financial-archive') or
  (bucket_id='receipts' and private.can_delete_draft_receipt(name)) or
  (bucket_id='payment-proofs' and private.can_delete_proof(name)));
create policy proofs_private_insert on storage.objects for insert to authenticated with check(bucket_id='payment-proofs' and private.can_stage_proof(name));
create policy proofs_private_select on storage.objects for select to authenticated using(bucket_id='payment-proofs' and private.can_read_proof(name));
create policy proofs_private_delete on storage.objects for delete to authenticated using(bucket_id='payment-proofs' and private.can_delete_proof(name));
update storage.buckets set file_size_limit=1048576,allowed_mime_types=array['image/png','image/jpeg'] where id='payment-proofs';

create function public.prepare_payment_proof(p_claim_id uuid,p_filename text,p_mime text,p_size bigint,p_sha256 text)
returns public.payment_proofs language plpgsql security definer set search_path='' as $$
declare c public.claims%rowtype; p public.payment_proofs%rowtype; v_id uuid;
begin
  select * into c from public.claims where id=p_claim_id for update;
  if not found or c.status<>'Payment Pending' or not private.is_claim_treasurer(c.id) or c.claimant_user_id=(select auth.uid()) then
    raise exception 'Independent Treasurer payment access required' using errcode='42501'; end if;
  if p_filename is null or length(trim(p_filename)) not between 1 and 180 or p_mime is null or p_mime not in ('image/png','image/jpeg') or
    p_size is null or p_size not between 8 and 1048576 or p_sha256 is null or p_sha256 !~ '^[a-f0-9]{64}$' then
    raise exception 'Choose a PNG or JPEG proof up to 1 MiB' using errcode='22023'; end if;
  select * into p from public.payment_proofs where claim_id=c.id and uploaded_by=(select auth.uid())
    and upload_status in ('uploading','ready') and sha256=p_sha256 and size_bytes=p_size and mime_type=p_mime limit 1;
  if found then return p; end if;
  v_id:=gen_random_uuid();
  insert into public.payment_proofs(id,claim_id,uploaded_by,storage_path,filename,mime_type,size_bytes,sha256)
    values(v_id,c.id,(select auth.uid()),c.id::text||'/'||v_id::text||case when p_mime='image/png' then '.png' else '.jpg' end,
      trim(p_filename),p_mime,p_size,p_sha256) returning * into p;
  return p;
end;
$$;
create function public.finalize_payment_proof(p_proof_id uuid)
returns uuid language plpgsql security definer set search_path='' as $$
declare p public.payment_proofs%rowtype; c public.claims%rowtype;
begin
  select * into p from public.payment_proofs where id=p_proof_id;
  select * into c from public.claims where id=p.claim_id for update;
  if not found or c.status<>'Payment Pending' or c.claimant_user_id=(select auth.uid()) or
    p.uploaded_by<>(select auth.uid()) or not private.is_claim_treasurer(c.id) or p.upload_status not in ('uploading','ready') then
    raise exception 'Payment proof unavailable' using errcode='42501'; end if;
  if not exists(select 1 from storage.objects o where o.bucket_id='payment-proofs' and o.name=p.storage_path
    and o.owner_id=(select auth.uid())::text and (o.metadata->>'size')::bigint=p.size_bytes and o.metadata->>'mimetype'=p.mime_type) then
    raise exception 'Stored payment proof could not be verified' using errcode='23514'; end if;
  update public.payment_proofs set upload_status='abandoned' where claim_id=c.id and uploaded_by=(select auth.uid())
    and id<>p.id and upload_status in ('uploading','ready');
  update public.payment_proofs set upload_status='ready',finalized_at=now() where id=p.id;
  return p.id;
end;
$$;
revoke all on function public.prepare_payment_proof(uuid,text,text,bigint,text),public.finalize_payment_proof(uuid) from public,anon;
grant execute on function public.prepare_payment_proof(uuid,text,text,bigint,text),public.finalize_payment_proof(uuid) to authenticated;
