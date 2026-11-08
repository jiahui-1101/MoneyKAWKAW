create table public.audit_events (
  id uuid primary key default gen_random_uuid(), club_id uuid not null references public.clubs(id) on delete restrict,
  actor_uid uuid not null references auth.users(id) on delete restrict,
  action text not null check (length(trim(action)) between 1 and 80),
  record_type text not null check (length(trim(record_type)) between 1 and 80), record_id uuid not null,
  activity_id uuid, department_id uuid, changes jsonb not null default '{}'::jsonb
    check (jsonb_typeof(changes) = 'object'), created_at timestamptz not null default now(),
  check (department_id is null or activity_id is not null),
  foreign key (activity_id, club_id) references public.activities(id, club_id) on delete restrict,
  foreign key (department_id, activity_id, club_id) references public.departments(id, activity_id, club_id) on delete restrict
);
create index audit_events_club_time_idx on public.audit_events(club_id, created_at desc);
create index audit_events_scope_idx on public.audit_events(activity_id, department_id, created_at desc);
alter table public.audit_events enable row level security;
revoke all on public.audit_events from anon, authenticated;

create table public.archive_records (
  id uuid primary key default gen_random_uuid(), club_id uuid not null references public.clubs(id) on delete restrict,
  entity_type text not null check (entity_type in ('activity', 'department', 'purchasing_task', 'claim', 'receipt', 'reimbursement')),
  entity_id uuid not null, activity_id uuid, department_id uuid,
  archived_at timestamptz not null default now(), archived_by uuid references auth.users(id) on delete set null,
  retain_until timestamptz, legal_hold boolean not null default false,
  created_at timestamptz not null default now(),
  check (department_id is null or activity_id is not null),
  foreign key (activity_id, club_id) references public.activities(id, club_id) on delete restrict,
  foreign key (department_id, activity_id, club_id) references public.departments(id, activity_id, club_id) on delete restrict,
  unique (club_id, entity_type, entity_id)
);
create index archive_records_retention_idx on public.archive_records(retain_until) where legal_hold = false;
alter table public.archive_records enable row level security;
revoke all on public.archive_records from anon, authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('receipts', 'receipts', false, 10485760, array['image/jpeg','image/png','image/webp','application/pdf']),
  ('payment-proofs', 'payment-proofs', false, 10485760, array['image/jpeg','image/png','image/webp','application/pdf']),
  ('financial-archive', 'financial-archive', false, 52428800, array['image/jpeg','image/png','image/webp','application/pdf'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy club_evidence_private_select on storage.objects as restrictive for select to public
  using (bucket_id not in ('receipts', 'payment-proofs', 'financial-archive'));
create policy club_evidence_private_insert on storage.objects as restrictive for insert to public
  with check (bucket_id not in ('receipts', 'payment-proofs', 'financial-archive'));
create policy club_evidence_private_update on storage.objects as restrictive for update to public
  using (bucket_id not in ('receipts', 'payment-proofs', 'financial-archive'))
  with check (bucket_id not in ('receipts', 'payment-proofs', 'financial-archive'));
create policy club_evidence_private_delete on storage.objects as restrictive for delete to public
  using (bucket_id not in ('receipts', 'payment-proofs', 'financial-archive'));
