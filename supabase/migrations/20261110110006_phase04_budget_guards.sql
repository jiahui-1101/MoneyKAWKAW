create function private.guard_claim_linked_task()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  if exists(select 1 from public.claims where purchase_task_id=old.id and status<>'Draft') and
    (new.item_name,new.description,new.assigned_member_id,new.estimated_budget_sen,new.status) is distinct from
    (old.item_name,old.description,old.assigned_member_id,old.estimated_budget_sen,old.status) then
    raise exception 'Submitted claim-linked purchases are protected' using errcode='23514'; end if;
  return new;
end;
$$;
create trigger purchase_tasks_claim_guard before update on public.purchase_tasks for each row execute function private.guard_claim_linked_task();
create function private.guard_financial_budget()
returns trigger language plpgsql security definer set search_path='' as $$
declare v_activity uuid; v_department uuid; v_available numeric; v_budget bigint;
begin
  if tg_table_name='activities' then v_activity:=new.id;
  else v_activity:=new.activity_id;
    if tg_table_name='departments' then v_department:=new.id; else v_department:=new.department_id; end if;
  end if;
  select budget_sen into v_budget from public.activities where id=v_activity for update;
  if v_department is not null then
    perform 1 from public.departments where id=v_department for update;
    select (private.department_finances(v_department)->>'available')::numeric into v_available;
    if v_available<0 then raise exception 'Financial exposure exceeds department allocation' using errcode='23514'; end if;
  end if;
  select v_budget-coalesce(sum((f->>'unclaimed')::numeric+(f->>'pending')::numeric+(f->>'liability')::numeric+(f->>'paid')::numeric),0)
    into v_available from public.departments d cross join lateral (select private.department_finances(d.id) f) q where d.activity_id=v_activity;
  if v_available<0 then raise exception 'Financial exposure exceeds activity budget' using errcode='23514'; end if;
  return new;
end;
$$;
create trigger purchase_tasks_financial_guard after insert or update on public.purchase_tasks for each row execute function private.guard_financial_budget();
create trigger departments_financial_guard after update on public.departments for each row execute function private.guard_financial_budget();
create trigger activities_financial_guard after update on public.activities for each row execute function private.guard_financial_budget();
revoke all on function private.guard_claim_linked_task(),private.guard_financial_budget() from public,anon,authenticated;

create function public.read_financial_notification(p_notification_id uuid)
returns void language plpgsql security definer set search_path='' as $$
begin
  update public.financial_notifications set read_at=coalesce(read_at,now()) where id=p_notification_id
    and recipient_uid=(select auth.uid()) and private.can_read_claim(claim_id);
  if not found then raise exception 'Notification unavailable' using errcode='42501'; end if;
end;
$$;
create function public.abandon_payment_proof(p_proof_id uuid)
returns text language plpgsql security definer set search_path='' as $$
declare p public.payment_proofs%rowtype; c public.claims%rowtype;
begin
  select * into p from public.payment_proofs where id=p_proof_id;
  select * into c from public.claims where id=p.claim_id for update;
  if not found or c.status<>'Payment Pending' or c.claimant_user_id=(select auth.uid()) or
    p.uploaded_by<>(select auth.uid()) or not private.is_claim_treasurer(c.id) or p.upload_status='retained' then
    raise exception 'Only owned staged payment proof can be abandoned' using errcode='42501'; end if;
  update public.payment_proofs set upload_status='abandoned' where id=p.id;
  return p.storage_path;
end;
$$;
revoke all on function public.read_financial_notification(uuid),public.abandon_payment_proof(uuid) from public,anon;
grant execute on function public.read_financial_notification(uuid),public.abandon_payment_proof(uuid) to authenticated;
