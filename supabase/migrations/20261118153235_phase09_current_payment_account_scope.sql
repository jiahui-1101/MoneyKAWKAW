create or replace function private.can_manage_payment_accounts()
returns boolean language sql stable security definer set search_path='' as $$
  select exists (
    select 1 from public.department_memberships d
    where d.user_id=(select auth.uid()) and d.role='Member'
      and private.has_department_role(d.department_id,'Member')
  );
$$;
revoke all on function private.can_manage_payment_accounts() from public,anon;
grant execute on function private.can_manage_payment_accounts() to authenticated;
