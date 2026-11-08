create function public.current_club_session()
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'uid', u.user_id, 'name', p.display_name, 'active', true, 'revision', u.revision,
    'clubName', c.name,
    'roles', coalesce((
      select jsonb_agg(distinct assigned.role) from (
        select g.role::text as role from public.club_role_grants g where g.club_id = u.club_id and g.user_id = u.user_id
        union all
        select g.role::text from public.activity_role_grants g
          join public.activity_memberships a using (activity_id, club_id, user_id)
          where g.club_id = u.club_id and g.user_id = u.user_id and a.status = 'active'
        union all
        select g.role::text from public.department_memberships g
          join public.activity_memberships a using (activity_id, club_id, user_id)
          where g.club_id = u.club_id and g.user_id = u.user_id and g.status = 'active' and a.status = 'active'
      ) assigned
    ), '[]'::jsonb),
    'departmentScopes', coalesce((
      select jsonb_agg(jsonb_build_object('activityId', d.activity_id, 'departmentId', d.department_id, 'role', d.role))
      from public.department_memberships d join public.activity_memberships a using (activity_id, club_id, user_id)
      where d.club_id = u.club_id and d.user_id = u.user_id and d.status = 'active' and a.status = 'active'
    ), '[]'::jsonb),
    'activityIds', coalesce((
      select jsonb_agg(distinct a.activity_id) from public.activity_memberships a
      where a.club_id = u.club_id and a.user_id = u.user_id and a.status = 'active'
    ), '[]'::jsonb)
  )
  from public.club_memberships u
  join public.clubs c on c.id = u.club_id
  join public.profiles p on p.user_id = u.user_id
  where u.user_id = (select auth.uid()) and u.status = 'active' and c.slug = 'main'
  limit 1;
$$;

revoke all on function public.current_club_session() from public, anon;
grant execute on function public.current_club_session() to authenticated;
