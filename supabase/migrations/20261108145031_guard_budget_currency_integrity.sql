create function private.guard_activity_currency()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_currency public.currency_code;
begin
  select currency into v_currency from public.clubs where id = new.club_id;
  if not found or new.currency is distinct from v_currency then
    raise exception 'Activity currency must match its club currency' using errcode = '23514';
  end if;
  return new;
end;
$$;
create trigger activities_currency_guard before insert or update on public.activities
  for each row execute function private.guard_activity_currency();

create function private.guard_club_currency_change()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.currency is distinct from old.currency and exists (
    select 1 from public.activities where club_id = old.id
  ) then
    raise exception 'Club currency cannot change while activities exist; migrate all amounts explicitly' using errcode = '23514';
  end if;
  return new;
end;
$$;
create trigger clubs_currency_change_guard before update on public.clubs
  for each row execute function private.guard_club_currency_change();

create function private.guard_department_allocation()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_activity_id uuid;
  v_department_id uuid;
  v_club_id uuid;
  v_budget bigint;
  v_total numeric;
begin
  if tg_op = 'DELETE' then
    v_activity_id := old.activity_id; v_department_id := old.id; v_club_id := old.club_id;
  else
    v_activity_id := new.activity_id; v_department_id := new.id; v_club_id := new.club_id;
  end if;
  if tg_op = 'UPDATE' and (new.activity_id is distinct from old.activity_id or new.club_id is distinct from old.club_id) then
    raise exception 'A department cannot be moved between activities' using errcode = '23514';
  end if;
  select budget_sen into v_budget from public.activities
    where id = v_activity_id and club_id = v_club_id for update;
  if not found then raise exception 'Activity not found' using errcode = '23503'; end if;
  select coalesce(sum(allocation_sen), 0) into v_total from public.departments
    where activity_id = v_activity_id and (v_department_id is null or id <> v_department_id);
  if tg_op <> 'DELETE' then v_total := v_total + new.allocation_sen; end if;
  if v_total > v_budget then raise exception 'Department allocations exceed the activity budget' using errcode = '23514'; end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;
create trigger departments_allocation_guard before insert or update or delete on public.departments
  for each row execute function private.guard_department_allocation();

create function private.guard_activity_budget_change()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if (select coalesce(sum(allocation_sen), 0) from public.departments where activity_id = new.id) > new.budget_sen then
    raise exception 'Activity budget cannot fall below department allocations' using errcode = '23514';
  end if;
  return new;
end;
$$;
create trigger activities_budget_guard before update of budget_sen on public.activities
  for each row execute function private.guard_activity_budget_change();

revoke all on function private.guard_activity_currency() from public, anon, authenticated;
revoke all on function private.guard_club_currency_change() from public, anon, authenticated;
revoke all on function private.guard_department_allocation() from public, anon, authenticated;
revoke all on function private.guard_activity_budget_change() from public, anon, authenticated;
