create function public.reserve_activity_archive(p_activity uuid)
returns uuid language plpgsql security definer set search_path='' as $$
declare activity public.activities; signed public.activity_reconciliations; approval uuid;
  archive_id uuid; document text;
begin
  select * into activity from private.lock_closing_activity(p_activity,'Director');
  if activity.financial_state in ('Archiving','Archived') then
    select id into archive_id from public.archive_records
      where activity_id=activity.id and entity_type='activity' and archive_state in ('Staging','Finalized');
    if found then return archive_id; end if;
  end if;
  if activity.financial_state<>'Director Approved' then
    raise exception 'Independent Director approval is required before archiving' using errcode='23514';
  end if;
  select * into signed from public.activity_reconciliations where activity_id=activity.id order by version desc limit 1;
  select id into approval from public.activity_closing_decisions
    where reconciliation_id=signed.id and approved and decided_by<>signed.signed_by;
  if approval is null then raise exception 'Approved reconciliation is unavailable' using errcode='23514'; end if;
  if exists(select 1 from jsonb_each_text(private.activity_financial_exceptions(activity.id)) item
    where item.value::bigint<>0) then
    raise exception 'Financial evidence must be restored before archiving' using errcode='23514';
  end if;
  archive_id:=gen_random_uuid();
  insert into public.archive_records(id,club_id,entity_type,entity_id,activity_id,archived_by,
    reconciliation_id,approval_id,format_version,archive_state,source_revision,object_path)
    values(archive_id,activity.club_id,'activity',activity.id,activity.id,auth.uid(),
      signed.id,approval,1,'Staging',activity.closing_revision+1,activity.id||'/'||archive_id||'.json.gz');
  update public.activities set financial_state='Archiving',closing_revision=closing_revision+1 where id=activity.id;
  perform private.append_business_audit(activity.club_id,'Archive generation started','activity_archive',
    archive_id,activity.id,null,jsonb_build_object('version',signed.version,'revision',activity.closing_revision+1));
  document:=private.activity_archive_document(archive_id);
  if document is null or octet_length(document)>20971520 then
    raise exception 'Archive exceeds the local 20 MiB logical package limit' using errcode='23514';
  end if;
  update public.archive_records set source_text=document,logical_bytes=octet_length(document),
    logical_sha256=encode(sha256(convert_to(document,'UTF8')),'hex') where id=archive_id;
  return archive_id;
end;
$$;
revoke all on function public.reserve_activity_archive(uuid) from public,anon;
grant execute on function public.reserve_activity_archive(uuid) to authenticated;

create function public.authorize_activity_archive(p_activity uuid,p_role text,p_download boolean)
returns uuid language plpgsql security definer set search_path='' as $$
declare activity public.activities; archive_id uuid;
begin
  if p_role is null or p_role not in ('Director','Treasurer') or p_download is null
    or (p_download and p_role<>'Treasurer') then
    raise exception 'Current Treasurer access is required for the private package' using errcode='42501';
  end if;
  select * into activity from private.lock_closing_activity(p_activity,p_role);
  select id into archive_id from public.archive_records where activity_id=activity.id
    and entity_type='activity' and archive_state='Finalized';
  if not found then raise exception 'Finalized archive unavailable' using errcode='42501'; end if;
  return archive_id;
end;
$$;
revoke all on function public.authorize_activity_archive(uuid,text,boolean) from public,anon;
grant execute on function public.authorize_activity_archive(uuid,text,boolean) to authenticated;

create function public.activity_archive_material(p_archive uuid)
returns jsonb language sql stable security definer set search_path='' as $$
  select to_jsonb(a) from public.archive_records a where a.id=p_archive and a.archive_state in ('Staging','Finalized');
$$;
revoke all on function public.activity_archive_material(uuid) from public,anon,authenticated;
grant execute on function public.activity_archive_material(uuid) to service_role;
