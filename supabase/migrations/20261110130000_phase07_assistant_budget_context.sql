create function private.assistant_budget(p_role text,p_kind text,p_id uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare a public.activities%rowtype; d public.departments%rowtype; f jsonb; totals jsonb;
begin
  if p_kind='ACTIVITY' then
    select * into a from public.activities where id=p_id;
    if not found or not ((p_role='Director' and private.has_club_role(a.club_id,'Director')) or
      (p_role='Treasurer' and (private.has_club_role(a.club_id,'Treasurer') or private.has_activity_role(a.id,'Treasurer')))) then
      raise exception 'Activity context unavailable' using errcode='42501'; end if;
    select jsonb_build_object('budget_sen',a.budget_sen,'allocated_sen',coalesce(sum(dep.allocation_sen),0),
      'unclaimed_sen',coalesce(sum((q.f->>'unclaimed')::bigint),0),'pending_sen',coalesce(sum((q.f->>'pending')::bigint),0),
      'liability_sen',coalesce(sum((q.f->>'liability')::bigint),0),'paid_sen',coalesce(sum((q.f->>'paid')::bigint),0),
      'available_sen',a.budget_sen-coalesce(sum((q.f->>'unclaimed')::bigint+(q.f->>'pending')::bigint+
        (q.f->>'liability')::bigint+(q.f->>'paid')::bigint),0)) into totals
      from public.departments dep cross join lateral(select private.department_finances(dep.id) f) q where dep.activity_id=a.id;
    return jsonb_build_object('values',totals);
  end if;
  select * into d from public.departments where id=p_id;
  if not found or not ((p_role='HOD' and private.has_department_role(d.id,'HOD')) or
    (p_role='Member' and private.has_department_role(d.id,'Member'))) then
    raise exception 'Department context unavailable' using errcode='42501'; end if;
  f:=private.department_finances(d.id);
  totals:=jsonb_build_object('budget_sen',(f->>'budget')::bigint,'available_sen',(f->>'available')::bigint,
    'unclaimed_sen',(f->>'unclaimed')::bigint,'pending_sen',(f->>'pending')::bigint,
    'liability_sen',(f->>'liability')::bigint,'paid_sen',(f->>'paid')::bigint);
  if p_kind='TASKS' then
    select totals||jsonb_build_object('open_tasks',count(*) filter(where status in ('Not Started','In Progress')),
      'overdue_tasks',count(*) filter(where status in ('Not Started','In Progress') and due_date<current_date))
      into totals from public.purchase_tasks where department_id=d.id;
    return jsonb_build_object('values',totals,'details',jsonb_build_object('tasks',coalesce((
      select jsonb_agg(jsonb_build_object('id',x.id,'item',left(x.item_name,120),'status',x.status,'due',x.due_date))
      from (select id,item_name,status,due_date from public.purchase_tasks where department_id=d.id
        and status in ('Not Started','In Progress') order by due_date,id limit 10) x),'[]'::jsonb)));
  end if;
  return jsonb_build_object('values',totals);
end;
$$;
revoke all on function private.assistant_budget(text,text,uuid) from public,anon,authenticated;
