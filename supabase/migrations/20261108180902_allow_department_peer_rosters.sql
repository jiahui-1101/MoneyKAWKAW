create function private.is_department_peer(p_department_id uuid, p_user_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.department_memberships me
    join public.activity_memberships me_activity
      using (activity_id, club_id, user_id)
    join public.club_memberships me_club using (club_id, user_id)
    join public.department_memberships peer
      on peer.department_id = me.department_id and peer.activity_id = me.activity_id
        and peer.club_id = me.club_id
    join public.activity_memberships peer_activity
      on peer_activity.activity_id = peer.activity_id and peer_activity.club_id = peer.club_id
        and peer_activity.user_id = peer.user_id
    join public.club_memberships peer_club
      on peer_club.club_id = peer.club_id and peer_club.user_id = peer.user_id
    where me.department_id = p_department_id and me.user_id = (select auth.uid())
      and me.role in ('HOD', 'Member') and me.status = 'active'
      and me_activity.status = 'active' and me_club.status = 'active'
      and peer.user_id = p_user_id and peer.status = 'active'
      and peer_activity.status = 'active' and peer_club.status = 'active'
  );
$$;
revoke all on function private.is_department_peer(uuid, uuid) from public, anon;
grant execute on function private.is_department_peer(uuid, uuid) to authenticated;

create or replace function private.can_view_profile(p_user_id uuid, p_club_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.club_memberships target
    where target.club_id = p_club_id and target.user_id = p_user_id and target.status = 'active'
      and (p_user_id = (select auth.uid()) or private.has_club_role(p_club_id, 'Director')
        or private.has_club_role(p_club_id, 'Treasurer') or exists (
          select 1 from public.department_memberships me
          where me.club_id = p_club_id and me.user_id = (select auth.uid())
            and me.status = 'active' and me.role in ('HOD', 'Member')
            and private.is_department_peer(me.department_id, p_user_id)
        ))
  );
$$;

drop policy department_members_read_scoped on public.department_memberships;
create policy department_members_read_scoped on public.department_memberships for select to authenticated
  using (private.can_read_activity(activity_id) and
    (user_id = (select auth.uid()) or private.has_club_role(club_id, 'Director')
      or private.has_club_role(club_id, 'Treasurer') or private.is_department_peer(department_id, user_id)));
