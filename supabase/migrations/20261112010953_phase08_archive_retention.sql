alter table public.archive_records add column retention_policy jsonb;

create function public.set_activity_archive_retention(p_activity uuid,p_policy text,p_days integer,p_hold boolean)
returns void language plpgsql security definer set search_path='' as $$
declare activity public.activities; archive public.archive_records; policy jsonb;
begin
  select * into activity from private.lock_closing_activity(p_activity,'Director');
  select * into archive from public.archive_records where activity_id=activity.id
    and entity_type='activity' and archive_state='Finalized';
  if not found or p_policy is null or length(trim(p_policy)) not between 3 and 80 or
    p_days is null or p_days not between 1 and 36500 or p_hold is null then
    raise exception 'Choose an adopted policy, retention period and hold status for a finalized archive' using errcode='22023';
  end if;
  policy:=jsonb_build_object('id',trim(p_policy),'start',archive.archived_at,'days',p_days,
    'approvedBy',auth.uid(),'approvedAt',now(),'categories',jsonb_build_array('Original receipts','Payment proofs','Financial archive','Audit history'),
    'deletionEligible',false);
  update public.archive_records set retention_policy=policy,legal_hold=p_hold,
    retain_until=archive.archived_at+make_interval(days=>p_days) where id=archive.id;
  perform private.append_business_audit(activity.club_id,'Archive retention policy changed','activity_archive',
    archive.id,activity.id,null,jsonb_build_object('previous',archive.retention_policy,'policy',policy,'hold',p_hold));
end;
$$;
revoke all on function public.set_activity_archive_retention(uuid,text,integer,boolean) from public,anon;
grant execute on function public.set_activity_archive_retention(uuid,text,integer,boolean) to authenticated;

create function public.preview_activity_archive_cleanup(p_activity uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare activity public.activities; archive public.archive_records; preview jsonb; eligible boolean;
begin
  select * into activity from private.lock_closing_activity(p_activity,'Director');
  select * into archive from public.archive_records where activity_id=activity.id
    and entity_type='activity' and archive_state='Finalized';
  eligible:=coalesce(archive.retention_policy is not null and not archive.legal_hold
    and archive.verification_state='Verified',false);
  with candidates as (
    select 'Abandoned receipt staging' as kind,r.id,'receipts' as bucket,r.storage_path as path
      from public.claim_receipts r join public.claims c on c.id=r.claim_id
      where c.activity_id=activity.id and r.upload_status='abandoned' and r.uploaded_at is null and not r.is_current
    union all
    select 'Abandoned proof staging',p.id,'payment-proofs',p.storage_path
      from public.payment_proofs p join public.claims c on c.id=p.claim_id
      where c.activity_id=activity.id and p.upload_status='abandoned' and p.finalized_at is null
        and not exists(select 1 from public.reimbursement_payments pay where pay.proof_id=p.id)
  ), found as (
    select e.id,e.kind,(o.metadata->>'size')::bigint as bytes
      from candidates e join storage.objects o on o.bucket_id=e.bucket and o.name=e.path
  )
  select jsonb_build_object('activityId',activity.id,'eligibleForReview',eligible,'deletionEnabled',false,
    'verification',archive.verification_state,'legalHold',coalesce(archive.legal_hold,false),
    'policy',archive.retention_policy,'candidateCount',(select count(*) from found),
    'potentialBytes',(select coalesce(sum(bytes),0) from found),
    'candidates',(select coalesce(jsonb_agg(to_jsonb(f) order by f.id),'[]')
      from (select * from found order by id limit 100) f)) into preview;
  perform private.append_business_audit(activity.club_id,'Cleanup dry run requested','activity',
    activity.id,activity.id,null,jsonb_build_object('candidateCount',preview->'candidateCount','potentialBytes',preview->'potentialBytes'));
  return preview;
end;
$$;
revoke all on function public.preview_activity_archive_cleanup(uuid) from public,anon;
grant execute on function public.preview_activity_archive_cleanup(uuid) to authenticated;
