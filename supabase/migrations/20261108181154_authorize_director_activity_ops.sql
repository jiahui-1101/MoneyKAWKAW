create function private.require_club_director()
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_club_id uuid;
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  select c.id into v_club_id from public.clubs c
  join public.club_memberships m on m.club_id = c.id and m.user_id = auth.uid()
  join public.club_role_grants g on g.club_id = c.id and g.user_id = m.user_id
  where c.slug = 'main' and m.status = 'active' and g.role = 'Director';
  if not found then raise exception 'Director access required' using errcode = '42501'; end if;
  return v_club_id;
end;
$$;
revoke all on function private.require_club_director() from public, anon, authenticated;

create function private.append_business_audit(
  p_club_id uuid, p_action text, p_record_type text, p_record_id uuid,
  p_activity_id uuid, p_department_id uuid, p_changes jsonb
)
returns void language sql security definer set search_path = '' as $$
  insert into public.audit_events(
    club_id, actor_uid, action, record_type, record_id, activity_id, department_id, changes
  ) values (
    p_club_id, auth.uid(), p_action, p_record_type, p_record_id,
    p_activity_id, p_department_id, coalesce(p_changes, '{}'::jsonb)
  );
$$;
revoke all on function private.append_business_audit(uuid, text, text, uuid, uuid, uuid, jsonb)
  from public, anon, authenticated;

create function public.save_activity(
  p_id uuid, p_name text, p_description text, p_type public.activity_type,
  p_status public.activity_status, p_start_date date, p_end_date date, p_budget_sen bigint
)
returns public.activities
language plpgsql security definer set search_path = '' as $$
declare
  v_club_id uuid := private.require_club_director();
  v_currency public.currency_code;
  v_activity public.activities%rowtype;
  v_before jsonb;
begin
  if p_name is null or length(trim(p_name)) not between 1 and 100 or
     p_description is null or length(trim(p_description)) not between 1 and 2000 or
     p_type is null or p_status is null or p_start_date is null or p_end_date is null or
     p_end_date < p_start_date or p_budget_sen is null or
     p_budget_sen not between 1 and 100000000000 then
    raise exception 'Check the activity name, description, dates, type, status, and budget' using errcode = '22023';
  end if;
  select currency into v_currency from public.clubs where id = v_club_id;
  if p_id is null then
    insert into public.activities(
      club_id, name, description, type, status, start_date, end_date, budget_sen, currency
    ) values (
      v_club_id, trim(p_name), trim(p_description), p_type, p_status,
      p_start_date, p_end_date, p_budget_sen, v_currency
    ) returning * into v_activity;
    perform private.append_business_audit(v_club_id, 'Activity created', 'activity',
      v_activity.id, v_activity.id, null, jsonb_build_object('after', to_jsonb(v_activity)));
  else
    select * into v_activity from public.activities
      where id = p_id and club_id = v_club_id for update;
    if not found then raise exception 'Activity not found' using errcode = 'P0002'; end if;
    v_before := to_jsonb(v_activity);
    update public.activities set name = trim(p_name), description = trim(p_description),
      type = p_type, status = p_status, start_date = p_start_date, end_date = p_end_date,
      budget_sen = p_budget_sen, updated_at = now()
      where id = p_id and club_id = v_club_id returning * into v_activity;
    perform private.append_business_audit(v_club_id, 'Activity modified', 'activity',
      v_activity.id, v_activity.id, null,
      jsonb_build_object('before', v_before, 'after', to_jsonb(v_activity)));
  end if;
  return v_activity;
end;
$$;
revoke all on function public.save_activity(uuid, text, text, public.activity_type, public.activity_status, date, date, bigint)
  from public, anon, authenticated;
grant execute on function public.save_activity(uuid, text, text, public.activity_type, public.activity_status, date, date, bigint)
  to authenticated;
