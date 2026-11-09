create or replace function public.correct_my_claim_receipt_total(p_claim_id uuid,p_expected_updated_at timestamptz,
  p_total_sen bigint,p_reason text)
returns timestamptz language plpgsql security definer set search_path = '' as $$
declare v_claim public.claims%rowtype; v_receipt public.claim_receipts%rowtype; v_before bigint; v_at timestamptz; v_actor uuid:=(select auth.uid());
begin
  select * into v_claim from public.claims where id=p_claim_id for update;
  if not found or v_claim.claimant_user_id<>v_actor or v_claim.status<>'Draft' or
     not private.has_department_role(v_claim.department_id,'Member') then raise exception 'Claim draft unavailable' using errcode='42501'; end if;
  if v_claim.updated_at<>p_expected_updated_at then raise exception 'Draft changed. Reload the latest version.' using errcode='40001'; end if;
  if p_total_sen is null or p_total_sen not between 0 and 100000000000 or p_reason is null or length(trim(p_reason)) not between 3 and 500 then raise exception 'Enter a valid reviewed total and reason' using errcode='22023'; end if;
  select * into v_receipt from public.claim_receipts where claim_id=p_claim_id and is_current and upload_status='ready' for update;
  if not found or v_receipt.extraction is null then raise exception 'Receipt source values are unavailable' using errcode='23514'; end if;
  v_before:=v_receipt.reviewed_total_sen;
  if v_before=p_total_sen then raise exception 'The reviewed total is unchanged' using errcode='22023'; end if;
  insert into public.receipt_modifications (claim_id,receipt_id,field_changed,before_value,after_value,modification_type,reason,modified_by)
    values (p_claim_id,v_receipt.id,'reviewed_total_sen',to_jsonb(v_before),to_jsonb(p_total_sen),'Amount Adjustment',trim(p_reason),v_actor);
  update public.claim_receipts set reviewed_total_sen=p_total_sen where id=v_receipt.id;
  v_at:=greatest(date_trunc('milliseconds',clock_timestamp()),v_claim.updated_at+interval '1 millisecond');
  update public.claims set revision=revision+1,updated_at=v_at where id=p_claim_id;
  insert into public.audit_events (club_id,actor_uid,action,record_type,record_id,activity_id,department_id,changes)
    values (v_claim.club_id,v_actor,'Reviewed receipt total corrected','claim',p_claim_id,v_claim.activity_id,v_claim.department_id,
      jsonb_build_object('before_sen',v_before,'after_sen',p_total_sen,'reason',trim(p_reason)));
  return v_at;
end;
$$;
revoke all on function public.correct_my_claim_receipt_total(uuid,timestamptz,bigint,text) from public,anon;
grant execute on function public.correct_my_claim_receipt_total(uuid,timestamptz,bigint,text) to authenticated;
