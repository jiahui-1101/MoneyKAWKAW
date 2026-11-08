create type public.club_role as enum ('Director', 'Treasurer');
create type public.department_role as enum ('HOD', 'Member');
create type public.activity_role as enum ('Treasurer');
create type public.currency_code as enum ('MYR', 'SGD', 'USD');
create type public.activity_type as enum ('Workshop', 'Large-scale event', 'Community', 'Other');
create type public.activity_status as enum ('Planning', 'Active', 'Completed');

create table public.clubs (
  id uuid primary key default gen_random_uuid(), slug text not null unique,
  name text not null check (length(trim(name)) between 1 and 120),
  currency public.currency_code not null default 'MYR', timezone text not null default 'Asia/Kuala_Lumpur',
  warning_percent smallint not null default 80 check (warning_percent between 1 and 100),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null check (length(trim(display_name)) between 1 and 120),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.club_memberships (
  club_id uuid not null references public.clubs(id) on delete restrict,
  user_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'active' check (status in ('active', 'suspended', 'revoked')),
  revision integer not null default 0 check (revision >= 0),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  primary key (club_id, user_id)
);
create table public.club_role_grants (
  club_id uuid not null, user_id uuid not null, role public.club_role not null,
  created_at timestamptz not null default now(), created_by uuid references auth.users(id) on delete set null,
  primary key (club_id, user_id, role),
  foreign key (club_id, user_id) references public.club_memberships(club_id, user_id) on delete cascade
);
create table public.activities (
  id uuid primary key default gen_random_uuid(), club_id uuid not null references public.clubs(id) on delete restrict,
  name text not null check (length(trim(name)) between 1 and 120), description text not null default '',
  type public.activity_type not null, status public.activity_status not null default 'Planning',
  start_date date not null, end_date date not null check (end_date >= start_date),
  budget_sen bigint not null check (budget_sen between 0 and 100000000000),
  currency public.currency_code not null default 'MYR',
  archived_at timestamptz, archived_by uuid references auth.users(id) on delete set null,
  retain_until timestamptz, legal_hold boolean not null default false,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique (id, club_id)
);
create table public.departments (
  id uuid primary key default gen_random_uuid(), club_id uuid not null, activity_id uuid not null,
  name text not null check (length(trim(name)) between 1 and 80), description text not null default '',
  head_label text not null default '', allocation_sen bigint not null check (allocation_sen between 0 and 100000000000),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique (id, activity_id, club_id),
  foreign key (activity_id, club_id) references public.activities(id, club_id) on delete restrict
);
create table public.activity_memberships (
  activity_id uuid not null, club_id uuid not null, user_id uuid not null,
  status text not null default 'active' check (status in ('active', 'suspended', 'revoked')),
  created_at timestamptz not null default now(),
  primary key (activity_id, user_id), unique (activity_id, user_id, club_id),
  foreign key (activity_id, club_id) references public.activities(id, club_id) on delete restrict,
  foreign key (club_id, user_id) references public.club_memberships(club_id, user_id) on delete cascade
);
create table public.activity_role_grants (
  activity_id uuid not null, club_id uuid not null, user_id uuid not null, role public.activity_role not null,
  created_at timestamptz not null default now(), created_by uuid references auth.users(id) on delete set null,
  primary key (activity_id, user_id, role),
  foreign key (activity_id, user_id, club_id) references public.activity_memberships(activity_id, user_id, club_id) on delete cascade
);
create table public.department_memberships (
  department_id uuid not null, activity_id uuid not null, club_id uuid not null, user_id uuid not null,
  role public.department_role not null, status text not null default 'active' check (status in ('active', 'suspended', 'revoked')),
  created_at timestamptz not null default now(), created_by uuid references auth.users(id) on delete set null,
  primary key (department_id, user_id),
  foreign key (department_id, activity_id, club_id) references public.departments(id, activity_id, club_id) on delete restrict,
  foreign key (activity_id, user_id, club_id) references public.activity_memberships(activity_id, user_id, club_id) on delete cascade
);
create table public.member_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  notification_enabled boolean not null default true, updated_at timestamptz not null default now()
);

create index activities_club_status_idx on public.activities(club_id, status, start_date);
create index departments_activity_idx on public.departments(activity_id, name);
create unique index departments_activity_name_idx on public.departments(activity_id, lower(name));
create index activity_memberships_user_idx on public.activity_memberships(user_id, status, activity_id);
create index department_memberships_user_idx on public.department_memberships(user_id, status, activity_id, department_id);
create index club_role_grants_user_idx on public.club_role_grants(user_id, club_id, role);
