create function public.save_my_claim_baseline(p_claim_id uuid,p_expected_updated_at timestamptz,
  p_receipt_id uuid,p_merchant text,p_purchase_date date,p_total_sen bigint,p_method text,
  p_raw_text text,p_lines jsonb)
returns timestamptz language plpgsql security definer set search_path = '' as $$
declare v_claim public.claims%rowtype; v_receipt public.claim_receipts%rowtype;
  v_line jsonb; v_desc text; v_kind text; v_amount bigint; v_qty integer; v_unit bigint;
  v_sum numeric:=0; v_count integer:=0; v_actor uuid:=(select auth.uid()); v_at timestamptz;
begin
  select * into v_claim from public.claims where id=p_claim_id for update;
  if not found or v_claim.claimant_user_id<>v_actor or v_claim.status<>'Draft' or
     not private.has_department_role(v_claim.department_id,'Member') then raise exception 'Claim draft unavailable' using errcode='42501'; end if;
  if v_claim.updated_at<>p_expected_updated_at then raise exception 'Draft changed. Reload before saving.' using errcode='40001'; end if;
  select * into v_receipt from public.claim_receipts where id=p_receipt_id and claim_id=p_claim_id
    and is_current and upload_status='ready' and uploaded_by=v_actor for update;
  if not found or v_receipt.extraction is not null then raise exception 'Upload a receipt first; captured source values cannot be overwritten' using errcode='23514'; end if;
  if p_merchant is null or length(trim(p_merchant)) not between 1 and 150 or p_purchase_date is null or
     p_purchase_date>timezone((select timezone from public.clubs where id=v_claim.club_id),now())::date or
     p_total_sen is null or p_total_sen not between 0 and 100000000000 or p_method not in ('tesseract','manual') or
     length(coalesce(p_raw_text,''))>50000 or coalesce(jsonb_typeof(p_lines),'')<>'array' or
     coalesce(jsonb_array_length(p_lines),0) not between 1 and 100 then
    raise exception 'Enter a valid merchant, date, total, and 1–100 receipt lines' using errcode='22023';
  end if;
  if exists(select 1 from public.claim_items where claim_id=p_claim_id) then raise exception 'Receipt source values already exist' using errcode='23514'; end if;
  for v_line in select value from jsonb_array_elements(p_lines) loop
    v_desc:=trim(v_line->>'description'); v_kind:=coalesce(v_line->>'kind','item');
    if v_desc is null or length(v_desc) not between 1 and 180 or v_kind not in ('item','tax','discount') or
       coalesce(v_line->>'amount','') !~ '^[0-9]{1,12}$' then raise exception 'Receipt line values are invalid' using errcode='22023'; end if;
    v_amount:=(v_line->>'amount')::bigint; v_qty:=null; v_unit:=null;
    if v_line ? 'quantityMilli' or v_line ? 'unitPrice' then
      if coalesce(v_line->>'quantityMilli','') !~ '^[0-9]{1,7}$' or coalesce(v_line->>'unitPrice','') !~ '^[0-9]{1,12}$' then raise exception 'Quantity and unit price must both be valid' using errcode='22023'; end if;
      v_qty:=(v_line->>'quantityMilli')::integer; v_unit:=(v_line->>'unitPrice')::bigint;
      if v_qty not between 1 and 1000000 or v_unit>100000000000 or floor((v_unit::numeric*v_qty+500)/1000)::bigint<>v_amount then raise exception 'Line total must equal quantity × unit price, rounded to sen' using errcode='22023'; end if;
    end if;
    if v_amount>100000000000 then raise exception 'Receipt line exceeds the supported amount' using errcode='22023'; end if;
    v_sum:=v_sum+case when v_kind='discount' then -v_amount else v_amount end; v_count:=v_count+1;
    insert into public.claim_items (claim_id,receipt_id,original_description,corrected_description,
      original_quantity_milli,corrected_quantity_milli,original_unit_price_sen,corrected_unit_price_sen,
      original_line_total_sen,corrected_line_total_sen,line_kind,original_ocr_reference)
    values (p_claim_id,p_receipt_id,v_desc,v_desc,v_qty,v_qty,v_unit,v_unit,v_amount,v_amount,v_kind,left(v_line->>'id',180));
  end loop;
  if v_sum<0 or v_sum>100000000000 then raise exception 'Receipt item total is outside the supported range' using errcode='22023'; end if;
  v_at:=greatest(date_trunc('milliseconds',clock_timestamp()),v_claim.updated_at+interval '1 millisecond');
  update public.claim_receipts set merchant=trim(p_merchant),purchase_date=p_purchase_date,
    original_total_sen=p_total_sen,reviewed_total_sen=p_total_sen,ocr_status=case when p_method='manual' then 'manual' else 'complete' end,
    ocr_engine=case when p_method='tesseract' then 'Tesseract.js' else 'Manual entry' end,
    ocr_version=case when p_method='tesseract' then '7.0.0' else null end,
    extraction=jsonb_build_object('method',p_method,'rawText',p_raw_text,'at',v_at,'lineCount',v_count)
    where id=p_receipt_id;
  update public.claims set original_receipt_total_sen=p_total_sen,extracted_items_total_sen=v_sum,
    claimed_amount_sen=v_sum,revision=revision+1,updated_at=v_at where id=p_claim_id;
  insert into public.audit_events (club_id,actor_uid,action,record_type,record_id,activity_id,department_id,changes)
    values (v_claim.club_id,v_actor,'Receipt source captured','claim',p_claim_id,v_claim.activity_id,v_claim.department_id,
      jsonb_build_object('method',p_method,'line_count',v_count,'original_total_sen',p_total_sen));
  return v_at;
end;
$$;
revoke all on function public.save_my_claim_baseline(uuid,timestamptz,uuid,text,date,bigint,text,text,jsonb) from public,anon;
grant execute on function public.save_my_claim_baseline(uuid,timestamptz,uuid,text,date,bigint,text,text,jsonb) to authenticated;
