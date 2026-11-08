create schema private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated;

create function private.has_club_role(p_club_id uuid, p_role public.club_role)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.club_role_grants g
    join public.club_memberships m using (club_id, user_id)
    where g.club_id = p_club_id and g.user_id = (select auth.uid())
      and g.role = p_role and m.status = 'active'
  );
$$;
create function private.has_activity_role(p_activity_id uuid, p_role public.activity_role)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.activity_role_grants g
    join public.activity_memberships a using (activity_id, club_id, user_id)
    join public.club_memberships c using (club_id, user_id)
    where g.activity_id = p_activity_id and g.user_id = (select auth.uid())
      and g.role = p_role and a.status = 'active' and c.status = 'active'
  );
$$;
create function private.has_department_role(p_department_id uuid, p_role public.department_role)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.department_memberships d
    join public.activity_memberships a using (activity_id, club_id, user_id)
    join public.club_memberships c using (club_id, user_id)
    where d.department_id = p_department_id and d.user_id = (select auth.uid())
      and d.role = p_role and d.status = 'active' and a.status = 'active' and c.status = 'active'
  );
$$;
create function private.can_read_activity(p_activity_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.activities a join public.club_memberships m using (club_id)
    where a.id = p_activity_id and m.user_id = (select auth.uid()) and m.status = 'active'
      and (private.has_club_role(a.club_id, 'Director') or private.has_club_role(a.club_id, 'Treasurer')
        or private.has_activity_role(a.id, 'Treasurer')
        or exists (select 1 from public.activity_memberships am where am.activity_id = a.id
          and am.user_id = (select auth.uid()) and am.status = 'active'))
  );
$$;
create function private.can_read_department(p_department_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.departments d
    where d.id = p_department_id and private.can_read_activity(d.activity_id)
      and (private.has_department_role(d.id, 'HOD') or private.has_department_role(d.id, 'Member')
        or private.has_club_role(d.club_id, 'Director') or private.has_club_role(d.club_id, 'Treasurer'))
  );
$$;
create function private.is_hod_department_peer(p_department_id uuid, p_user_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.department_memberships h
    join public.department_memberships p using (department_id, activity_id, club_id)
    join public.activity_memberships ha on ha.activity_id = h.activity_id and ha.user_id = h.user_id and ha.club_id = h.club_id
    join public.activity_memberships pa on pa.activity_id = p.activity_id and pa.user_id = p.user_id and pa.club_id = p.club_id
    join public.club_memberships hc on hc.club_id = h.club_id and hc.user_id = h.user_id
    join public.club_memberships pc on pc.club_id = p.club_id and pc.user_id = p.user_id
    where h.department_id = p_department_id and h.user_id = (select auth.uid()) and h.role = 'HOD'
      and p.user_id = p_user_id and h.status = 'active' and p.status = 'active'
      and ha.status = 'active' and pa.status = 'active' and hc.status = 'active' and pc.status = 'active'
  );
$$;
create function private.can_view_profile(p_user_id uuid, p_club_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.club_memberships target
    where target.club_id = p_club_id and target.user_id = p_user_id and target.status = 'active'
      and (p_user_id = (select auth.uid()) or private.has_club_role(p_club_id, 'Director')
        or private.has_club_role(p_club_id, 'Treasurer') or exists (
      select 1 from public.department_memberships h
      join public.department_memberships p using (department_id, activity_id, club_id)
      join public.activity_memberships ha on ha.activity_id = h.activity_id and ha.user_id = h.user_id and ha.club_id = h.club_id
      join public.activity_memberships pa on pa.activity_id = p.activity_id and pa.user_id = p.user_id and pa.club_id = p.club_id
      join public.club_memberships hc on hc.club_id = h.club_id and hc.user_id = h.user_id
      join public.club_memberships pc on pc.club_id = p.club_id and pc.user_id = p.user_id
      where h.club_id = p_club_id and p.club_id = p_club_id and h.user_id = (select auth.uid())
        and h.role = 'HOD' and p.user_id = p_user_id and h.status = 'active' and p.status = 'active'
        and ha.status = 'active' and pa.status = 'active' and hc.status = 'active' and pc.status = 'active'
      ))
  );
$$;

revoke all on all functions in schema private from public, anon;
grant execute on all functions in schema private to authenticated;
