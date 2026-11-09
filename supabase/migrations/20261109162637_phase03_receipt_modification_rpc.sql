create function public.edit_my_claim_item(p_claim_id uuid,p_expected_updated_at timestamptz,
  p_item_id uuid,p_line jsonb,p_excluded boolean,p_reason text,
  p_modification_type public.receipt_modification_type)
returns timestamptz language plpgsql security definer set search_path = '' as $$
declare v_claim public.claims%rowtype; v_receipt public.claim_receipts%rowtype;
  v_item public.claim_items%rowtype; v_id uuid; v_desc text; v_kind text; v_amount bigint;
  v_qty integer; v_unit bigint; v_included boolean; v_type public.receipt_modification_type;
  v_before jsonb; v_after jsonb; v_total numeric; v_at timestamptz; v_actor uuid:=(select auth.uid());
begin
  select * into v_claim from public.claims where id=p_claim_id for update;
  if not found or v_claim.claimant_user_id<>v_actor or v_claim.status<>'Draft' or
     not private.has_department_role(v_claim.department_id,'Member') then raise exception 'Claim draft unavailable' using errcode='42501'; end if;
  if v_claim.updated_at<>p_expected_updated_at then raise exception 'Draft changed. Reload the latest version.' using errcode='40001'; end if;
  select * into v_receipt from public.claim_receipts where claim_id=p_claim_id and is_current and upload_status='ready' for update;
  if not found or v_receipt.extraction is null then raise exception 'Capture receipt source values before editing lines' using errcode='23514'; end if;
  if p_reason is null or length(trim(p_reason)) not between 3 and 500 or p_excluded is null then raise exception 'Explain the change in 3–500 characters' using errcode='22023'; end if;
  v_desc:=trim(p_line->>'description'); v_kind:=coalesce(p_line->>'kind','item');
  if v_desc is null or length(v_desc) not between 1 and 180 or v_kind not in ('item','tax','discount') or
     coalesce(p_line->>'amount','') !~ '^[0-9]{1,12}$' then raise exception 'Receipt line values are invalid' using errcode='22023'; end if;
  v_amount:=(p_line->>'amount')::bigint; v_qty:=null; v_unit:=null;
  if p_line ? 'quantityMilli' or p_line ? 'unitPrice' then
    if coalesce(p_line->>'quantityMilli','') !~ '^[0-9]{1,7}$' or coalesce(p_line->>'unitPrice','') !~ '^[0-9]{1,12}$' then raise exception 'Quantity and unit price must both be valid' using errcode='22023'; end if;
    v_qty:=(p_line->>'quantityMilli')::integer; v_unit:=(p_line->>'unitPrice')::bigint;
    if v_qty not between 1 and 1000000 or floor((v_unit::numeric*v_qty+500)/1000)::bigint<>v_amount then raise exception 'Line total must equal quantity × unit price, rounded to sen' using errcode='22023'; end if;
  end if;
  if v_amount>100000000000 then raise exception 'Receipt line exceeds the supported amount' using errcode='22023'; end if;
  if p_item_id is null then
    if (select count(*) from public.claim_items where claim_id=p_claim_id)>=100 then raise exception 'A receipt may contain up to 100 lines' using errcode='22023'; end if;
    v_id:=gen_random_uuid(); v_included:=true;
    insert into public.claim_items (id,claim_id,receipt_id,original_description,corrected_description,
      original_line_total_sen,corrected_line_total_sen,line_kind)
      values (v_id,p_claim_id,v_receipt.id,'Not extracted · manually added line',v_desc,0,v_amount,v_kind);
    v_type:='Item Inclusion';
    v_before:=jsonb_build_object('description','Not extracted · manually added line','amount',0,'included',false);
  else
    select * into v_item from public.claim_items where id=p_item_id and claim_id=p_claim_id for update;
    if not found then raise exception 'Receipt line unavailable' using errcode='42501'; end if;
    v_id:=v_item.id; v_included:=not p_excluded;
    v_before:=jsonb_build_object('description',v_item.corrected_description,'amount',v_item.corrected_line_total_sen,
      'quantityMilli',v_item.corrected_quantity_milli,'unitPrice',v_item.corrected_unit_price_sen,
      'kind',v_item.line_kind,'included',v_item.included);
    if v_item.included<>(not p_excluded) then
      v_type:=case when p_excluded then 'Item Exclusion'::public.receipt_modification_type else 'Item Inclusion'::public.receipt_modification_type end;
    else
      if p_modification_type is null or p_modification_type not in ('OCR Correction','Amount Adjustment','Description Correction') then raise exception 'Choose a valid correction type' using errcode='22023'; end if;
      v_type:=p_modification_type;
    end if;
    if v_item.corrected_description=v_desc and v_item.corrected_line_total_sen=v_amount and
       v_item.corrected_quantity_milli is not distinct from v_qty and v_item.corrected_unit_price_sen is not distinct from v_unit and
       v_item.line_kind=v_kind and v_item.included=(not p_excluded) then raise exception 'Change a value or inclusion before saving' using errcode='22023'; end if;
    update public.claim_items set corrected_description=v_desc,corrected_quantity_milli=v_qty,
      corrected_unit_price_sen=v_unit,corrected_line_total_sen=v_amount,line_kind=v_kind,
      included=not p_excluded,exclusion_reason=case when p_excluded then trim(p_reason) else '' end,
      revision=revision+1,updated_at=now() where id=v_id;
  end if;
  v_after:=jsonb_build_object('description',v_desc,'amount',v_amount,'quantityMilli',v_qty,
    'unitPrice',v_unit,'kind',v_kind,'included',v_included);
  insert into public.receipt_modifications (claim_id,receipt_id,claim_item_id,field_changed,before_value,after_value,modification_type,reason,modified_by)
    values (p_claim_id,v_receipt.id,v_id,'receipt_line',v_before,v_after,v_type,trim(p_reason),v_actor);
  select coalesce(sum(case when included then case when line_kind='discount' then -corrected_line_total_sen else corrected_line_total_sen end else 0 end),0)
    into v_total from public.claim_items where claim_id=p_claim_id;
  if v_total<0 or v_total>100000000000 then raise exception 'Included item total is outside the supported range' using errcode='23514'; end if;
  v_at:=greatest(date_trunc('milliseconds',clock_timestamp()),v_claim.updated_at+interval '1 millisecond');
  update public.claims set claimed_amount_sen=v_total,revision=revision+1,updated_at=v_at where id=p_claim_id;
  insert into public.audit_events (club_id,actor_uid,action,record_type,record_id,activity_id,department_id,changes)
    values (v_claim.club_id,v_actor,'Receipt line modified','claim',p_claim_id,v_claim.activity_id,v_claim.department_id,
      jsonb_build_object('item_id',v_id,'type',v_type,'reason',trim(p_reason)));
  return v_at;
