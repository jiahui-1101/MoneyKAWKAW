create function public.activity_staged_proofs(p_activity uuid)
returns table(id uuid,filename text,size_bytes bigint,created_at timestamptz)
language plpgsql security definer set search_path='' as $$
declare activity public.activities;
begin
  select * into activity from private.lock_closing_activity(p_activity,'Treasurer');
  if activity.financial_state<>'Closing' then return; end if;
  return query select p.id,p.filename,p.size_bytes,p.created_at
    from public.payment_proofs p join public.claims c on c.id=p.claim_id
    where c.activity_id=activity.id and c.claimant_user_id<>auth.uid()
      and p.upload_status='uploading' and p.finalized_at is null
    order by p.created_at,p.id limit 100;
end;
$$;
revoke all on function public.activity_staged_proofs(uuid) from public,anon;
grant execute on function public.activity_staged_proofs(uuid) to authenticated;

create function public.abandon_closing_proof(p_activity uuid,p_proof uuid,p_reason text)
returns void language plpgsql security definer set search_path='' as $$
declare activity public.activities; proof public.payment_proofs; claim public.claims;
begin
  select * into activity from private.lock_closing_activity(p_activity,'Treasurer');
  select * into proof from public.payment_proofs where id=p_proof for update;
  select * into claim from public.claims where id=proof.claim_id and activity_id=activity.id;
  if not found or claim.claimant_user_id=auth.uid() then
    raise exception 'Independent Treasurer access required for this proof' using errcode='42501';
  end if;
  if proof.upload_status='abandoned' and proof.finalized_at is null then return; end if;
  if activity.financial_state<>'Closing' or proof.upload_status<>'uploading' or proof.finalized_at is not null
    or exists(select 1 from public.reimbursement_payments where proof_id=proof.id) then
    raise exception 'Only unfinalized and unused proof staging can be abandoned' using errcode='23514';
  end if;
  if p_reason is null or length(trim(p_reason)) not between 3 and 500 then
    raise exception 'Explain why this incomplete upload should be abandoned' using errcode='22023';
  end if;
  update public.payment_proofs set upload_status='abandoned' where id=proof.id;
  perform private.append_business_audit(activity.club_id,'Closing proof staging abandoned','claim',
    claim.id,activity.id,claim.department_id,jsonb_build_object('proof',proof.id,'reason',trim(p_reason)));
end;
$$;
revoke all on function public.abandon_closing_proof(uuid,uuid,text) from public,anon;
grant execute on function public.abandon_closing_proof(uuid,uuid,text) to authenticated;
