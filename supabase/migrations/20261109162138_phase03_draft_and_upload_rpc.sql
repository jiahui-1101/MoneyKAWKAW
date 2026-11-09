drop index public.claim_receipts_single_active_idx;
alter table public.claim_receipts add column is_current boolean not null default false;
alter table public.claim_receipts add column reviewed_total_sen bigint;
create unique index claim_receipts_current_idx on public.claim_receipts(claim_id) where is_current;

create function public.begin_my_claim(p_task_id uuid, p_request_key uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_task public.purchase_tasks%rowtype; v_claim public.claims%rowtype;
begin
  if (select auth.uid()) is null then raise exception 'Sign in to prepare a claim' using errcode = '42501'; end if;
  select * into v_task from public.purchase_tasks where id = p_task_id for update;
  if not found or v_task.assigned_member_id <> (select auth.uid()) or
     not private.has_department_role(v_task.department_id, 'Member') then
    raise exception 'Purchasing task unavailable for your Member profile' using errcode = '42501';
  end if;
  if v_task.status not in ('Purchased','Completed') then
    raise exception 'Mark the purchase as Purchased before starting a claim' using errcode = '23514';
  end if;
  select * into v_claim from public.claims where purchase_task_id = p_task_id for update;
  if found then
    if v_claim.status = 'Draft' then return v_claim.id; end if;
    raise exception 'An active claim has already been submitted for this task' using errcode = '23505';
  end if;
  insert into public.claims (club_id,activity_id,department_id,purchase_task_id,claimant_user_id,
    item_budget_sen_snapshot,idempotency_key)
  values (v_task.club_id,v_task.activity_id,v_task.department_id,v_task.id,(select auth.uid()),
    v_task.estimated_budget_sen,p_request_key) returning * into v_claim;
  insert into public.claim_status_history (claim_id,to_status,actor_uid)
    values (v_claim.id,'Draft',(select auth.uid()));
  insert into public.audit_events (club_id,actor_uid,action,record_type,record_id,activity_id,department_id,changes)
    values (v_task.club_id,(select auth.uid()),'Claim draft started','claim',v_claim.id,
      v_task.activity_id,v_task.department_id,jsonb_build_object('task_id',v_task.id,'status','Draft'));
  return v_claim.id;
end;
$$;

create function public.prepare_claim_receipt(p_claim_id uuid,p_expected_updated_at timestamptz,
  p_filename text,p_mime text,p_size bigint,p_sha256 text)
returns table(receipt_id uuid,storage_path text,draft_updated_at timestamptz)
language plpgsql security definer set search_path = '' as $$
declare v_claim public.claims%rowtype; v_receipt public.claim_receipts%rowtype; v_id uuid; v_ext text;
begin
  select * into v_claim from public.claims where id=p_claim_id for update;
  if not found or v_claim.claimant_user_id <> (select auth.uid()) or v_claim.status <> 'Draft' or
     not private.has_department_role(v_claim.department_id,'Member') then
    raise exception 'Claim draft unavailable for your Member profile' using errcode='42501';
  end if;
  if v_claim.updated_at <> p_expected_updated_at then raise exception 'Draft changed. Reload before uploading.' using errcode='40001'; end if;
  if length(trim(p_filename)) not between 1 and 180 or p_mime not in ('image/png','image/jpeg') or
     p_size not between 8 and 1048576 or p_sha256 !~ '^[0-9a-f]{64}$' then
    raise exception 'Choose a PNG or JPEG receipt image up to 1 MB' using errcode='22023';
  end if;
  select * into v_receipt from public.claim_receipts r where r.claim_id=p_claim_id
    and r.upload_status='uploading' and r.original_filename=p_filename and r.mime_type=p_mime
    and r.size_bytes=p_size and r.sha256=p_sha256 order by r.created_at desc limit 1;
  if found then return query select v_receipt.id,v_receipt.storage_path,v_claim.updated_at; return; end if;
  v_id := gen_random_uuid(); v_ext := case when p_mime='image/png' then 'png' else 'jpg' end;
  insert into public.claim_receipts (id,claim_id,storage_path,original_filename,mime_type,size_bytes,sha256,uploaded_by)
    values (v_id,p_claim_id,p_claim_id::text||'/'||v_id::text||'.'||v_ext,p_filename,p_mime,p_size,p_sha256,(select auth.uid()));
  update public.claims set revision=revision+1,
    updated_at=greatest(date_trunc('milliseconds',clock_timestamp()),updated_at+interval '1 millisecond')
    where id=p_claim_id returning * into v_claim;
  return query select v_id,p_claim_id::text||'/'||v_id::text||'.'||v_ext,v_claim.updated_at;
end;
$$;

create function public.finalize_claim_receipt(p_receipt_id uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_receipt public.claim_receipts%rowtype; v_claim public.claims%rowtype; v_size bigint; v_mime text;
begin
  select * into v_receipt from public.claim_receipts where id=p_receipt_id for update;
  if not found or v_receipt.uploaded_by <> (select auth.uid()) or v_receipt.upload_status <> 'uploading' then raise exception 'Receipt upload unavailable' using errcode='42501'; end if;
  select * into v_claim from public.claims where id=v_receipt.claim_id for update;
  if v_claim.status <> 'Draft' or not private.has_department_role(v_claim.department_id,'Member') then raise exception 'Claim draft unavailable' using errcode='42501'; end if;
  select (o.metadata->>'size')::bigint,o.metadata->>'mimetype' into v_size,v_mime
    from storage.objects o where o.bucket_id='receipts' and o.name=v_receipt.storage_path and o.owner_id=(select auth.uid());
  if not found or v_size is distinct from v_receipt.size_bytes or v_mime is distinct from v_receipt.mime_type then
    raise exception 'Uploaded receipt could not be verified; retry the upload' using errcode='23514';
  end if;
  update public.claim_receipts set is_current=false,upload_status='abandoned'
    where claim_id=v_claim.id and is_current;
  update public.claim_receipts set is_current=true,upload_status='ready',uploaded_at=now()
    where id=p_receipt_id;
  update public.claims set revision=revision+1,
    updated_at=greatest(date_trunc('milliseconds',clock_timestamp()),updated_at+interval '1 millisecond') where id=v_claim.id;
  return v_claim.id;
end;
$$;

revoke all on function public.begin_my_claim(uuid,uuid),
  public.prepare_claim_receipt(uuid,timestamptz,text,text,bigint,text),
  public.finalize_claim_receipt(uuid) from public,anon;
grant execute on function public.begin_my_claim(uuid,uuid),
  public.prepare_claim_receipt(uuid,timestamptz,text,text,bigint,text),
  public.finalize_claim_receipt(uuid) to authenticated;
