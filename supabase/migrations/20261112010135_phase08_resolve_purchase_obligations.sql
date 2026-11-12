create or replace function private.department_finances(p_department uuid)
returns jsonb language sql stable security definer set search_path='' as $$
  with purchases as (
    select t.estimated_budget_sen estimate,c.status,c.claimed_amount_sen amount,c.approved_amount_sen approved
    from public.purchase_tasks t left join public.claims c on c.purchase_task_id=t.id and c.status<>'Draft'
    where t.department_id=p_department and t.status<>'Cancelled' and t.closing_resolution is null
  ), totals as (
    select coalesce(sum(estimate) filter(where status is null or status in ('Pending','Under Review','Rejected')),0) planned,
      coalesce(sum(estimate) filter(where status is null or status='Rejected'),0) unclaimed,
      coalesce(sum(amount) filter(where status in ('Pending','Under Review')),0) pending,
      coalesce(sum(approved) filter(where status in ('Approved','Payment Pending')),0) liability,
      coalesce(sum(approved) filter(where status in ('Paid','Received')),0) paid from purchases
  ) select jsonb_build_object('departmentId',d.id,'activityId',d.activity_id,'budget',d.allocation_sen,
      'planned',planned,'unclaimed',unclaimed,'pending',pending,'liability',liability,'paid',paid,
      'available',d.allocation_sen-unclaimed-pending-liability-paid,
      'remaining',d.allocation_sen-liability-paid)
    from public.departments d cross join totals where d.id=p_department;
$$;

create function public.resolve_closing_purchase(p_task uuid,p_reason text)
returns void language plpgsql security definer set search_path='' as $$
declare task public.purchase_tasks; activity_state text;
begin
  select * into task from public.purchase_tasks where id=p_task;
  if not found or not private.has_department_role(task.department_id,'HOD') then
    raise exception 'Assigned HOD access required' using errcode='42501';
  end if;
  select a.financial_state into activity_state from public.activities a where a.id=task.activity_id for update;
  select * into task from public.purchase_tasks where id=p_task for update;
  if not private.has_department_role(task.department_id,'HOD') then
    raise exception 'Assigned HOD access required' using errcode='42501';
  end if;
  if task.closing_resolution is not null then return; end if;
  if activity_state<>'Closing' or task.status not in ('Purchased','Completed') or
    exists(select 1 from public.claims c where c.purchase_task_id=task.id and c.status<>'Rejected') then
    raise exception 'Only purchased work with no reimbursement obligation can be resolved here' using errcode='23514';
  end if;
  if p_reason is null or length(trim(p_reason)) not between 3 and 500 then
    raise exception 'Explain why no reimbursement remains due' using errcode='22023';
  end if;
  update public.purchase_tasks set closing_resolution=jsonb_build_object(
    'kind','No reimbursement due','reason',trim(p_reason),'actor',auth.uid(),'at',now())
    where id=task.id returning * into task;
  perform private.append_business_audit(task.club_id,'Purchase obligation resolved','purchasing_task',
    task.id,task.activity_id,task.department_id,task.closing_resolution);
end;
$$;
revoke all on function public.resolve_closing_purchase(uuid,text) from public,anon;
grant execute on function public.resolve_closing_purchase(uuid,text) to authenticated;

create function public.reopen_activity_closing(p_activity uuid,p_revision bigint,p_reason text)
returns void language plpgsql security definer set search_path='' as $$
declare activity public.activities;
begin
  select * into activity from private.lock_closing_activity(p_activity,'Director');
  if activity.financial_state<>'Closing' or activity.closing_revision is distinct from p_revision then
    raise exception 'Refresh the current closing state before reopening' using errcode='40001';
  end if;
  if p_reason is null or length(trim(p_reason)) not between 3 and 500 then
    raise exception 'Explain why financial work must resume' using errcode='22023';
  end if;
  update public.activities set financial_state='Open',closing_revision=closing_revision+1 where id=activity.id;
  perform private.append_business_audit(activity.club_id,'Activity reopened for corrections','activity',
    activity.id,activity.id,null,jsonb_build_object('reason',trim(p_reason),'revision',p_revision));
end;
$$;
revoke all on function public.reopen_activity_closing(uuid,bigint,text) from public,anon;
grant execute on function public.reopen_activity_closing(uuid,bigint,text) to authenticated;
