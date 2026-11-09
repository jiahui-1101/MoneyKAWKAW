create type public.claim_status as enum ('Draft', 'Pending');
create type public.receipt_upload_status as enum ('uploading', 'ready', 'abandoned');
create type public.receipt_modification_type as enum
  ('OCR Correction', 'Item Exclusion', 'Item Inclusion', 'Amount Adjustment', 'Description Correction');

create table public.claims (
  id uuid primary key default gen_random_uuid(), club_id uuid not null references public.clubs(id),
  activity_id uuid not null, department_id uuid not null, purchase_task_id uuid not null,
  claimant_user_id uuid not null references auth.users(id), status public.claim_status not null default 'Draft',
  original_receipt_total_sen bigint, extracted_items_total_sen bigint, claimed_amount_sen bigint,
  item_budget_sen_snapshot bigint not null, over_budget_amount_sen bigint not null default 0,
  over_budget_justification text not null default '', revision integer not null default 0,
  idempotency_key uuid not null, submitted_at timestamptz, created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, activity_id, department_id, club_id), unique (claimant_user_id, idempotency_key),
  foreign key (purchase_task_id, activity_id, department_id, club_id)
    references public.purchase_tasks(id, activity_id, department_id, club_id) on delete restrict,
  check (item_budget_sen_snapshot > 0),
  check (original_receipt_total_sen is null or original_receipt_total_sen between 0 and 100000000000),
  check (claimed_amount_sen is null or claimed_amount_sen between 0 and 100000000000),
  check (over_budget_amount_sen between 0 and 100000000000),
  check ((status = 'Draft' and submitted_at is null) or (status = 'Pending' and submitted_at is not null))
);
create unique index claims_one_active_per_task_idx on public.claims(purchase_task_id)
  where status in ('Draft', 'Pending');
create index claims_member_status_idx on public.claims(claimant_user_id, status, updated_at desc);
create index claims_treasurer_queue_idx on public.claims(club_id, status, submitted_at desc);

create table public.claim_receipts (
  id uuid primary key default gen_random_uuid(), claim_id uuid not null references public.claims(id) on delete restrict,
  storage_path text not null unique, original_filename text not null, mime_type text not null,
  size_bytes bigint, sha256 text, uploaded_by uuid not null references auth.users(id),
  upload_status public.receipt_upload_status not null default 'uploading', uploaded_at timestamptz,
  merchant text, purchase_date date, original_total_sen bigint, ocr_status text not null default 'pending',
  ocr_engine text, ocr_version text, extraction jsonb, created_at timestamptz not null default now(),
  check (mime_type in ('image/png', 'image/jpeg')), check (size_bytes is null or size_bytes between 1 and 1048576),
  check (sha256 is null or sha256 ~ '^[0-9a-f]{64}$'), check (ocr_status in ('pending','complete','manual','failed')),
  unique (id, claim_id)
);
create unique index claim_receipts_single_active_idx on public.claim_receipts(claim_id)
  where upload_status in ('uploading', 'ready');
create index claim_receipts_claim_idx on public.claim_receipts(claim_id);

create table public.claim_items (
  id uuid primary key default gen_random_uuid(), claim_id uuid not null references public.claims(id) on delete restrict,
  receipt_id uuid not null, original_description text not null, corrected_description text not null,
  original_quantity_milli integer, corrected_quantity_milli integer,
  original_unit_price_sen bigint, corrected_unit_price_sen bigint,
  original_line_total_sen bigint not null, corrected_line_total_sen bigint not null,
  included boolean not null default true, exclusion_reason text not null default '', line_kind text not null default 'item',
  original_ocr_reference text, revision integer not null default 0,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  foreign key (receipt_id, claim_id) references public.claim_receipts(id, claim_id) on delete restrict,
  check (line_kind in ('item','tax','discount')),
  check (original_line_total_sen between 0 and 100000000000 and corrected_line_total_sen between 0 and 100000000000),
  check (original_unit_price_sen is null or original_unit_price_sen between 0 and 100000000000),
  check (corrected_unit_price_sen is null or corrected_unit_price_sen between 0 and 100000000000),
  check ((original_quantity_milli is null or original_quantity_milli > 0) and (corrected_quantity_milli is null or corrected_quantity_milli > 0))
);
create index claim_items_claim_idx on public.claim_items(claim_id, created_at);

alter table public.claims enable row level security;
alter table public.claim_receipts enable row level security;
alter table public.claim_items enable row level security;
revoke all on public.claims, public.claim_receipts, public.claim_items from public, anon, authenticated;
