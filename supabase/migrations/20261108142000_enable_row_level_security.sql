alter table public.clubs enable row level security;
alter table public.profiles enable row level security;
alter table public.club_memberships enable row level security;
alter table public.club_role_grants enable row level security;
alter table public.activities enable row level security;
alter table public.departments enable row level security;
alter table public.activity_memberships enable row level security;
alter table public.activity_role_grants enable row level security;
alter table public.department_memberships enable row level security;
alter table public.member_preferences enable row level security;
alter table public.invitations enable row level security;
alter table public.invitation_role_grants enable row level security;

revoke all on all tables in schema public from anon, authenticated;
alter default privileges in schema public revoke all on tables from anon, authenticated;
alter default privileges in schema public revoke all on sequences from anon, authenticated;
alter default privileges in schema public revoke execute on functions from public, anon, authenticated;
alter default privileges in schema private revoke execute on functions from public, anon, authenticated;
grant select on public.clubs, public.profiles, public.club_memberships, public.club_role_grants,
  public.activities, public.departments, public.activity_memberships, public.activity_role_grants,
  public.department_memberships, public.member_preferences to authenticated;
grant update (notification_enabled) on public.member_preferences to authenticated;

create policy clubs_read_member on public.clubs for select to authenticated
  using (exists (select 1 from public.club_memberships m where m.club_id = id and m.user_id = (select auth.uid()) and m.status = 'active'));
create policy profiles_read_scoped on public.profiles for select to authenticated
  using (exists (select 1 from public.club_memberships m
    where m.user_id = profiles.user_id and private.can_view_profile(m.user_id, m.club_id)));
create policy memberships_read_scoped on public.club_memberships for select to authenticated
  using (private.can_view_profile(user_id, club_id));
create policy own_club_roles_read on public.club_role_grants for select to authenticated
  using (user_id = (select auth.uid()) and private.can_view_profile(user_id, club_id));
create policy activities_read_scoped on public.activities for select to authenticated
  using (private.can_read_activity(id));
create policy departments_read_scoped on public.departments for select to authenticated
  using (private.can_read_department(id));
create policy activity_members_read_scoped on public.activity_memberships for select to authenticated
  using (private.can_read_activity(activity_id) and
    (user_id = (select auth.uid()) or private.has_club_role(club_id, 'Director') or private.has_club_role(club_id, 'Treasurer')));
create policy own_activity_roles_read on public.activity_role_grants for select to authenticated
  using (user_id = (select auth.uid()) and private.can_read_activity(activity_id));
create policy department_members_read_scoped on public.department_memberships for select to authenticated
  using (private.can_read_activity(activity_id) and
    (user_id = (select auth.uid()) or private.has_club_role(club_id, 'Director')
      or private.has_club_role(club_id, 'Treasurer') or private.is_hod_department_peer(department_id, user_id)));
create policy own_preferences_read on public.member_preferences for select to authenticated
  using (user_id = (select auth.uid()) and exists (select 1 from public.club_memberships m
    where m.user_id = (select auth.uid()) and m.status = 'active'));
create policy own_preferences_update on public.member_preferences for update to authenticated
  using (user_id = (select auth.uid()) and exists (select 1 from public.club_memberships m
    where m.user_id = (select auth.uid()) and m.status = 'active'))
  with check (user_id = (select auth.uid()) and exists (select 1 from public.club_memberships m
    where m.user_id = (select auth.uid()) and m.status = 'active'));

create function private.touch_member_preferences()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end;
$$;
revoke all on function private.touch_member_preferences() from public, anon, authenticated;
create trigger member_preferences_touch before update on public.member_preferences
  for each row execute function private.touch_member_preferences();
