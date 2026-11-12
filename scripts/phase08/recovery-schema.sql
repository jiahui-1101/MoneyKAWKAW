begin;
create temporary table source_package (document jsonb not null);
insert into source_package values (convert_from(decode(:'package_base64','base64'),'UTF8')::jsonb);

create table restored_activity (id uuid primary key, budget bigint not null check (budget>=0), data jsonb not null);
create table restored_departments (id uuid primary key, activity_id uuid not null references restored_activity,
  allocation bigint not null check (allocation>=0), data jsonb not null);
create table restored_tasks (id uuid primary key, department_id uuid not null references restored_departments,
  data jsonb not null, unique(id,department_id));
create table restored_claims (id uuid primary key, task_id uuid not null unique, department_id uuid not null,
  status text not null check(status in ('Received','Rejected')), amount bigint not null check(amount>0), data jsonb not null,
  foreign key(task_id,department_id) references restored_tasks(id,department_id));
create table restored_files (id uuid primary key, kind text not null check(kind in ('receipts','proofs')),
  claim_id uuid not null references restored_claims, data jsonb not null, unique(id,claim_id));
create table restored_payments (id uuid primary key, claim_id uuid not null unique references restored_claims,
  proof_id uuid not null unique, amount bigint not null check(amount>0), data jsonb not null,
  foreign key(proof_id,claim_id) references restored_files(id,claim_id));
create table restored_claim_history (kind text not null, id uuid not null, claim_id uuid not null references restored_claims,
  receipt_id uuid, data jsonb not null, primary key(kind,id),
  foreign key(receipt_id,claim_id) references restored_files(id,claim_id));
create table restored_manifest (record_id uuid primary key, claim_id uuid not null,
  bucket text not null, path text not null, bytes bigint not null, sha256 text not null, data jsonb not null,
  unique(bucket,path), foreign key(record_id,claim_id) references restored_files(id,claim_id));
create table restored_audit (id uuid primary key, activity_id uuid not null references restored_activity,
  department_id uuid references restored_departments, at timestamptz not null, data jsonb not null);
create table restored_membership (kind text not null, user_id uuid not null, activity_id uuid not null references restored_activity,
  department_id uuid references restored_departments, data jsonb not null);
create table restored_signoff (activity_id uuid primary key references restored_activity,
  reconciliation jsonb not null, approval jsonb not null);

insert into restored_activity select (a->>'id')::uuid,(a->>'budget_sen')::bigint,a
  from source_package cross join lateral (select document->'activity' as a) value;
insert into restored_departments select (r->>'id')::uuid,(r->>'activity_id')::uuid,(r->>'allocation_sen')::bigint,r
  from source_package cross join lateral jsonb_array_elements(document->'records'->'departments') r;
insert into restored_tasks select (r->>'id')::uuid,(r->>'department_id')::uuid,r
  from source_package cross join lateral jsonb_array_elements(document->'records'->'tasks') r;
insert into restored_claims select (r->>'id')::uuid,(r->>'purchase_task_id')::uuid,(r->>'department_id')::uuid,
  r->>'status',(r->>'claimed_amount_sen')::bigint,r
  from source_package cross join lateral jsonb_array_elements(document->'records'->'claims') r;
insert into restored_files select (r->>'id')::uuid,kind,(r->>'claim_id')::uuid,r
  from source_package cross join (values('receipts'),('proofs')) groups(kind)
  cross join lateral jsonb_array_elements(document->'records'->kind) r;
insert into restored_payments select (r->>'id')::uuid,(r->>'claim_id')::uuid,(r->>'proof_id')::uuid,(r->>'amount_sen')::bigint,r
  from source_package cross join lateral jsonb_array_elements(document->'records'->'payments') r;
insert into restored_claim_history select kind,coalesce(r->>'id',r->>'claim_id')::uuid,
  (r->>'claim_id')::uuid,(r->>'receipt_id')::uuid,r
  from source_package cross join (values('items'),('receiptModifications'),('claimHistory'),
    ('notifications'),('advisories'),('paymentMethods')) groups(kind)
  cross join lateral jsonb_array_elements(document->'records'->kind) r;
insert into restored_manifest select (r->>'record_id')::uuid,(r->>'claim_id')::uuid,r->>'bucket',r->>'path',
  (r->>'bytes')::bigint,r->>'sha256',r
  from source_package cross join lateral jsonb_array_elements(document->'records'->'evidence') r;
insert into restored_audit select (r->>'id')::uuid,(r->>'activity_id')::uuid,(r->>'department_id')::uuid,
  (r->>'created_at')::timestamptz,r
  from source_package cross join lateral jsonb_array_elements(document->'records'->'audit') r;
insert into restored_membership select kind,(r->>'user_id')::uuid,(r->>'activity_id')::uuid,(r->>'department_id')::uuid,r
  from source_package cross join (values('activityMemberships'),('departmentMemberships'),('activityRoles')) groups(kind)
  cross join lateral jsonb_array_elements(document->'records'->kind) r;
insert into restored_signoff select (document->'activity'->>'id')::uuid,document->'reconciliation',document->'approval'
  from source_package;

with restored as (
  select 'departments' as kind,data from restored_departments
  union all select 'tasks',data from restored_tasks
  union all select 'claims',data from restored_claims
  union all select kind,data from restored_files
  union all select 'payments',data from restored_payments
  union all select kind,data from restored_claim_history
  union all select 'evidence',data from restored_manifest
  union all select 'audit',data from restored_audit
  union all select kind,data from restored_membership
), differences as (
  select e.key,e.value as data from source_package
    cross join lateral jsonb_each(document->'records') g
    cross join lateral jsonb_array_elements(g.value) e(value)
    cross join lateral (select g.key as key) unused
)
select jsonb_build_object(
  'budget',(select budget from restored_activity),
  'allocated',(select coalesce(sum(allocation),0) from restored_departments),
  'paid',(select coalesce(sum(amount),0) from restored_payments),
  'paymentCount',(select count(*) from restored_payments),
  'evidenceCount',(select count(*) from restored_manifest),
  'auditCount',(select count(*) from restored_audit),
  'sourceRows',(select count(*) from differences),
  'restoredRows',(select count(*) from restored),
  'exactRows',not exists (select kind,data from restored except all select key,data from differences)
    and not exists (select key,data from differences except all select kind,data from restored),
  'badPayments',(select count(*) from restored_payments p join restored_claims c on c.id=p.claim_id
    join restored_files f on f.id=p.proof_id
    where c.status<>'Received' or f.kind<>'proofs' or p.amount<>c.amount
      or p.amount is distinct from (c.data->>'approved_amount_sen')::bigint
      or p.data->>'received_at' is null
      or p.data->>'received_by' is distinct from c.data->>'claimant_user_id'),
  'missingPayments',(select count(*) from restored_claims c left join restored_payments p on p.claim_id=c.id
    where c.status='Received' and p.id is null),
  'auditBoundariesExist',not exists(select 1 from restored_signoff s,
    lateral jsonb_array_elements_text(jsonb_build_array(s.reconciliation->'facts'->'audit'->'first',
      s.reconciliation->'facts'->'audit'->'last')) bound(value)
    where bound.value is not null and not exists(select 1 from restored_audit where id::text=bound.value))
);
commit;
