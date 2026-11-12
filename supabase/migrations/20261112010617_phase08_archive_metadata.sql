alter table public.archive_records
  add column reconciliation_id uuid references public.activity_reconciliations(id) on delete restrict,
  add column approval_id uuid references public.activity_closing_decisions(id) on delete restrict,
  add column format_version integer,
  add column archive_state text not null default 'Legacy' check (archive_state in ('Legacy','Staging','Finalized')),
  add column source_revision bigint,
  add column object_path text unique,
  add column source_text text,
  add column logical_bytes bigint check (logical_bytes>0),
  add column compressed_bytes bigint check (compressed_bytes>0),
  add column logical_sha256 text check (logical_sha256 ~ '^[0-9a-f]{64}$'),
  add column compressed_sha256 text check (compressed_sha256 ~ '^[0-9a-f]{64}$'),
  add column verification_state text not null default 'Pending' check (verification_state in ('Pending','Verified','Failed')),
  add column checked_at timestamptz,
  add column failure_code text,
  add column verified_evidence_count integer check (verified_evidence_count>=0),
  add column evidence_bytes bigint check (evidence_bytes>=0);

revoke all on public.archive_records from public,anon,authenticated,service_role;

update storage.buckets set allowed_mime_types=array_append(allowed_mime_types,'application/gzip')
  where id='financial-archive' and not ('application/gzip'=any(allowed_mime_types));
