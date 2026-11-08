create function public.save_department_setup(
  p_activity_id uuid, p_department_id uuid, p_name text, p_description text,
  p_head_label text, p_allocation_sen bigint, p_hod_user_id uuid, p_member_user_ids uuid[]
)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_club_id uuid := private.require_club_director();
  v_department public.departments%rowtype;
  v_people uuid[] := coalesce(p_member_user_ids, '{}'::uuid[]);
  v_all_people uuid[];
  v_removed uuid[];
  v_before_department jsonb;
  v_before_members jsonb;
  v_after_members jsonb;
  v_hod_label text;
  v_is_new boolean := p_department_id is null;
begin
  if p_name is null or length(trim(p_name)) not between 1 and 80 or
     length(coalesce(p_description, '')) > 500 or length(coalesce(p_head_label, '')) > 100 or
     p_allocation_sen is null or p_allocation_sen not between 0 and 100000000000 then
    raise exception 'Check the department name, description, lead, and non-negative allocation' using errcode = '22023';
  end if;
  if cardinality(v_people) <> (select count(distinct u) from unnest(v_people) as x(u)) or
     array_position(v_people, null) is not null or
     (p_hod_user_id is not null and p_hod_user_id = any(v_people)) then
    raise exception 'Assign each active club member only once' using errcode = '22023';
  end if;
  v_all_people := v_people;
  if p_hod_user_id is not null then v_all_people := array_append(v_all_people, p_hod_user_id); end if;
  perform 1 from public.activities
    where id = p_activity_id and club_id = v_club_id for update;
  if not found then raise exception 'Activity not found' using errcode = 'P0002'; end if;
  if exists (select 1 from unnest(v_all_people) as x(user_id)
    left join public.club_memberships m on m.club_id = v_club_id and m.user_id = x.user_id
    where m.user_id is null or m.status <> 'active') then
    raise exception 'Department assignments must use active members of this club' using errcode = '42501';
  end if;
  if p_hod_user_id is not null then
    select display_name into v_hod_label from public.profiles where user_id = p_hod_user_id;
    if not found then raise exception 'Assigned HOD profile is unavailable' using errcode = '22023'; end if;
  else
    v_hod_label := trim(coalesce(p_head_label, ''));
  end if;
  if exists (select 1 from public.departments d where d.activity_id = p_activity_id
    and lower(d.name) = lower(trim(p_name)) and (v_is_new or d.id <> p_department_id)) then
    raise exception 'A department with this name already exists in the activity' using errcode = '23505';
  end if;
  if v_is_new then
    insert into public.departments(club_id, activity_id, name, description, head_label, allocation_sen)
      values (v_club_id, p_activity_id, trim(p_name), trim(coalesce(p_description, '')),
        v_hod_label, p_allocation_sen) returning * into v_department;
  else
    select * into v_department from public.departments
      where id = p_department_id and activity_id = p_activity_id and club_id = v_club_id for update;
    if not found then raise exception 'Department not found' using errcode = 'P0002'; end if;
    v_before_department := to_jsonb(v_department);
    update public.departments set name = trim(p_name), description = trim(coalesce(p_description, '')),
      head_label = v_hod_label, allocation_sen = p_allocation_sen, updated_at = now()
      where id = p_department_id returning * into v_department;
  end if;
  select coalesce(jsonb_agg(jsonb_build_object('userId', user_id, 'role', role) order by user_id), '[]'::jsonb)
    into v_before_members from public.department_memberships
    where department_id = v_department.id and status = 'active';
  select coalesce(array_agg(user_id), '{}'::uuid[]) into v_removed from public.department_memberships
    where department_id = v_department.id and status = 'active' and not (user_id = any(v_all_people));
  if exists (select 1 from public.purchase_tasks t where t.department_id = v_department.id
    and t.assigned_member_id = any(v_removed) and t.status <> 'Cancelled') then
    raise exception 'Reassign or cancel open purchases before removing a department member' using errcode = '23514';
  end if;
  update public.department_memberships set status = 'revoked'
    where department_id = v_department.id and status = 'active'
      and not (user_id = any(v_all_people));
  insert into public.activity_memberships(activity_id, club_id, user_id, status)
    select p_activity_id, v_club_id, u, 'active' from unnest(v_all_people) as x(u)
    on conflict (activity_id, user_id) do update set status = 'active';
  insert into public.department_memberships(department_id, activity_id, club_id, user_id, role, status, created_by)
    select v_department.id, p_activity_id, v_club_id, u,
      case when u = p_hod_user_id then 'HOD'::public.department_role else 'Member'::public.department_role end,
      'active', auth.uid()
    from unnest(v_all_people) as x(u)
    on conflict (department_id, user_id) do update
      set role = excluded.role, status = 'active', created_by = auth.uid();
  update public.activity_memberships am set status = 'revoked'
    where am.activity_id = p_activity_id and am.club_id = v_club_id and am.status = 'active'
      and am.user_id = any(v_removed)
      and not exists (select 1 from public.department_memberships d where d.activity_id = p_activity_id
        and d.user_id = am.user_id and d.status = 'active')
      and not exists (select 1 from public.activity_role_grants g where g.activity_id = p_activity_id
        and g.user_id = am.user_id);
  select coalesce(jsonb_agg(jsonb_build_object('userId', user_id, 'role', role) order by user_id), '[]'::jsonb)
    into v_after_members from public.department_memberships
    where department_id = v_department.id and status = 'active';
  if v_is_new then
    perform private.append_business_audit(v_club_id, 'Department created', 'department',
      v_department.id, p_activity_id, v_department.id, jsonb_build_object('after', to_jsonb(v_department)));
  else
    perform private.append_business_audit(v_club_id, 'Department modified', 'department',
      v_department.id, p_activity_id, v_department.id,
      jsonb_build_object('before', v_before_department, 'after', to_jsonb(v_department)));
  end if;
  if (v_is_new and p_allocation_sen > 0) or
     (not v_is_new and (v_before_department ->> 'allocation_sen')::bigint <> p_allocation_sen) then
    perform private.append_business_audit(v_club_id, 'Department budget changed', 'department',
      v_department.id, p_activity_id, v_department.id,
      jsonb_build_object('before', case when v_is_new then 0 else (v_before_department ->> 'allocation_sen')::bigint end,
        'after', p_allocation_sen));
  end if;
  if v_before_members is distinct from v_after_members then
    perform private.append_business_audit(v_club_id, 'Department access updated', 'department',
      v_department.id, p_activity_id, v_department.id,
      jsonb_build_object('before', v_before_members, 'after', v_after_members));
  end if;
  return v_department.id;
end;
$$;
revoke all on function public.save_department_setup(uuid, uuid, text, text, text, bigint, uuid, uuid[])
  from public, anon, authenticated;
grant execute on function public.save_department_setup(uuid, uuid, text, text, text, bigint, uuid, uuid[])
  to authenticated;