end;
$$;

create function public.correct_my_claim_receipt_total(p_claim_id uuid,p_expected_updated_at timestamptz,
  p_total_sen bigint,p_reason text)
returns timestamptz language plpgsql security definer set search_path = '' as $$
declare v_claim public.claims%rowtype; v_receipt public.claim_receipts%rowtype; v_before bigint; v_at timestamptz; v_actor uuid:=(select auth.uid());
begin
  select * into v_claim from public.claims where id=p_claim_id for update;
  if not found or v_claim.claimant_user_id<>v_actor or v_claim.status<>'Draft' or not private.has_department_role(v_claim.department_id,'Member') then raise exception 'Claim draft unavailable' using errcode='42501'; end if;
  if v_claim.updated_at<>p_expected_updated_at then raise exception 'Draft changed. Reload the latest version.' using errcode='40001'; end if;
  if p_total_s is null or p_total_s not between 0 and 100000000000 or p_reason is null or length(trim(p_reason)) not between 3 and 500 then raise exception 'Enter a valid reviewed total and reason' using errcode='22023'; end if;
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
      jsonb_build_object('before_sen',v_before,'after_sen',p_total_s,'reason',trim(p_reason)));
  return v_at;
end;
$$;
revoke all on function public.edit_my_claim_item(uuid,timestamptz,uuid,jsonb,boolean,text,public.receipt_modification_type),
  public.correct_my_claim_receipt_total(uuid,timestamptz,bigint,text) from public,anon;
grant execute on function public.edit_my_claim_item(uuid,timestamptz,uuid,jsonb,boolean,text,public.receipt_modification_type),
  public.correct_my_claim_receipt_total(uuid,timestamptz,bigint,text) to authenticated;
