create function private.guard_purchase_task_scope()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  if tg_op = 'INSERT' then
    if new.created_by_hod <> auth.uid() or not private.has_department_role(new.department_id, 'HOD') or
       not exists (select 1 from public.department_memberships m
         join public.activity_memberships a using (activity_id, club_id, user_id)
         join public.club_memberships c using (club_id, user_id)
         where m.department_id = new.department_id and m.user_id = new.assigned_member_id
           and m.role = 'Member' and m.status = 'active' and a.status = 'active' and c.status = 'active') then
      raise exception 'Only an assigned HOD can create tasks for an active department Member' using errcode = '42501';
    end if;
  elsif not private.has_department_role(new.department_id, 'HOD') then
    if old.assigned_member_id <> auth.uid() or not private.has_department_role(new.department_id, 'Member') or
       (to_jsonb(new) - array['status', 'updated_at', 'completed_at']) is distinct from
       (to_jsonb(old) - array['status', 'updated_at', 'completed_at']) then
      raise exception 'Members may update purchasing progress only on their own task' using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;
revoke all on function private.guard_purchase_task_scope() from public, anon, authenticated;
create trigger purchase_tasks_scope_guard before insert or update on public.purchase_tasks
  for each row execute function private.guard_purchase_task_scope();

create function public.update_hod_purchase_task_status(
  p_task_id uuid, p_status public.purchase_task_status, p_expected_updated_at timestamptz
)
returns public.purchase_tasks language plpgsql security definer set search_path = '' as $$
declare
  v_task public.purchase_tasks%rowtype;
  v_activity public.activities%rowtype;
  v_before jsonb;
begin
  if p_status is null then raise exception 'Choose a purchasing status' using errcode = '22023'; end if;
  select * into v_task from public.purchase_tasks where id = p_task_id;
  if not found then raise exception 'Purchasing task not found' using errcode = 'P0002'; end if;
  if not private.has_department_role(v_task.department_id, 'HOD') then
    raise exception 'Assigned HOD access required' using errcode = '42501';
  end if;
  select * into v_activity from public.activities
    where id = v_task.activity_id and club_id = v_task.club_id for update;
  if not found then raise exception 'Activity not found' using errcode = 'P0002'; end if;
  perform 1 from public.departments where id = v_task.department_id for update;
  select * into v_task from public.purchase_tasks where id = p_task_id for update;
  if not private.has_department_role(v_task.department_id, 'HOD') then
    raise exception 'Assigned HOD access required' using errcode = '42501';
  end if;
  if p_expected_updated_at is null or v_task.updated_at <> p_expected_updated_at then
    raise exception 'This task changed. Refresh and review the latest version.' using errcode = '40001';
  end if;
  if p_status = 'Cancelled' then
    if v_task.status not in ('Not Started', 'In Progress') then
      raise exception 'This task can no longer be cancelled' using errcode = '23514';
    end if;
  elsif not (
    (v_task.status = 'Not Started' and p_status in ('In Progress', 'Purchased')) or
    (v_task.status = 'In Progress' and p_status = 'Purchased') or
    (v_task.status = 'Purchased' and p_status = 'Completed')
  ) then
    raise exception 'Purchasing status transition is not allowed' using errcode = '23514';
  end if;
  v_before := to_jsonb(v_task);
  update public.purchase_tasks set status = p_status where id = p_task_id returning * into v_task;
  perform private.append_business_audit(v_task.club_id,
    case when p_status = 'Cancelled' then 'Purchasing task cancelled' else 'Purchasing task status changed' end,
    'purchasing_task', v_task.id, v_task.activity_id, v_task.department_id,
    jsonb_build_object('before', v_before, 'after', to_jsonb(v_task)));
  return v_task;
end;
$$;
revoke all on function public.update_hod_purchase_task_status(uuid, public.purchase_task_status, timestamptz)
  from public, anon, authenticated;
grant execute on function public.update_hod_purchase_task_status(uuid, public.purchase_task_status, timestamptz)
  to authenticated;

create function public.update_my_purchase_progress(
  p_task_id uuid, p_status public.purchase_task_status, p_expected_updated_at timestamptz
)
returns public.purchase_tasks language plpgsql security definer set search_path = '' as $$
declare
  v_task public.purchase_tasks%rowtype;
  v_activity public.activities%rowtype;
  v_before jsonb;
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  if p_status is null then raise exception 'Choose a purchasing status' using errcode = '22023'; end if;
  select * into v_task from public.purchase_tasks where id = p_task_id;
  if not found then raise exception 'Purchasing task not found' using errcode = 'P0002'; end if;
  select * into v_activity from public.activities
    where id = v_task.activity_id and club_id = v_task.club_id for update;
  if not found then raise exception 'Activity not found' using errcode = 'P0002'; end if;
  perform 1 from public.departments where id = v_task.department_id for update;
  select * into v_task from public.purchase_tasks where id = p_task_id for update;
  if v_task.assigned_member_id <> auth.uid() or
     not private.has_department_role(v_task.department_id, 'Member') then
    raise exception 'Only the assigned active department Member can update this task' using errcode = '42501';
  end if;
  if p_expected_updated_at is null or v_task.updated_at <> p_expected_updated_at then
    raise exception 'This task changed. Refresh and review the latest version.' using errcode = '40001';
  end if;
  if not (
    (v_task.status = 'Not Started' and p_status in ('In Progress', 'Purchased')) or
    (v_task.status = 'In Progress' and p_status = 'Purchased') or
    (v_task.status = 'Purchased' and p_status = 'Completed')
  ) then
    raise exception 'Purchasing status transition is not allowed' using errcode = '23514';
  end if;
  v_before := to_jsonb(v_task);
  update public.purchase_tasks set status = p_status where id = p_task_id returning * into v_task;
  perform private.append_business_audit(v_task.club_id, 'Member purchase progress updated',
    'purchasing_task', v_task.id, v_task.activity_id, v_task.department_id,
    jsonb_build_object('before', v_before, 'after', to_jsonb(v_task)));
  return v_task;
end;
$$;
revoke all on function public.update_my_purchase_progress(uuid, public.purchase_task_status, timestamptz)
  from public, anon, authenticated;
grant execute on function public.update_my_purchase_progress(uuid, public.purchase_task_status, timestamptz)
  to authenticated;
