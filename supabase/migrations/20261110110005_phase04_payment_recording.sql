alter table public.reimbursement_payments add constraint payments_dispute_confirmation_check
  check (received_at is null or discrepancy_at is null or resolved_at is not null);
create function public.record_reimbursement(p_claim_id uuid,p_expected_updated_at timestamptz,p_request_key uuid,
  p_amount_sen bigint,p_payment_date date,p_reference text,p_proof_id uuid,p_destination_revision text,p_confirmed boolean)
returns uuid language plpgsql security definer set search_path='' as $$
declare c public.claims%rowtype; p public.payment_proofs%rowtype; v_activity uuid; v_id uuid; v_selected text; v_payload jsonb;
begin
  select activity_id into v_activity from public.claims where id=p_claim_id;
  perform 1 from public.activities where id=v_activity for update;
  select * into c from public.claims where id=p_claim_id for update;
  if not found or not private.is_claim_treasurer(c.id) or c.claimant_user_id=(select auth.uid()) then
    raise exception 'Independent Treasurer access required' using errcode='42501'; end if;
  v_payload:=jsonb_build_object('amount',p_amount_sen,'date',p_payment_date,'reference',p_reference,'proof',p_proof_id,'destination',p_destination_revision,'confirmed',p_confirmed);
  if private.financial_request(p_request_key,c.id,'payment',v_payload) then
    select id into v_id from public.reimbursement_payments where claim_id=c.id; return v_id; end if;
  if c.updated_at is distinct from p_expected_updated_at then raise exception 'Claim changed. Reload before recording payment.' using errcode='40001'; end if;
  if c.status<>'Payment Pending' or p_confirmed is distinct from true or
    p_amount_sen is null or p_amount_sen is distinct from c.approved_amount_sen or p_amount_sen is distinct from c.claimed_amount_sen then
    raise exception 'Confirm one full transfer matching the approved claim' using errcode='23514'; end if;
  if p_reference is null or length(trim(p_reference)) not between 3 and 120 or p_payment_date is null or
    p_payment_date<c.submitted_at::date or p_payment_date>timezone('Asia/Kuala_Lumpur',now())::date then
    raise exception 'Enter a valid transfer reference and payment date' using errcode='22023'; end if;
  select selected_at::text into v_selected from public.claim_payment_destinations where claim_id=c.id;
  if v_selected is null or v_selected is distinct from p_destination_revision then raise exception 'Payment destination changed. Review instructions again.' using errcode='40001'; end if;
  select * into p from public.payment_proofs where id=p_proof_id and claim_id=c.id for update;
  if not found or p.upload_status<>'ready' or p.uploaded_by<>(select auth.uid()) or not exists(
    select 1 from storage.objects o where o.bucket_id='payment-proofs' and o.name=p.storage_path and o.owner_id=p.uploaded_by::text
      and (o.metadata->>'size')::bigint=p.size_bytes and o.metadata->>'mimetype'=p.mime_type) then
    raise exception 'Finalized stored payment proof is required' using errcode='23514'; end if;
  insert into public.reimbursement_payments(claim_id,approved_amount_sen,amount_sen,reference,payment_date,recorded_by,proof_id,request_key)
    values(c.id,c.approved_amount_sen,p_amount_sen,trim(p_reference),p_payment_date,(select auth.uid()),p.id,p_request_key) returning id into v_id;
  update public.payment_proofs set upload_status='retained' where id=p.id;
  perform private.emit_financial_transition(c.id,'Paid','Manual external transfer recorded; bank settlement is not independently verified.');
  return v_id;
end;
$$;
revoke all on function public.record_reimbursement(uuid,timestamptz,uuid,bigint,date,text,uuid,text,boolean) from public,anon;
grant execute on function public.record_reimbursement(uuid,timestamptz,uuid,bigint,date,text,uuid,text,boolean) to authenticated;

create function public.report_payment_issue(p_payment_id uuid,p_request_key uuid,p_reason text,p_received_sen bigint default null)
returns void language plpgsql security definer set search_path='' as $$
declare p public.reimbursement_payments%rowtype; c public.claims%rowtype;
begin
  select * into p from public.reimbursement_payments where id=p_payment_id;
  select * into c from public.claims where id=p.claim_id for update;
  if not found or c.claimant_user_id<>(select auth.uid()) or not private.has_department_role(c.department_id,'Member') then
    raise exception 'Claimant access required' using errcode='42501'; end if;
  if private.financial_request(p_request_key,c.id,'dispute',jsonb_build_object('reason',p_reason,'received',p_received_sen)) then return; end if;
  if c.status<>'Paid' or p.discrepancy_at is not null or p_reason is null or length(trim(p_reason)) not between 3 and 1000 or
    (p_received_sen is not null and p_received_sen not between 0 and 100000000000) then raise exception 'Enter a new payment discrepancy for an unconfirmed payment' using errcode='23514'; end if;
  update public.reimbursement_payments set discrepancy_reason=trim(p_reason),discrepancy_amount_sen=p_received_sen,discrepancy_at=now() where id=p.id;
  insert into public.financial_notifications(recipient_uid,claim_id,title,detail) values(p.recorded_by,c.id,'Payment discrepancy',trim(p_reason));
  perform private.append_business_audit(c.club_id,'Payment discrepancy reported','claim',c.id,c.activity_id,c.department_id,jsonb_build_object('reason',trim(p_reason)));
end;
$$;
create function public.resolve_payment_issue(p_payment_id uuid,p_request_key uuid,p_note text)
returns void language plpgsql security definer set search_path='' as $$
declare p public.reimbursement_payments%rowtype; c public.claims%rowtype;
begin
  select * into p from public.reimbursement_payments where id=p_payment_id;
  select * into c from public.claims where id=p.claim_id for update;
  if not found or not private.is_claim_treasurer(c.id) or c.claimant_user_id=(select auth.uid()) then raise exception 'Independent Treasurer required' using errcode='42501'; end if;
  if private.financial_request(p_request_key,c.id,'resolve-dispute',jsonb_build_object('note',p_note)) then return; end if;
  if c.status<>'Paid' or p.discrepancy_at is null or p.resolved_at is not null or p_note is null or length(trim(p_note)) not between 3 and 1000 then raise exception 'An unresolved payment issue and resolution note are required' using errcode='23514'; end if;
  update public.reimbursement_payments set resolution_note=trim(p_note),resolved_at=now() where id=p.id;
  insert into public.financial_notifications(recipient_uid,claim_id,title,detail) values(c.claimant_user_id,c.id,'Payment issue response',trim(p_note));
  perform private.append_business_audit(c.club_id,'Payment issue response recorded','claim',c.id,c.activity_id,c.department_id,jsonb_build_object('note',trim(p_note)));
end;
$$;
revoke all on function public.report_payment_issue(uuid,uuid,text,bigint),public.resolve_payment_issue(uuid,uuid,text) from public,anon;
grant execute on function public.report_payment_issue(uuid,uuid,text,bigint),public.resolve_payment_issue(uuid,uuid,text) to authenticated;
