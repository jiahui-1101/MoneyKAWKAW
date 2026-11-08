create table public.invitations (
  id uuid primary key default gen_random_uuid(), club_id uuid not null references public.clubs(id) on delete restrict,
  email text not null check (email = lower(trim(email)) and position('@' in email) > 1),
  invited_by uuid references auth.users(id) on delete set null, expires_at timestamptz not null,
  accepted_by uuid references auth.users(id) on delete set null, accepted_at timestamptz,
  revoked_at timestamptz, created_at timestamptz not null default now(),
  unique (id, club_id), check ((accepted_by is null) = (accepted_at is null))
);
create unique index invitations_pending_email_idx on public.invitations(club_id, email)
  where accepted_at is null and revoked_at is null;
create table public.invitation_role_grants (
  id uuid primary key default gen_random_uuid(), invitation_id uuid not null, club_id uuid not null,
  club_role public.club_role, activity_role public.activity_role, department_role public.department_role,
  activity_id uuid, department_id uuid, created_at timestamptz not null default now(),
  foreign key (invitation_id, club_id) references public.invitations(id, club_id) on delete cascade,
  foreign key (activity_id, club_id) references public.activities(id, club_id) on delete cascade,
  foreign key (department_id, activity_id, club_id) references public.departments(id, activity_id, club_id) on delete cascade,
  check (
    (club_role is not null and num_nonnulls(club_role, activity_role, department_role) = 1 and activity_id is null and department_id is null)
    or (activity_role is not null and num_nonnulls(club_role, activity_role, department_role) = 1 and activity_id is not null and department_id is null)
    or (department_role is not null and num_nonnulls(club_role, activity_role, department_role) = 1 and activity_id is not null and department_id is not null)
  )
);
create unique index invitation_club_grant_idx on public.invitation_role_grants(invitation_id, club_role) where club_role is not null;
create unique index invitation_activity_grant_idx on public.invitation_role_grants(invitation_id, activity_id, activity_role) where activity_role is not null;
create unique index invitation_department_grant_idx on public.invitation_role_grants(invitation_id, department_id, department_role) where department_role is not null;
