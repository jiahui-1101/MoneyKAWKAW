create table public.receipt_modifications (
  id uuid primary key default gen_random_uuid(), claim_id uuid not null references public.claims(id),
  receipt_id uuid not null references public.claim_receipts(id), claim_item_id uuid references public.claim_items(id),
  field_changed text not null, before_value jsonb not null, after_value jsonb not null,
  modification_type public.receipt_modification_type not null, reason text not null,
  modified_by uuid not null references auth.users(id), created_at timestamptz not null default now(),
  check (length(trim(field_changed)) between 1 and 80), check (length(trim(reason)) between 3 and 500)
);
create index receipt_modifications_claim_idx on public.receipt_modifications(claim_id, created_at);
create table public.claim_status_history (
  id uuid primary key default gen_random_uuid(), claim_id uuid not null references public.claims(id),
  from_status public.claim_status, to_status public.claim_status not null,
  actor_uid uuid not null references auth.users(id), detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index claim_status_history_claim_idx on public.claim_status_history(claim_id, created_at);

create table public.payment_accounts (
  id uuid primary key default gen_random_uuid(), club_id uuid not null references public.clubs(id),
  owner_uid uuid not null references auth.users(id), label text not null, kind text not null,
  holder text not null, institution text not null, identifier text not null, masked text not null,
  is_default boolean not null default false, revision integer not null default 0,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  check (kind in ('Bank','TNG')), check (length(trim(label)) between 1 and 80),
  check (length(trim(holder)) between 1 and 100), check (length(trim(identifier)) between 4 and 34)
);
create unique index payment_accounts_one_default_idx on public.payment_accounts(owner_uid) where is_default;
create index payment_accounts_owner_idx on public.payment_accounts(owner_uid, updated_at desc);
create table public.claim_payment_destinations (
  claim_id uuid primary key references public.claims(id), account_id uuid references public.payment_accounts(id),
  owner_uid uuid not null references auth.users(id), label text not null, kind text not null,
  holder text not null, institution text not null, identifier text not null, masked text not null,
  selected_at timestamptz not null default now(), selected_by uuid not null references auth.users(id),
  check (kind in ('Bank','TNG'))
);

alter table public.receipt_modifications enable row level security;
alter table public.claim_status_history enable row level security;
alter table public.payment_accounts enable row level security;
alter table public.claim_payment_destinations enable row level security;
revoke all on public.receipt_modifications, public.claim_status_history, public.payment_accounts,
  public.claim_payment_destinations from public, anon, authenticated;

create function private.can_read_claim(p_claim_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.claims c where c.id = p_claim_id and
    ((c.claimant_user_id = (select auth.uid()) and private.has_department_role(c.department_id, 'Member'))
      or private.has_club_role(c.club_id, 'Treasurer')));
$$;
revoke all on function private.can_read_claim(uuid) from public, anon;
grant execute on function private.can_read_claim(uuid) to authenticated;

grant select on public.claims, public.claim_receipts, public.claim_items,
  public.receipt_modifications, public.claim_status_history to authenticated;
create policy claims_owner_treasurer_read on public.claims for select to authenticated
  using (private.can_read_claim(id));
create policy claim_receipts_owner_treasurer_read on public.claim_receipts for select to authenticated
  using (private.can_read_claim(claim_id));
create policy claim_items_owner_treasurer_read on public.claim_items for select to authenticated
  using (private.can_read_claim(claim_id));
create policy receipt_modifications_owner_treasurer_read on public.receipt_modifications for select to authenticated
  using (private.can_read_claim(claim_id));
create policy claim_status_history_owner_treasurer_read on public.claim_status_history for select to authenticated
  using (private.can_read_claim(claim_id));
