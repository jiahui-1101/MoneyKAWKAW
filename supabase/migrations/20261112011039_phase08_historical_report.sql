create function public.activity_closing_report(p_activity uuid,p_role text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare activity public.activities; signed public.activity_reconciliations; archive public.archive_records;
  decision public.activity_closing_decisions; history jsonb; facts jsonb;
begin
  if p_role is null or p_role not in ('Director','Treasurer') then
    raise exception 'Authorized activity role required' using errcode='42501';
  end if;
  select * into activity from private.lock_closing_activity(p_activity,p_role);
  select * into signed from public.activity_reconciliations where activity_id=activity.id order by version desc limit 1;
  select * into decision from public.activity_closing_decisions where reconciliation_id=signed.id;
  select * into archive from public.archive_records where activity_id=activity.id and entity_type='activity'
    and archive_state in ('Staging','Finalized');
  select coalesce(jsonb_agg(jsonb_build_object('id',r.id,'version',r.version,'signedAt',r.signed_at,
    'signedName',r.signed_name,'decision',case when d.id is not null then to_jsonb(d)-'request_key' end)
    order by r.version desc),'[]') into history
    from public.activity_reconciliations r left join public.activity_closing_decisions d on d.reconciliation_id=r.id
    where r.activity_id=activity.id;
  if activity.financial_state in ('Open','Closing') then facts:=private.activity_closing_facts(activity.id);
  else facts:=signed.facts; end if;
  return jsonb_build_object('state',activity.financial_state,'revision',activity.closing_revision,'facts',facts,
    'reconciliation',case when signed.id is not null then to_jsonb(signed)-array['request_key','facts'] end,
    'decision',case when decision.id is not null then to_jsonb(decision)-'request_key' end,'history',history,
    'independentDirectorExists',exists(select 1 from public.club_role_grants g
      join public.club_memberships m using(club_id,user_id)
      where g.club_id=activity.club_id and g.role='Director' and m.status='active'
        and g.user_id is distinct from signed.signed_by),
    'canDecide',p_role='Director' and signed.signed_by<>auth.uid(),
    'archive',case when archive.id is not null then
      to_jsonb(archive)-array['source_text','object_path','department_id','club_id','entity_type','entity_id'] end);
end;
$$;
revoke all on function public.activity_closing_report(uuid,text) from public,anon;
grant execute on function public.activity_closing_report(uuid,text) to authenticated;
