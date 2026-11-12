alter table public.activities
  add column financial_state text not null default 'Open'
    check (financial_state in ('Open','Closing','Treasurer Reconciled','Director Approved','Archiving','Archived')),
  add column closing_revision bigint not null default 0 check (closing_revision >= 0);

create function private.guard_closed_activity()
returns trigger language plpgsql set search_path='' as $$
begin
  if old.financial_state='Open' then
    if tg_op='DELETE' then return old; end if;
    return new;
  end if;
  if tg_op='DELETE' or
    (to_jsonb(new)-array['financial_state','closing_revision','updated_at']) is distinct from
    (to_jsonb(old)-array['financial_state','closing_revision','updated_at']) then
    raise exception 'Activity setup is frozen during financial closing' using errcode='23514';
  end if;
  return new;
end;
$$;
revoke all on function private.guard_closed_activity() from public,anon,authenticated;
create trigger activity_closing_guard before update or delete on public.activities
  for each row execute function private.guard_closed_activity();

-- A negative live balance must appear as a blocker, without preventing the close request.
drop trigger activities_financial_guard on public.activities;
create trigger activities_financial_guard after update of budget_sen on public.activities
  for each row when (old.budget_sen is distinct from new.budget_sen)
  execute function private.guard_financial_budget();

create function private.lock_closing_activity(p_activity uuid,p_role text)
returns public.activities language plpgsql security definer set search_path='' as $$
declare activity public.activities;
begin
  select * into activity from public.activities where id=p_activity for update;
  if not found or auth.uid() is null or not (
    (p_role='Director' and private.has_club_role(activity.club_id,'Director')) or
    (p_role='Treasurer' and (private.has_club_role(activity.club_id,'Treasurer') or
      private.has_activity_role(activity.id,'Treasurer')))
  ) then raise exception 'Authorized activity role required' using errcode='42501'; end if;
  return activity;
end;
$$;
revoke all on function private.lock_closing_activity(uuid,text) from public,anon,authenticated;

create function public.request_activity_close(p_activity uuid)
returns bigint language plpgsql security definer set search_path='' as $$
declare activity public.activities;
begin
  select * into activity from private.lock_closing_activity(p_activity,'Director');
  if activity.financial_state='Closing' then return activity.closing_revision; end if;
  if activity.financial_state<>'Open' or activity.status='Planning' then
    raise exception 'Only an active or completed activity can enter closing' using errcode='23514';
  end if;
  update public.activities set financial_state='Closing',closing_revision=closing_revision+1
    where id=activity.id returning closing_revision into activity.closing_revision;
  perform private.append_business_audit(activity.club_id,'Activity closing requested','activity',
    activity.id,activity.id,null,jsonb_build_object('revision',activity.closing_revision));
  return activity.closing_revision;
end;
$$;
revoke all on function public.request_activity_close(uuid) from public,anon;
grant execute on function public.request_activity_close(uuid) to authenticated;
