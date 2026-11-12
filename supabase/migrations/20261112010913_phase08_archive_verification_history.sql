create function public.record_activity_archive_check(p_archive uuid,p_actor uuid,p_role text,
  p_operation text,p_failure text,p_compressed_sha text)
returns void language plpgsql security definer set search_path='' as $$
declare activity public.activities; archive public.archive_records;
begin
  if p_actor is null or p_role is null or p_role not in ('Director','Treasurer') or p_operation is null
    or p_operation not in ('generate','verify','download') or (p_operation='download' and p_role<>'Treasurer')
    or (p_operation='generate' and p_role<>'Director') then
    raise exception 'Authorized archive verification required' using errcode='42501';
  end if;
  if p_failure is not null and p_failure not in (
    'UPLOAD_FAILED','ARCHIVE_MISSING','ARCHIVE_MISMATCH','EVIDENCE_MISSING','EVIDENCE_MISMATCH','FINALIZATION_FAILED'
  ) then raise exception 'Unknown archive check result' using errcode='22023'; end if;
  perform set_config('request.jwt.claim.sub',p_actor::text,true);
  select * into archive from public.archive_records where id=p_archive;
  select * into activity from private.lock_closing_activity(archive.activity_id,p_role);
  select * into archive from public.archive_records where id=p_archive;
  if p_operation='generate' and archive.archive_state='Finalized' then return; end if;
  if p_failure is null and (archive.archive_state<>'Finalized'
    or archive.compressed_sha256 is distinct from p_compressed_sha) then
    raise exception 'Archive checksum does not match the finalized record' using errcode='23514';
  end if;
  update public.archive_records set verification_state=case when p_failure is null then 'Verified' else 'Failed' end,
    checked_at=now(),failure_code=p_failure where id=archive.id;
  perform private.append_business_audit(activity.club_id,
    case when p_failure is not null then 'Archive verification failed'
      when p_operation='download' then 'Verified archive retrieved' else 'Archive bytes reverified' end,
    'activity_archive',archive.id,activity.id,null,jsonb_build_object('operation',p_operation,
      'failure',p_failure,'compressedSha256',p_compressed_sha));
end;
$$;
revoke all on function public.record_activity_archive_check(uuid,uuid,text,text,text,text) from public,anon,authenticated;
grant execute on function public.record_activity_archive_check(uuid,uuid,text,text,text,text) to service_role;
