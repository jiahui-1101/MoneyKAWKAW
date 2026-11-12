create table public.activity_reconciliations (
  id uuid primary key default gen_random_uuid(),
  activity_id uuid not null references public.activities(id) on delete restrict,
  version integer not null check (version>0),
  closing_revision bigint not null,
  request_key uuid not null unique,
  signed_by uuid not null references auth.users(id) on delete restrict,
  signed_at timestamptz not null default now(),
  signed_name text not null,
  facts jsonb not null check (jsonb_typeof(facts)='object'),
  unique(activity_id,version)
);
alter table public.activity_reconciliations enable row level security;
revoke all on public.activity_reconciliations from public,anon,authenticated;

create function private.preserve_closing_history()
returns trigger language plpgsql set search_path='' as $$
begin
  raise exception 'Signed activity closing history is immutable' using errcode='23514';
end;
$$;
revoke all on function private.preserve_closing_history() from public,anon,authenticated;
create trigger immutable_reconciliation before update or delete on public.activity_reconciliations
  for each row execute function private.preserve_closing_history();

create function public.sign_activity_reconciliation(p_activity uuid,p_revision bigint,p_request_key uuid)
returns uuid language plpgsql security definer set search_path='' as $$
declare activity public.activities; signed public.activity_reconciliations; facts jsonb;
begin
  select * into activity from private.lock_closing_activity(p_activity,'Treasurer');
  select * into signed from public.activity_reconciliations where request_key=p_request_key;
  if found then
    if signed.activity_id<>activity.id or signed.signed_by<>auth.uid()
      or signed.closing_revision is distinct from p_revision then
      raise exception 'Request key already used' using errcode='23505';
    end if;
    return signed.id;
  end if;
  if p_request_key is null or activity.financial_state<>'Closing'
    or activity.closing_revision is distinct from p_revision then
    raise exception 'Refresh and review the current closing checklist before signing' using errcode='40001';
  end if;
  facts:=private.activity_closing_facts(activity.id);
  if exists(select 1 from jsonb_each_text(facts->'blockers') entry where entry.value::bigint<>0) then
    raise exception 'Resolve the closing checklist before signing' using errcode='23514';
  end if;
  insert into public.activity_reconciliations(activity_id,version,closing_revision,request_key,signed_by,signed_name,facts)
    values(activity.id,(select coalesce(max(version),0)+1 from public.activity_reconciliations where activity_id=activity.id),
      p_revision,p_request_key,auth.uid(),coalesce((select display_name from public.profiles where id=auth.uid()),auth.uid()::text),facts)
    returning * into signed;
  update public.activities set financial_state='Treasurer Reconciled',closing_revision=closing_revision+1 where id=activity.id;
  perform private.append_business_audit(activity.club_id,'Treasurer signed reconciliation','reconciliation',
    signed.id,activity.id,null,jsonb_build_object('version',signed.version,'revision',p_revision,'paid',facts->'paid'));
  return signed.id;
end;
$$;
revoke all on function public.sign_activity_reconciliation(uuid,bigint,uuid) from public,anon;
grant execute on function public.sign_activity_reconciliation(uuid,bigint,uuid) to authenticated;
