alter type public.activity_type add value if not exists 'Small Event';

create type public.purchase_task_status as enum (
  'Not Started', 'In Progress', 'Purchased', 'Completed', 'Cancelled'
);
create type public.purchase_priority as enum ('Low', 'Medium', 'High');

alter table public.department_memberships
  add constraint department_memberships_scope_key
  unique (department_id, activity_id, club_id, user_id);

create table public.purchase_tasks (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs(id) on delete restrict,
  activity_id uuid not null,
  department_id uuid not null,
  item_name text not null check (length(trim(item_name)) between 1 and 120),
  description text not null check (length(trim(description)) between 1 and 2000),
  assigned_member_id uuid not null,
  created_by_hod uuid not null references auth.users(id) on delete restrict,
  request_key uuid not null,
  estimated_budget_sen bigint not null check (estimated_budget_sen between 1 and 100000000000),
  due_date date not null,
  priority public.purchase_priority not null default 'Medium',
  status public.purchase_task_status not null default 'Not Started',
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (created_by_hod, request_key),
  unique (id, activity_id, department_id, club_id),
  foreign key (activity_id, club_id) references public.activities(id, club_id) on delete restrict,
  foreign key (department_id, activity_id, club_id)
    references public.departments(id, activity_id, club_id) on delete restrict,
  foreign key (department_id, activity_id, club_id, assigned_member_id)
    references public.department_memberships(department_id, activity_id, club_id, user_id) on delete restrict
);

create index purchase_tasks_department_status_due_idx
  on public.purchase_tasks(department_id, status, due_date);
create index purchase_tasks_assignee_status_due_idx
  on public.purchase_tasks(assigned_member_id, status, due_date);
create index purchase_tasks_activity_idx on public.purchase_tasks(activity_id, created_at desc);

alter table public.purchase_tasks enable row level security;
revoke all on public.purchase_tasks from public, anon, authenticated;
grant select on public.purchase_tasks to authenticated;
create policy purchase_tasks_read_department on public.purchase_tasks for select to authenticated
  using (private.can_read_department(department_id));

grant select on public.audit_events to authenticated;
create policy audit_events_read_scope on public.audit_events for select to authenticated
  using (
    private.has_club_role(club_id, 'Director') or private.has_club_role(club_id, 'Treasurer') or
    (department_id is not null and
      (private.has_department_role(department_id, 'HOD') or private.has_department_role(department_id, 'Member')))
  );
