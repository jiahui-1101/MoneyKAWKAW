create function private.emit_financial_transition(p_claim uuid,p_target public.claim_status,p_reason text)
returns timestamptz language plpgsql security definer set search_path='' as $$
declare c public.claims%rowtype; v_at timestamptz; recipient uuid;
begin
  select * into c from public.claims where id=p_claim;
  v_at:=greatest(date_trunc('milliseconds',clock_timestamp()),c.updated_at+interval '1 millisecond');
  update public.claims set status=p_target,revision=revision+1,updated_at=v_at where id=p_claim;
  insert into public.claim_status_history(claim_id,from_status,to_status,actor_uid,detail)
    values(p_claim,c.status,p_target,(select auth.uid()),jsonb_build_object('reason',p_reason,'amount_sen',c.claimed_amount_sen));
  perform private.append_business_audit(c.club_id,'Claim '||p_target,'claim',c.id,c.activity_id,c.department_id,
    jsonb_build_object('from',c.status,'to',p_target,'reason',p_reason));
  recipient:=c.claimant_user_id;
  if p_target='Received' then select recorded_by into recipient from public.reimbursement_payments where claim_id=c.id; end if;
  insert into public.financial_notifications(recipient_uid,claim_id,title,detail)
    values(recipient,c.id,'Claim '||p_target,p_reason);
  return v_at;
end;
$$;
revoke all on function private.emit_financial_transition(uuid,public.claim_status,text) from public,anon,authenticated;

create function public.transition_claim(p_claim_id uuid,p_target public.claim_status,p_expected_updated_at timestamptz,
  p_request_key uuid,p_reason text default '')
returns timestamptz language plpgsql security definer set search_path='' as $$
declare c public.claims%rowtype; v_activity uuid; r jsonb; v_amount numeric; v_gross numeric; v_total bigint;
begin
  select activity_id into v_activity from public.claims where id=p_claim_id;
  perform 1 from public.activities where id=v_activity for update;
  select * into c from public.claims where id=p_claim_id for update;
  if not found or (select auth.uid()) is null then raise exception 'Claim unavailable' using errcode='42501'; end if;
  if p_target='Received' then
    if c.claimant_user_id<>(select auth.uid()) or not private.has_department_role(c.department_id,'Member') then
      raise exception 'Only the active claimant can confirm receipt' using errcode='42501'; end if;
  elsif not private.is_claim_treasurer(c.id) or c.claimant_user_id=(select auth.uid()) then
    raise exception 'Independent Treasurer access required' using errcode='42501';
  end if;
  if p_reason is null or length(p_reason)>1000 then raise exception 'Keep the reason within 1000 characters' using errcode='22023'; end if;
  if private.financial_request(p_request_key,c.id,'transition',jsonb_build_object('target',p_target,'reason',trim(p_reason))) then return c.updated_at; end if;
  if c.updated_at is distinct from p_expected_updated_at then raise exception 'Claim changed. Refresh before continuing.' using errcode='40001'; end if;
  if not ((c.status='Pending' and p_target='Under Review') or
    (c.status='Under Review' and p_target in ('Approved','Rejected')) or
    (c.status='Approved' and p_target='Payment Pending') or (c.status='Paid' and p_target='Received')) then
    raise exception 'This claim transition is not permitted' using errcode='23514'; end if;
  if p_target='Rejected' and length(trim(p_reason))<3 then raise exception 'Enter a rejection reason' using errcode='22023'; end if;
  if p_target='Under Review' then
    update public.claims set reviewer_uid=(select auth.uid()),review_started_at=now() where id=c.id;
  elsif p_target='Approved' then
    select coalesce(sum(case when included then case when line_kind='discount' then -corrected_line_total_sen else corrected_line_total_sen end else 0 end),0),
      coalesce(sum(case when line_kind='discount' then -corrected_line_total_sen else corrected_line_total_sen end),0)
      into v_amount,v_gross from public.claim_items where claim_id=c.id;
    select reviewed_total_sen into v_total from public.claim_receipts cr join storage.objects o
      on o.bucket_id='receipts' and o.name=cr.storage_path and o.owner_id=c.claimant_user_id::text
      where cr.claim_id=c.id and cr.is_current and cr.upload_status='ready' and cr.extraction is not null
        and (o.metadata->>'size')::bigint=cr.size_bytes and o.metadata->>'mimetype'=cr.mime_type;
    if not found or v_amount is distinct from c.claimed_amount_sen or v_amount<=0 or v_gross is distinct from v_total then
      raise exception 'Finalized original and receipt lines must reconcile to the submitted claim' using errcode='23514'; end if;
    r:=private.claim_risk(c.id);
    if (r->>'departmentAvailable')::bigint<0 or (r->>'activityAvailable')::bigint<0 then
      raise exception 'Approval exceeds available budget. Director budget adjustment is required.' using errcode='23514'; end if;
    update public.claims set approved_amount_sen=c.claimed_amount_sen,decision_risk=r,
      reviewer_uid=(select auth.uid()),decided_at=now(),decision_reason=trim(p_reason) where id=c.id;
  elsif p_target='Rejected' then
    update public.claims set reviewer_uid=(select auth.uid()),decided_at=now(),decision_reason=trim(p_reason) where id=c.id;
  elsif p_target='Received' then
    update public.reimbursement_payments set received_at=now(),received_by=(select auth.uid()) where claim_id=c.id;
    if not found then raise exception 'Recorded payment required' using errcode='23514'; end if;
  end if;
  return private.emit_financial_transition(c.id,p_target,trim(p_reason));
end;
$$;
revoke all on function public.transition_claim(uuid,public.claim_status,timestamptz,uuid,text) from public,anon;
grant execute on function public.transition_claim(uuid,public.claim_status,timestamptz,uuid,text) to authenticated;

create function public.payment_instructions(p_claim_id uuid)
returns table(claim_id uuid,label text,kind text,holder text,institution text,identifier text,masked text,revision text)
language plpgsql security definer set search_path='' as $$
declare c public.claims%rowtype;
begin
  select * into c from public.claims where id=p_claim_id for update;
  if not found or not private.is_claim_treasurer(c.id) or c.claimant_user_id=(select auth.uid()) or
    c.status not in ('Approved','Payment Pending') then raise exception 'Independent Treasurer payment access required' using errcode='42501'; end if;
  perform private.append_business_audit(c.club_id,'Payment instructions accessed','claim',c.id,c.activity_id,c.department_id,'{}');
  return query select d.claim_id,d.label,d.kind,d.holder,d.institution,d.identifier,d.masked,d.selected_at::text
    from public.claim_payment_destinations d where d.claim_id=c.id;
end;
$$;
revoke all on function public.payment_instructions(uuid) from public,anon;
grant execute on function public.payment_instructions(uuid) to authenticated;
