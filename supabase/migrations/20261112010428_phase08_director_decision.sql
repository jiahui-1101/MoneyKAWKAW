create table public.activity_closing_decisions (
  id uuid primary key default gen_random_uuid(),
  reconciliation_id uuid not null unique references public.activity_reconciliations(id) on delete restrict,
  request_key uuid not null unique,
  closing_revision bigint not null,
  decided_by uuid not null references auth.users(id) on delete restrict,
  decided_name text not null,
  decided_at timestamptz not null default now(),
  approved boolean not null,
  reason text not null
);
alter table public.activity_closing_decisions enable row level security;
revoke all on public.activity_closing_decisions from public,anon,authenticated;
create trigger immutable_closing_decision before update or delete on public.activity_closing_decisions
  for each row execute function private.preserve_closing_history();

create function public.decide_activity_reconciliation(p_activity uuid,p_reconciliation uuid,p_revision bigint,
  p_request_key uuid,p_approved boolean,p_reason text)
returns uuid language plpgsql security definer set search_path='' as $$
declare activity public.activities; signed public.activity_reconciliations; decision public.activity_closing_decisions;
begin
  select * into activity from private.lock_closing_activity(p_activity,'Director');
  select * into signed from public.activity_reconciliations where id=p_reconciliation and activity_id=activity.id;
  if not found or signed.signed_by=auth.uid() then
    raise exception 'A different Director must decide this reconciliation' using errcode='42501';
  end if;
  if p_request_key is null or p_approved is null or p_reason is null or length(trim(p_reason))>500
    or (not p_approved and length(trim(p_reason))<3) then
    raise exception 'Confirm the decision and explain any return for correction' using errcode='22023';
  end if;
  select * into decision from public.activity_closing_decisions where request_key=p_request_key;
  if found then
    if decision.reconciliation_id<>signed.id or decision.decided_by<>auth.uid()
      or decision.closing_revision is distinct from p_revision or decision.approved<>p_approved
      or decision.reason<>trim(p_reason) then
      raise exception 'Request key already used' using errcode='23505';
    end if;
    return decision.id;
  end if;
  if activity.financial_state<>'Treasurer Reconciled' or activity.closing_revision is distinct from p_revision
    or signed.id is distinct from (select id from public.activity_reconciliations
      where activity_id=activity.id order by version desc limit 1) then
    raise exception 'Refresh and review the current reconciliation before deciding' using errcode='40001';
  end if;
  insert into public.activity_closing_decisions(reconciliation_id,request_key,closing_revision,decided_by,decided_name,approved,reason)
    values(signed.id,p_request_key,p_revision,auth.uid(),
      coalesce((select display_name from public.profiles where user_id=auth.uid()),auth.uid()::text),
      p_approved,trim(p_reason)) returning * into decision;
  update public.activities set financial_state=case when p_approved then 'Director Approved' else 'Closing' end,
    closing_revision=closing_revision+1 where id=activity.id;
  perform private.append_business_audit(activity.club_id,
    case when p_approved then 'Director approved reconciliation' else 'Director returned reconciliation' end,
    'closing_decision',decision.id,activity.id,null,
    jsonb_build_object('reconciliation',signed.id,'version',signed.version,'reason',trim(p_reason),'approved',p_approved));
  return decision.id;
end;
$$;
revoke all on function public.decide_activity_reconciliation(uuid,uuid,bigint,uuid,boolean,text) from public,anon;
grant execute on function public.decide_activity_reconciliation(uuid,uuid,bigint,uuid,boolean,text) to authenticated;
