create or replace function private.guard_closed_activity()
returns trigger language plpgsql set search_path='' as $$
begin
  if old.financial_state='Open' then
    if tg_op='DELETE' then return old; end if;
    return new;
  end if;
  if tg_op='DELETE' or
    (to_jsonb(new)-array['financial_state','closing_revision','updated_at','archived_at','archived_by']) is distinct from
    (to_jsonb(old)-array['financial_state','closing_revision','updated_at','archived_at','archived_by']) or
    ((new.archived_at,new.archived_by) is distinct from (old.archived_at,old.archived_by)
      and not (old.financial_state='Archiving' and new.financial_state='Archived'
        and new.archived_at is not null and new.archived_by is not null)) then
    raise exception 'Activity setup is frozen during financial closing' using errcode='23514';
  end if;
  return new;
end;
$$;

create function public.finalize_activity_archive(p_archive uuid,p_actor uuid,p_revision bigint,
  p_logical_sha text,p_compressed_sha text,p_compressed_bytes bigint,p_evidence_count integer,p_evidence_bytes bigint)
returns void language plpgsql security definer set search_path='' as $$
declare activity public.activities; archive public.archive_records; evidence_count bigint; evidence_bytes bigint;
begin
  if p_actor is null then raise exception 'Verified Director identity required' using errcode='42501'; end if;
  perform set_config('request.jwt.claim.sub',p_actor::text,true);
  select * into archive from public.archive_records where id=p_archive;
  select * into activity from private.lock_closing_activity(archive.activity_id,'Director');
  select * into archive from public.archive_records where id=p_archive;
  if archive.archive_state='Finalized' and archive.compressed_sha256=p_compressed_sha then return; end if;
  if activity.financial_state<>'Archiving' or archive.archive_state<>'Staging'
    or p_revision is distinct from archive.source_revision or activity.closing_revision<>archive.source_revision
    or p_logical_sha is distinct from archive.logical_sha256
    or p_compressed_sha is null or p_compressed_sha !~ '^[0-9a-f]{64}$'
    or p_compressed_bytes is null or p_compressed_bytes not between 1 and 52428800
    or not exists(select 1 from storage.objects o where o.bucket_id='financial-archive'
      and o.name=archive.object_path and o.metadata->>'size'=p_compressed_bytes::text
      and o.metadata->>'mimetype'='application/gzip')
    or not exists(select 1 from public.activity_closing_decisions d
      join public.activity_reconciliations r on r.id=d.reconciliation_id
      where d.id=archive.approval_id and r.id=archive.reconciliation_id and r.activity_id=activity.id
        and d.approved and d.decided_by<>r.signed_by) then
    raise exception 'Archive object, approval or frozen revision could not be verified' using errcode='23514';
  end if;
  select count(*),coalesce(sum(bytes),0) into evidence_count,evidence_bytes from private.activity_evidence_manifest(activity.id);
  if p_evidence_count is distinct from evidence_count or p_evidence_bytes is distinct from evidence_bytes
    or exists(select 1 from jsonb_each_text(private.activity_financial_exceptions(activity.id)) item
      where item.value::bigint<>0) then
    raise exception 'Retained evidence verification is incomplete' using errcode='23514';
  end if;
  update public.archive_records set archive_state='Finalized',verification_state='Verified',
    archived_at=now(),archived_by=p_actor,checked_at=now(),failure_code=null,source_text=null,
    compressed_sha256=p_compressed_sha,compressed_bytes=p_compressed_bytes,
    verified_evidence_count=p_evidence_count,evidence_bytes=p_evidence_bytes where id=archive.id;
  update public.activities set financial_state='Archived',closing_revision=closing_revision+1,
    archived_at=now(),archived_by=p_actor where id=activity.id;
  perform private.append_business_audit(activity.club_id,'Archive uploaded and bytes verified','activity_archive',
    archive.id,activity.id,null,jsonb_build_object('logicalSha256',p_logical_sha,'compressedSha256',p_compressed_sha,
      'evidence',p_evidence_count,'bytes',p_compressed_bytes));
  perform private.append_business_audit(activity.club_id,'Archive finalized','activity_archive',
    archive.id,activity.id,null,jsonb_build_object('revision',p_revision,'reconciliation',archive.reconciliation_id));
end;
$$;
revoke all on function public.finalize_activity_archive(uuid,uuid,bigint,text,text,bigint,integer,bigint) from public,anon,authenticated;
grant execute on function public.finalize_activity_archive(uuid,uuid,bigint,text,text,bigint,integer,bigint) to service_role;
