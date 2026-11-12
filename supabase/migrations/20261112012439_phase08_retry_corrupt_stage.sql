create function public.replace_corrupt_archive_stage(p_archive uuid,p_actor uuid,p_expected_path text)
returns text language plpgsql security definer set search_path='' as $$
declare activity public.activities; archive public.archive_records; next_path text;
begin
  if p_actor is null then raise exception 'Verified Director identity required' using errcode='42501'; end if;
  perform set_config('request.jwt.claim.sub',p_actor::text,true);
  select * into archive from public.archive_records where id=p_archive;
  select * into activity from private.lock_closing_activity(archive.activity_id,'Director');
  select * into archive from public.archive_records where id=p_archive;
  if activity.financial_state<>'Archiving' or archive.archive_state<>'Staging' then
    raise exception 'Only corrupt staging can be replaced' using errcode='23514';
  end if;
  if archive.object_path is distinct from p_expected_path then return archive.object_path; end if;
  if archive.failure_code is distinct from 'ARCHIVE_MISMATCH' then
    raise exception 'Only a recorded staging checksum failure permits a replacement' using errcode='23514';
  end if;
  next_path:=activity.id||'/'||archive.id||'-'||gen_random_uuid()||'.json.gz';
  update public.archive_records set object_path=next_path,failure_code=null,verification_state='Pending'
    where id=archive.id;
  perform private.append_business_audit(activity.club_id,'Corrupt archive stage isolated','activity_archive',
    archive.id,activity.id,null,jsonb_build_object('previousPath',archive.object_path,'reason','ARCHIVE_MISMATCH'));
  return next_path;
end;
$$;
revoke all on function public.replace_corrupt_archive_stage(uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.replace_corrupt_archive_stage(uuid,uuid,text) to service_role;
