alter table public.archive_records add column recovery_checked_at timestamptz,
  add column recovery_report jsonb;

create function public.record_activity_archive_recovery(p_archive uuid,p_actor uuid,p_compressed_sha text,
  p_rows integer,p_evidence_count integer,p_milliseconds integer)
returns void language plpgsql security definer set search_path='' as $$
declare activity public.activities; archive public.archive_records; result jsonb;
begin
  if p_actor is null then raise exception 'Authorized recovery operator required' using errcode='42501'; end if;
  perform set_config('request.jwt.claim.sub',p_actor::text,true);
  select * into archive from public.archive_records where id=p_archive;
  select * into activity from private.lock_closing_activity(archive.activity_id,'Treasurer');
  select * into archive from public.archive_records where id=p_archive;
  if archive.archive_state<>'Finalized' or archive.verification_state<>'Verified'
    or archive.compressed_sha256 is distinct from p_compressed_sha
    or archive.verified_evidence_count is distinct from p_evidence_count
    or p_rows is null or p_rows<1 or p_milliseconds is null or p_milliseconds<0 then
    raise exception 'Recovery results must match a verified archive and retained evidence count' using errcode='23514';
  end if;
  result:=jsonb_build_object('result','Passed','operator',p_actor,'source','Operator-attested isolated rehearsal',
    'compressedSha256',p_compressed_sha,'rows',p_rows,'evidence',p_evidence_count,'milliseconds',p_milliseconds);
  update public.archive_records set recovery_checked_at=now(),recovery_report=result where id=archive.id;
  perform private.append_business_audit(activity.club_id,'Archive recovery drill performed','activity_archive',
    archive.id,activity.id,null,result);
end;
$$;
revoke all on function public.record_activity_archive_recovery(uuid,uuid,text,integer,integer,integer) from public,anon,authenticated;
grant execute on function public.record_activity_archive_recovery(uuid,uuid,text,integer,integer,integer) to service_role;
