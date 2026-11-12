alter table public.purchase_tasks add column closing_resolution jsonb;

create function private.guard_activity_financial_write()
returns trigger language plpgsql security definer set search_path='' as $$
declare
  before_row jsonb;
  after_row jsonb;
  record_row jsonb;
  activity_id_for_write uuid;
  activity_state text;
begin
  if tg_op<>'INSERT' then before_row:=to_jsonb(old); end if;
  if tg_op<>'DELETE' then after_row:=to_jsonb(new); end if;
  record_row:=coalesce(after_row,before_row);
  if tg_op='UPDATE' and (
    before_row->'activity_id' is distinct from after_row->'activity_id' or
    before_row->'claim_id' is distinct from after_row->'claim_id'
  ) then raise exception 'Financial record scope is immutable' using errcode='23514'; end if;
  activity_id_for_write:=(record_row->>'activity_id')::uuid;
  if activity_id_for_write is null then
    select c.activity_id into activity_id_for_write from public.claims c
      where c.id=(record_row->>'claim_id')::uuid;
  end if;
  -- Existing RPCs may already hold child locks. A busy parent means retry.
  select a.financial_state into activity_state from public.activities a
    where a.id=activity_id_for_write for update nowait;
  if not found then raise exception 'Activity unavailable' using errcode='23514'; end if;

  if activity_state<>'Open' then
    if activity_state='Archived' and tg_table_name in ('activity_memberships','department_memberships')
      and tg_op='UPDATE' and after_row->>'status'='revoked'
      and (after_row-array['status','updated_at'])=(before_row-array['status','updated_at']) then
      return new;
    end if;
    if activity_state<>'Closing' or tg_op='DELETE'
      or tg_table_name in ('departments','activity_memberships','department_memberships','activity_role_grants')
      or (tg_table_name='claims' and tg_op='INSERT')
      or (tg_table_name='purchase_tasks' and (
        tg_op='INSERT' or
        (after_row-array['status','completed_at','updated_at','closing_resolution'])
          is distinct from (before_row-array['status','completed_at','updated_at','closing_resolution']) or
        (after_row->>'status'<>before_row->>'status' and after_row->>'status' not in ('Cancelled','Completed'))
      )) then
      raise exception 'This financial operation is frozen during activity closing' using errcode='23514';
    end if;
    update public.activities set closing_revision=closing_revision+1 where id=activity_id_for_write;
  end if;
  if tg_op='DELETE' then return old; end if;
  return new;
end;
$$;
revoke all on function private.guard_activity_financial_write() from public,anon,authenticated;

do $$
declare table_name text;
begin
  foreach table_name in array array[
    'departments','activity_memberships','department_memberships','activity_role_grants',
    'purchase_tasks','claims','claim_receipts','claim_items','receipt_modifications',
    'claim_payment_destinations','claim_status_history','payment_proofs',
    'reimbursement_payments','claim_pressure_advice'
  ] loop
    execute format('create trigger phase08_financial_freeze before insert or update or delete on public.%I
      for each row execute function private.guard_activity_financial_write()',table_name);
  end loop;
end;
$$;
