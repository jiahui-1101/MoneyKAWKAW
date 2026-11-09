-- Replace legacy raw-estimate caps; retain allocation and scope checks.
create or replace function public.save_purchase_task(
  p_id uuid, p_request_key uuid, p_activity_id uuid, p_department_id uuid,
  p_item_name text, p_description text, p_assigned_member_id uuid,
  p_estimated_budget_sen bigint, p_due_date date, p_priority public.purchase_priority,
  p_expected_updated_at timestamptz
)
returns public.purchase_tasks language plpgsql security definer set search_path = '' as $$
declare
  v_actor uuid := auth.uid();
  v_activity public.activities%rowtype;
  v_department public.departments%rowtype;
  v_task public.purchase_tasks%rowtype;
  v_existing_request public.purchase_tasks%rowtype;
  v_before jsonb;
begin
  if v_actor is null or not private.has_department_role(p_department_id, 'HOD') then
    raise exception 'Assigned HOD access required' using errcode = '42501';
  end if;
  select a.* into v_activity from public.activities a
    join public.departments d on d.activity_id = a.id and d.club_id = a.club_id
    where a.id = p_activity_id and d.id = p_department_id for update of a;
  if not found then raise exception 'Department is not part of this activity' using errcode = '42501'; end if;
  select * into v_department from public.departments
    where id = p_department_id and activity_id = p_activity_id and club_id = v_activity.club_id for update;
  if not found then raise exception 'Department is not part of this activity' using errcode = '42501'; end if;
  if p_item_name is null or length(trim(p_item_name)) not between 1 and 120 or
     p_description is null or length(trim(p_description)) not between 1 and 2000 or
     p_assigned_member_id is null or p_estimated_budget_sen is null or
     p_estimated_budget_sen not between 1 and 100000000000 or p_due_date is null or
     p_due_date > v_activity.end_date or p_priority is null then
    raise exception 'Check the item, description, assignee, budget, due date, and priority' using errcode = '22023';
  end if;
  if not exists (select 1 from public.department_memberships m
    where m.department_id = p_department_id and m.activity_id = p_activity_id
      and m.club_id = v_activity.club_id and m.user_id = p_assigned_member_id
      and m.role = 'Member' and m.status = 'active') then
    raise exception 'Assign this task to an active Member of the department' using errcode = '42501';
  end if;
  if p_id is null then
    if p_request_key is null then raise exception 'A request key is required' using errcode = '22023'; end if;
    select * into v_existing_request from public.purchase_tasks
      where created_by_hod = v_actor and request_key = p_request_key for update;
    if found then
      if v_existing_request.activity_id = p_activity_id and v_existing_request.department_id = p_department_id and
         v_existing_request.item_name = trim(p_item_name) and v_existing_request.description = trim(p_description) and
         v_existing_request.assigned_member_id = p_assigned_member_id and
         v_existing_request.estimated_budget_sen = p_estimated_budget_sen and
         v_existing_request.due_date = p_due_date and v_existing_request.priority = p_priority then
        return v_existing_request;
      end if;
      raise exception 'This request key was already used for another task' using errcode = '23505';
    end if;
  else
    select * into v_task from public.purchase_tasks
      where id = p_id and activity_id = p_activity_id and department_id = p_department_id for update;
    if not found then raise exception 'Purchasing task not found in this department' using errcode = 'P0002'; end if;
    if v_task.status = 'Cancelled' then raise exception 'Cancelled tasks cannot be changed' using errcode = '23514'; end if;
    if p_expected_updated_at is null or v_task.updated_at <> p_expected_updated_at then
      raise exception 'This task changed. Refresh and review the latest version.' using errcode = '40001';
    end if;
    v_before := to_jsonb(v_task);
  end if;
  -- Canonical AFTER trigger validates effective exposure, including claims and payments.
  if p_id is null then
    insert into public.purchase_tasks(
      club_id, activity_id, department_id, item_name, description, assigned_member_id,
      created_by_hod, request_key, estimated_budget_sen, due_date, priority
    ) values (
      v_activity.club_id, p_activity_id, p_department_id, trim(p_item_name), trim(p_description),
      p_assigned_member_id, v_actor, p_request_key, p_estimated_budget_sen, p_due_date, p_priority
    ) returning * into v_task;
    perform private.append_business_audit(v_activity.club_id, 'Purchasing task created',
      'purchasing_task', v_task.id, p_activity_id, p_department_id,
      jsonb_build_object('after', to_jsonb(v_task)));
  else
    update public.purchase_tasks set item_name = trim(p_item_name), description = trim(p_description),
      assigned_member_id = p_assigned_member_id, estimated_budget_sen = p_estimated_budget_sen,
      due_date = p_due_date, priority = p_priority
      where id = p_id returning * into v_task;
    perform private.append_business_audit(v_activity.club_id, 'Purchasing task updated',
      'purchasing_task', v_task.id, p_activity_id, p_department_id,
      jsonb_build_object('before', v_before, 'after', to_jsonb(v_task)));
    if v_before ->> 'assigned_member_id' <> p_assigned_member_id::text then
      perform private.append_business_audit(v_activity.club_id, 'Purchasing task reassigned',
        'purchasing_task', v_task.id, p_activity_id, p_department_id,
        jsonb_build_object('before', v_before ->> 'assigned_member_id', 'after', p_assigned_member_id));
    end if;
  end if;
  return v_task;
end;
$$;
revoke all on function public.save_purchase_task(uuid, uuid, uuid, uuid, text, text, uuid, bigint, date, public.purchase_priority, timestamptz)
  from public, anon, authenticated;
grant execute on function public.save_purchase_task(uuid, uuid, uuid, uuid, text, text, uuid, bigint, date, public.purchase_priority, timestamptz)
  to authenticated;

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
    -- Canonical AFTER trigger enforces the new allocation against actual exposure.
    return new;
  end if;
  return old;
end;
$$;

