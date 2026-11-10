-- Retain advice separately from authoritative financial decisions. Client scores
-- are untrusted evidence of what was displayed, never an approval input.
create table public.claim_pressure_advice (
  id uuid primary key default gen_random_uuid(),
  claim_id uuid not null references public.claims(id) on delete restrict,
  claim_revision integer not null,
  actor_uid uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  model_version text not null,
  feature_schema text not null default 'budget-pressure-v1',
  feature_hash text not null,
  feature_snapshot jsonb not null,
  score numeric not null check(score between 0 and 1),
  contributions jsonb not null,
  experimental boolean not null default true check(experimental),
  provenance text not null default 'unverified_client_advisory' check(provenance='unverified_client_advisory'),
  unique(claim_id,claim_revision,model_version,feature_hash)
);
alter table public.claim_pressure_advice enable row level security;
revoke all on public.claim_pressure_advice from public,anon,authenticated;
grant select on public.claim_pressure_advice to authenticated;
create policy pressure_advice_treasurer_read on public.claim_pressure_advice for select to authenticated
  using(private.is_claim_treasurer(claim_id) and exists(select 1 from public.claims c
    where c.id=claim_id and c.claimant_user_id<>(select auth.uid())));
create index claim_pressure_advice_time_idx on public.claim_pressure_advice(claim_id,created_at desc);

create function public.retain_claim_pressure_advice(p_claim_id uuid,p_expected_updated_at timestamptz,
  p_model_version text,p_score numeric,p_contributions jsonb)
returns uuid language plpgsql security definer set search_path='' as $$
declare s jsonb; v_hash text; v_id uuid;
begin
  -- The existing snapshot function independently checks current role/scope/owner.
  perform 1 from public.claims where id=p_claim_id for update;
  s:=public.claim_pressure_snapshot(p_claim_id);
  if (s->>'updatedAt')::timestamptz is distinct from p_expected_updated_at then
    raise exception 'Claim changed. Refresh before retaining advice.' using errcode='40001';
  end if;
  if p_model_version is null or p_model_version !~ '^pressure-v1:[a-f0-9]{12}$'
    or p_score is null or not(p_score between 0 and 1) or p_contributions is null
    or jsonb_typeof(p_contributions)<>'array' or jsonb_array_length(p_contributions)<>14 then
    raise exception 'Invalid experimental advice' using errcode='22023';
  end if;
  if exists(select 1 from jsonb_array_elements(p_contributions) x
    where jsonb_typeof(x)<>'number' or length(x::text)>30) then
    raise exception 'Invalid feature contributions' using errcode='22023';
  end if;
  v_hash:=encode(sha256(convert_to((s->'raw')::text,'UTF8')),'hex');
  insert into public.claim_pressure_advice(claim_id,claim_revision,actor_uid,model_version,
    feature_hash,feature_snapshot,score,contributions)
    values(p_claim_id,(s->>'revision')::integer,(select auth.uid()),p_model_version,v_hash,s,p_score,p_contributions)
    on conflict(claim_id,claim_revision,model_version,feature_hash) do nothing returning id into v_id;
  if v_id is null then select id into v_id from public.claim_pressure_advice where claim_id=p_claim_id
    and claim_revision=(s->>'revision')::integer and model_version=p_model_version and feature_hash=v_hash; end if;
  return v_id;
end;
$$;
revoke all on function public.retain_claim_pressure_advice(uuid,timestamptz,text,numeric,jsonb) from public,anon;
grant execute on function public.retain_claim_pressure_advice(uuid,timestamptz,text,numeric,jsonb) to authenticated;
