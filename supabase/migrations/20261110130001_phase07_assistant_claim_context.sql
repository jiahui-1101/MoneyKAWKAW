create function private.assistant_claim(p_role text,p_kind text,p_id uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare c public.claims%rowtype; values_json jsonb; r jsonb; ml_json jsonb;
begin
  select * into c from public.claims where id=p_id;
  if not found or not ((p_role='Member' and c.claimant_user_id=(select auth.uid())
    and private.has_department_role(c.department_id,'Member') and p_kind='CLAIM') or
    (p_role='Treasurer' and c.claimant_user_id<>(select auth.uid()) and private.is_claim_treasurer(c.id))) then
    raise exception 'Claim context unavailable' using errcode='42501'; end if;
  values_json:=jsonb_build_object('status',c.status,'claim_sen',c.claimed_amount_sen,
    'estimate_sen',c.item_budget_sen_snapshot,'approved_sen',c.approved_amount_sen,
    'paid_sen',(select coalesce(sum(amount_sen),0) from public.reimbursement_payments where claim_id=c.id));
  if p_kind in ('RISK','LIGHTGBM') then
    r:=private.claim_risk(c.id);
    values_json:=values_json||jsonb_build_object('variance_sen',(r->>'variance')::bigint,
      'variance_pct',(r->>'variancePercent')::numeric,'risk_band',r->>'band',
      'department_available_sen',(r->>'departmentAvailable')::bigint,
      'activity_available_sen',(r->>'activityAvailable')::bigint);
  end if;
  if p_kind='LIGHTGBM' then
    select jsonb_build_object('version',a.model_version,'score',a.score,'at',a.created_at,
      'horizon',a.feature_snapshot->>'horizonEnd','contributions',a.contributions,'provenance',a.provenance)
      into ml_json from public.claim_pressure_advice a where a.claim_id=c.id
        and a.feature_schema='budget-pressure-v1' and a.model_version='pressure-v1:a711a680f94c'
      order by a.created_at desc limit 1;
  end if;
  return jsonb_build_object('values',values_json,'recordRevision',c.revision,
    'details',jsonb_build_object('reason',case when c.status='Rejected' then left(c.decision_reason,300) else '' end),
    'ml',ml_json);
end;
$$;
revoke all on function private.assistant_claim(text,text,uuid) from public,anon,authenticated;

create function public.assistant_context(p_role text,p_kind text,p_record uuid default null)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare profile jsonb; payload jsonb;
begin
  profile:=public.current_club_session();
  if (select auth.uid()) is null or profile is null or not(coalesce(profile->'roles','[]'::jsonb) ? p_role) then
    raise exception 'Active assigned club role required' using errcode='42501'; end if;
  if p_kind='HELP' and p_record is null then payload:=jsonb_build_object('values','{}'::jsonb);
  elsif p_kind in ('ACTIVITY','DEPARTMENT','TASKS') and p_record is not null then
    if (p_kind='ACTIVITY' and p_role not in ('Director','Treasurer')) or
      (p_kind in ('DEPARTMENT','TASKS') and p_role not in ('HOD','Member')) then
      raise exception 'Context is unavailable to this role' using errcode='42501'; end if;
    payload:=private.assistant_budget(p_role,p_kind,p_record);
  elsif p_kind in ('CLAIM','RISK','LIGHTGBM') and p_record is not null then
    if p_role not in ('Member','Treasurer') or (p_kind<>'CLAIM' and p_role<>'Treasurer') then
      raise exception 'Context is unavailable to this role' using errcode='42501'; end if;
    payload:=private.assistant_claim(p_role,p_kind,p_record);
  else raise exception 'Choose a supported question and authorized record' using errcode='22023';
  end if;
  return payload||jsonb_build_object('schema','assistant-v1','role',p_role,'kind',p_kind,'recordId',p_record,
    'asOf',now(),'revision',encode(sha256(convert_to(payload::text,'UTF8')),'hex'));
end;
$$;
revoke all on function public.assistant_context(text,text,uuid) from public,anon;
grant execute on function public.assistant_context(text,text,uuid) to authenticated;
