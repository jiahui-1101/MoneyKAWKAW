create or replace function public.submit_my_claim(p_claim_id uuid,p_expected_updated_at timestamptz,
  p_task_updated_at timestamptz,p_account_updated_at timestamptz,p_submission_key uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_claim public.claims%rowtype; v_task public.purchase_tasks%rowtype; v_receipt public.claim_receipts%rowtype;
  v_account public.payment_accounts%rowtype; v_gross numeric; v_amount numeric; v_line_count integer;
  v_dep_available numeric; v_act_available numeric; v_needs_reason boolean; v_at timestamptz;
  v_size bigint; v_mime text; v_actor uuid:=(select auth.uid());
begin
  if v_actor is null or p_submission_key is null then raise exception 'Sign in to submit this claim' using errcode='42501'; end if;
  select * into v_claim from public.claims where id=p_claim_id for update;
  if not found or v_claim.claimant_user_id<>v_actor or not private.has_department_role(v_claim.department_id,'Member') then raise exception 'Claim unavailable for your Member profile' using errcode='42501'; end if;
  if v_claim.status='Pending' then
    if v_claim.submission_key=p_submission_key then return v_claim.id; end if;
    raise exception 'This claim has already been submitted' using errcode='23505';
  end if;
  if v_claim.status<>'Draft' or v_claim.updated_at is distinct from p_expected_updated_at then raise exception 'Draft changed. Review the latest version before submitting.' using errcode='40001'; end if;
  select * into v_task from public.purchase_tasks where id=v_claim.purchase_task_id for update;
  if not found or v_task.assigned_member_id<>v_actor or v_task.activity_id<>v_claim.activity_id or
     v_task.department_id<>v_claim.department_id or v_task.club_id<>v_claim.club_id or
     v_task.updated_at is distinct from p_task_updated_at or v_task.status not in ('Purchased','Completed') then
    raise exception 'Purchasing task changed or is no longer eligible. Reload before submitting.' using errcode='40001';
  end if;
  select * into v_receipt from public.claim_receipts where claim_id=p_claim_id and is_current and upload_status='ready' for update;
  if not found or v_receipt.extraction is null or v_receipt.merchant is null or v_receipt.purchase_date is null then raise exception 'Upload and review receipt source values first' using errcode='23514'; end if;
  select (o.metadata->>'size')::bigint,o.metadata->>'mimetype' into v_size,v_mime from storage.objects o
    where o.bucket_id='receipts' and o.name=v_receipt.storage_path and o.owner_id=v_actor::text;
  if not found or v_size is distinct from v_receipt.size_bytes or v_mime is distinct from v_receipt.mime_type then raise exception 'Original receipt is unavailable or changed' using errcode='23514'; end if;
  select count(*),coalesce(sum(case when line_kind='discount' then -corrected_line_total_sen else corrected_line_total_sen end),0),
    coalesce(sum(case when included then case when line_kind='discount' then -corrected_line_total_sen else corrected_line_total_sen end else 0 end),0)
    into v_line_count,v_gross,v_amount from public.claim_items where claim_id=p_claim_id;
  if v_line_count not between 1 and 100 then raise exception 'Include at least one valid receipt item' using errcode='22023'; end if;
  if v_gross is distinct from v_receipt.reviewed_total_sen or v_amount<=0 or v_amount>v_gross then
    raise exception 'All receipt lines must reconcile to the reviewed total, and the claim total must be positive' using errcode='23514';
  end if;
  if v_claim.draft_payment_account_id is null then raise exception 'Select one of your saved payment accounts' using errcode='23514'; end if;
  select * into v_account from public.payment_accounts where id=v_claim.draft_payment_account_id and owner_uid=v_actor for update;
  if not found or v_account.updated_at is distinct from p_account_updated_at then raise exception 'Selected payment account changed. Review the destination again.' using errcode='40001'; end if;
  select d.allocation_sen-coalesce(sum(t.estimated_budget_sen),0) into v_dep_available
    from public.departments d left join public.purchase_tasks t on t.department_id=d.id and t.status<>'Cancelled'
    where d.id=v_task.department_id group by d.id;
  select a.budget_sen-coalesce(sum(t.estimated_budget_sen),0) into v_act_available
    from public.activities a left join public.purchase_tasks t on t.activity_id=a.id and t.status<>'Cancelled'
    where a.id=v_task.activity_id group by a.id;
  v_needs_reason:=v_amount>v_task.estimated_budget_sen or
    v_dep_available+v_task.estimated_budget_sen-v_amount<0 or v_act_available+v_task.estimated_budget_sen-v_amount<0;
  if v_needs_reason and length(trim(v_claim.over_budget_justification))<3 then raise exception 'Enter an over-budget justification before submitting' using errcode='23514'; end if;
  insert into public.claim_payment_destinations (claim_id,account_id,owner_uid,label,kind,holder,institution,identifier,masked,selected_by)
    values (p_claim_id,v_account.id,v_actor,v_account.label,v_account.kind,v_account.holder,v_account.institution,v_account.identifier,v_account.masked,v_actor);
  v_at:=greatest(date_trunc('milliseconds',clock_timestamp()),v_claim.updated_at+interval '1 millisecond');
  update public.claims set status='Pending',submitted_at=v_at,submission_key=p_submission_key,
    original_receipt_total_sen=v_receipt.original_total_sen,claimed_amount_sen=v_amount,
    item_budget_sen_snapshot=v_task.estimated_budget_sen,over_budget_amount_sen=greatest(0,v_amount-v_task.estimated_budget_sen),
    revision=revision+1,updated_at=v_at where id=p_claim_id;
  insert into public.claim_status_history (claim_id,from_status,to_status,actor_uid,detail)
    values (p_claim_id,'Draft','Pending',v_actor,jsonb_build_object('amount_sen',v_amount,'task_id',v_task.id));
  insert into public.audit_events (club_id,actor_uid,action,record_type,record_id,activity_id,department_id,changes)
    values (v_claim.club_id,v_actor,'Claim submitted','claim',p_claim_id,v_claim.activity_id,v_claim.department_id,
      jsonb_build_object('status','Pending','claimed_amount_sen',v_amount,'task_budget_sen',v_task.estimated_budget_sen,
        'over_budget_amount_sen',greatest(0,v_amount-v_task.estimated_budget_sen),'receipt_id',v_receipt.id));
  return p_claim_id;
end;
$$;
revoke all on function public.submit_my_claim(uuid,timestamptz,timestamptz,timestamptz,uuid) from public,anon;
grant execute on function public.submit_my_claim(uuid,timestamptz,timestamptz,timestamptz,uuid) to authenticated;
