create or replace function private.guard_department_allocation()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_activity_id uuid;
  v_department_id uuid;
  v_club_id uuid;
  v_budget bigint;
  v_total numeric;
  v_commitments numeric;
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
  if tg_op <> 'DELETE' then
    select coalesce(sum(estimated_budget_sen), 0) into v_commitments
      from public.purchase_tasks where department_id = v_department_id and status <> 'Cancelled';
    if new.allocation_sen < v_commitments then
      raise exception 'Department allocation cannot fall below active purchasing commitments' using errcode = '23514';
    end if;
    return new;
  end if;
  return old;
end;
$$;

create function private.stamp_purchase_task()
returns trigger language plpgsql set search_path = '' as $$
begin
  if tg_op = 'UPDATE' and (
    new.id is distinct from old.id or new.club_id is distinct from old.club_id or
    new.activity_id is distinct from old.activity_id or new.department_id is distinct from old.department_id or
    new.created_by_hod is distinct from old.created_by_hod or new.request_key is distinct from old.request_key or
    new.created_at is distinct from old.created_at
  ) then
    raise exception 'Purchasing task identity fields are immutable' using errcode = '23514';
  end if;
  new.updated_at := now();
  if new.status = 'Completed' and (tg_op = 'INSERT' or old.status is distinct from new.status) then
    new.completed_at := now();
  elsif new.status <> 'Completed' then
    new.completed_at := null;
  end if;
  return new;
end;
$$;
revoke all on function private.stamp_purchase_task() from public, anon, authenticated;
create trigger purchase_tasks_stamp before insert or update on public.purchase_tasks
  for each row execute function private.stamp_purchase_task();
