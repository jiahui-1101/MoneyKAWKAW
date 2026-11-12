create function public.finalize_activity_archive_object(p_archive uuid,p_actor uuid,p_object_path text,p_revision bigint,
  p_logical_sha text,p_compressed_sha text,p_compressed_bytes bigint,p_evidence_count integer,p_evidence_bytes bigint)
returns void language plpgsql security definer set search_path='' as $$
declare activity_id_for_archive uuid; current_path text;
begin
  if p_actor is null then raise exception 'Verified Director identity required' using errcode='42501'; end if;
  perform set_config('request.jwt.claim.sub',p_actor::text,true);
  select activity_id into activity_id_for_archive from public.archive_records where id=p_archive;
  perform private.lock_closing_activity(activity_id_for_archive,'Director');
  select object_path into current_path from public.archive_records where id=p_archive;
  if p_object_path is null or current_path is distinct from p_object_path then
    raise exception 'The staging object changed during verification' using errcode='40001';
  end if;
  perform public.finalize_activity_archive(p_archive,p_actor,p_revision,p_logical_sha,
    p_compressed_sha,p_compressed_bytes,p_evidence_count,p_evidence_bytes);
end;
$$;
revoke all on function public.finalize_activity_archive(uuid,uuid,bigint,text,text,bigint,integer,bigint) from service_role;
revoke all on function public.finalize_activity_archive_object(uuid,uuid,text,bigint,text,text,bigint,integer,bigint)
  from public,anon,authenticated;
grant execute on function public.finalize_activity_archive_object(uuid,uuid,text,bigint,text,text,bigint,integer,bigint) to service_role;
