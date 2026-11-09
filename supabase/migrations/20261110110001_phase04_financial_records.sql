do $$ declare v_name text; begin
  select conname into v_name from pg_constraint where conrelid='public.claims'::regclass
    and contype='c' and pg_get_constraintdef(oid) like '%submitted_at%';
  execute format('alter table public.claims drop constraint %I',v_name);
end $$;
alter table public.claims add constraint claims_submission_state_check
  check ((status='Draft' and submitted_at is null) or (status<>'Draft' and submitted_at is not null));
drop index public.claims_one_active_per_task_idx;
create unique index claims_one_per_task_idx on public.claims(purchase_task_id);
alter table public.claims add column reviewer_uid uuid references auth.users(id);
alter table public.claims add column review_started_at timestamptz;
alter table public.claims add column decided_at timestamptz;
alter table public.claims add column decision_reason text not null default '';
alter table public.claims add column approved_amount_sen bigint check (approved_amount_sen>0);
alter table public.claims add column risk_assessment jsonb;
alter table public.claims add column decision_risk jsonb;

create table public.financial_requests (
  id uuid primary key, claim_id uuid not null references public.claims(id),
  actor_uid uuid not null references auth.users(id), action text not null, payload jsonb not null,
  created_at timestamptz not null default now()
);
alter table public.financial_requests enable row level security;
revoke all on public.financial_requests from public,anon,authenticated;
create table public.payment_proofs (
  id uuid primary key default gen_random_uuid(), claim_id uuid not null references public.claims(id),
  uploaded_by uuid not null references auth.users(id), storage_path text not null unique,
  filename text not null, mime_type text not null check (mime_type in ('image/png','image/jpeg')),
  size_bytes bigint not null check (size_bytes between 8 and 1048576),
  sha256 text not null check (sha256 ~ '^[a-f0-9]{64}$'),
  upload_status text not null default 'uploading' check (upload_status in ('uploading','ready','abandoned','retained')),
  created_at timestamptz not null default now(), finalized_at timestamptz,
  unique(id,claim_id)
);
create index payment_proofs_claim_idx on public.payment_proofs(claim_id);
create table public.reimbursement_payments (
  id uuid primary key default gen_random_uuid(), claim_id uuid not null unique references public.claims(id),
  approved_amount_sen bigint not null check (approved_amount_sen>0),
  amount_sen bigint not null check (amount_sen=approved_amount_sen),
  reference text not null check (length(trim(reference)) between 3 and 120),
  payment_date date not null, recorded_by uuid not null references auth.users(id),
  proof_id uuid not null unique, request_key uuid not null unique,
  recorded_at timestamptz not null default now(), received_at timestamptz, received_by uuid references auth.users(id),
  discrepancy_reason text, discrepancy_amount_sen bigint check (discrepancy_amount_sen>=0), discrepancy_at timestamptz,
  resolution_note text, resolved_at timestamptz,
  foreign key (proof_id,claim_id) references public.payment_proofs(id,claim_id)
);
create table public.financial_notifications (
  id uuid primary key default gen_random_uuid(), recipient_uid uuid not null references auth.users(id),
  claim_id uuid not null references public.claims(id), title text not null, detail text not null,
  created_at timestamptz not null default now(), read_at timestamptz
);
create index financial_notifications_recipient_time_idx on public.financial_notifications(recipient_uid,created_at desc);
alter table public.payment_proofs enable row level security;
alter table public.reimbursement_payments enable row level security;
alter table public.financial_notifications enable row level security;
revoke all on public.payment_proofs,public.reimbursement_payments,public.financial_notifications from public,anon,authenticated;
grant select on public.payment_proofs,public.reimbursement_payments,public.financial_notifications to authenticated;

create function private.is_claim_treasurer(p_claim_id uuid)
returns boolean language sql stable security definer set search_path='' as $$
  select exists(select 1 from public.claims c where c.id=p_claim_id and
    (private.has_club_role(c.club_id,'Treasurer') or private.has_activity_role(c.activity_id,'Treasurer')));
$$;
create or replace function private.can_read_claim(p_claim_id uuid)
returns boolean language sql stable security definer set search_path='' as $$
  select exists(select 1 from public.claims c where c.id=p_claim_id and
    ((c.claimant_user_id=(select auth.uid()) and private.has_department_role(c.department_id,'Member'))
      or (c.status<>'Draft' and private.is_claim_treasurer(c.id))));
$$;
revoke all on function private.is_claim_treasurer(uuid) from public,anon;
grant execute on function private.is_claim_treasurer(uuid) to authenticated;
create policy payment_proofs_private_read on public.payment_proofs for select to authenticated
  using (private.can_read_claim(claim_id));
create policy payments_private_read on public.reimbursement_payments for select to authenticated
  using (private.can_read_claim(claim_id));
create policy notifications_owner_read on public.financial_notifications for select to authenticated
  using (recipient_uid=(select auth.uid()) and private.can_read_claim(claim_id));

create function private.financial_request(p_key uuid,p_claim uuid,p_action text,p_payload jsonb)
returns boolean language plpgsql security definer set search_path='' as $$
declare v public.financial_requests%rowtype;
begin
  if p_key is null or (select auth.uid()) is null then raise exception 'A signed-in request key is required' using errcode='42501'; end if;
  select * into v from public.financial_requests where id=p_key;
  if found then
    if v.claim_id<>p_claim or v.actor_uid<>(select auth.uid()) or v.action<>p_action or v.payload<>p_payload then
      raise exception 'Request key already used for another operation' using errcode='23505'; end if;
    return true;
  end if;
  insert into public.financial_requests(id,claim_id,actor_uid,action,payload) values(p_key,p_claim,(select auth.uid()),p_action,p_payload);
  return false;
end;
$$;
revoke all on function private.financial_request(uuid,uuid,text,jsonb) from public,anon,authenticated;
