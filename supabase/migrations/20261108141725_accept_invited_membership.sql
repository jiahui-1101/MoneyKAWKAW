create or replace function public.accept_club_invitation()
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_email text;
  v_confirmed_at timestamptz;
  v_metadata jsonb;
  v_name text;
  v_invitation public.invitations%rowtype;
begin
  if v_uid is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  select lower(email), email_confirmed_at, raw_user_meta_data
    into v_email, v_confirmed_at, v_metadata from auth.users where id = v_uid;
  if v_confirmed_at is null or v_email is null then return false; end if;
  if exists (select 1 from public.club_memberships where user_id = v_uid and status = 'active') then return true; end if;
  if exists (select 1 from public.club_memberships where user_id = v_uid) then return false; end if;
  select * into v_invitation from public.invitations
    where email = v_email and accepted_at is null and revoked_at is null and expires_at > now()
    order by created_at limit 1 for update;
  if not found then return false; end if;
  v_name := left(coalesce(nullif(trim(v_metadata ->> 'full_name'), ''), nullif(trim(v_metadata ->> 'name'), ''), split_part(v_email, '@', 1)), 120);
  insert into public.profiles(user_id, display_name) values (v_uid, v_name)
    on conflict (user_id) do update set display_name = excluded.display_name, updated_at = now();
  insert into public.club_memberships(club_id, user_id) values (v_invitation.club_id, v_uid);
  insert into public.member_preferences(user_id) values (v_uid) on conflict do nothing;
  insert into public.activity_memberships(activity_id, club_id, user_id)
    select distinct activity_id, club_id, v_uid from public.invitation_role_grants
    where invitation_id = v_invitation.id and activity_id is not null on conflict do nothing;
  insert into public.club_role_grants(club_id, user_id, role, created_by)
    select club_id, v_uid, club_role, v_invitation.invited_by from public.invitation_role_grants
    where invitation_id = v_invitation.id and club_role is not null on conflict do nothing;
  insert into public.activity_role_grants(activity_id, club_id, user_id, role, created_by)
    select g.activity_id, g.club_id, v_uid, g.activity_role, v_invitation.invited_by
    from public.invitation_role_grants g where g.invitation_id = v_invitation.id and g.activity_role is not null
    on conflict do nothing;
  insert into public.department_memberships(department_id, activity_id, club_id, user_id, role, created_by)
    select department_id, activity_id, club_id, v_uid, department_role, v_invitation.invited_by
    from public.invitation_role_grants where invitation_id = v_invitation.id and department_role is not null
    on conflict do nothing;
  update public.invitations set accepted_by = v_uid, accepted_at = now() where id = v_invitation.id;
  return true;
end;
$$;

revoke all on function public.accept_club_invitation() from public, anon;
grant execute on function public.accept_club_invitation() to authenticated;
