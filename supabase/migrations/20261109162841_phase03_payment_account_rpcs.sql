alter table public.payment_accounts add constraint payment_accounts_member_fk
  foreign key (club_id,owner_uid) references public.club_memberships(club_id,user_id) on delete restrict;
alter table public.claims add column draft_payment_account_id uuid references public.payment_accounts(id) on delete set null;
alter table public.claims add column submission_key uuid unique;

create function private.can_manage_payment_accounts()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.club_memberships c join public.department_memberships d using (club_id,user_id)
    where c.user_id=(select auth.uid()) and c.status='active' and d.role='Member' and d.status='active');
$$;
revoke all on function private.can_manage_payment_accounts() from public,anon;
grant execute on function private.can_manage_payment_accounts() to authenticated;

create function public.list_my_payment_accounts()
returns table(id uuid,label text,kind text,holder text,institution text,masked text,is_default boolean,
  updated_at timestamptz,revision integer,in_use boolean)
language sql stable security definer set search_path = '' as $$
  select a.id,a.label,a.kind,a.holder,a.institution,a.masked,a.is_default,a.updated_at,a.revision,
    exists(select 1 from public.claims c where c.draft_payment_account_id=a.id and c.status='Draft') or
    exists(select 1 from public.claim_payment_destinations d where d.account_id=a.id) as in_use
  from public.payment_accounts a where a.owner_uid=(select auth.uid()) and private.can_manage_payment_accounts()
  order by a.is_default desc,a.updated_at desc;
$$;
create function public.get_my_payment_account(p_account_id uuid)
returns table(id uuid,label text,kind text,holder text,institution text,identifier text,is_default boolean,
  updated_at timestamptz,revision integer)
language sql stable security definer set search_path = '' as $$
  select a.id,a.label,a.kind,a.holder,a.institution,a.identifier,a.is_default,a.updated_at,a.revision
  from public.payment_accounts a where a.id=p_account_id and a.owner_uid=(select auth.uid())
    and private.can_manage_payment_accounts();
$$;

create function public.save_my_payment_account(p_account_id uuid,p_expected_updated_at timestamptz,
  p_label text,p_kind text,p_holder text,p_institution text,p_identifier text,p_is_default boolean)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_account public.payment_accounts%rowtype; v_club uuid; v_id uuid; v_masked text; v_value text; v_at timestamptz;
begin
  if (select auth.uid()) is null or not private.can_manage_payment_accounts() then raise exception 'Payment accounts are available to active club Members' using errcode='42501'; end if;
  select id into v_club from public.clubs where slug='main';
  if p_label is null or length(trim(p_label)) not between 1 and 80 or p_holder is null or length(trim(p_holder)) not between 1 and 100 or
     p_kind is null or p_kind not in ('Bank','TNG') or p_identifier is null then raise exception 'Enter valid account details' using errcode='22023'; end if;
  v_value:=trim(p_identifier);
  if (p_kind='Bank' and v_value !~ '^[A-Za-z0-9 -]{6,34}$') or
     (p_kind='TNG' and regexp_replace(v_value,'[ -]','','g') !~ '^\+?[0-9]{8,15}$') or
     (p_kind='Bank' and (p_institution is null or length(trim(p_institution)) not between 1 and 80)) then
    raise exception 'Account identifier or institution is invalid' using errcode='22023';
  end if;
  v_masked:=case when p_kind='Bank' then 'Bank' else 'TNG' end||' •••• '||right(regexp_replace(v_value,'[ -]','','g'),4);
  if p_account_id is not null then
    select * into v_account from public.payment_accounts where id=p_account_id and owner_uid=(select auth.uid()) for update;
    if not found then raise exception 'Payment account unavailable for your profile' using errcode='42501'; end if;
    if v_account.updated_at is distinct from p_expected_updated_at then raise exception 'Payment account changed. Reload before editing.' using errcode='40001'; end if;
  end if;
  v_id:=coalesce(p_account_id,gen_random_uuid()); v_at:=greatest(date_trunc('milliseconds',clock_timestamp()),coalesce(v_account.updated_at,'-infinity'::timestamptz)+interval '1 millisecond');
  if p_is_default or not exists(select 1 from public.payment_accounts where owner_uid=(select auth.uid())) then
    update public.payment_accounts set is_default=false where owner_uid=(select auth.uid());
  end if;
  insert into public.payment_accounts (id,club_id,owner_uid,label,kind,holder,institution,identifier,masked,is_default,updated_at)
    values (v_id,v_club,(select auth.uid()),trim(p_label),p_kind,trim(p_holder),
      case when p_kind='TNG' then 'Touch ’n Go eWallet' else trim(p_institution) end,v_value,v_masked,
      p_is_default or not exists(select 1 from public.payment_accounts where owner_uid=(select auth.uid())),v_at)
  on conflict (id) do update set label=excluded.label,kind=excluded.kind,holder=excluded.holder,
    institution=excluded.institution,identifier=excluded.identifier,masked=excluded.masked,
    is_default=excluded.is_default,revision=payment_accounts.revision+1,updated_at=excluded.updated_at;
  insert into public.audit_events (club_id,actor_uid,action,record_type,record_id,changes)
    values (v_club,(select auth.uid()),case when p_account_id is null then 'Payment account added' else 'Payment account updated' end,
      'payment_account',v_id,jsonb_build_object('label',trim(p_label),'masked',v_masked));
  return v_id;
end;
$$;

create function public.set_my_payment_account_default(p_account_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not private.can_manage_payment_accounts() then raise exception 'Payment account unavailable' using errcode='42501'; end if;
  if not exists(select 1 from public.payment_accounts where id=p_account_id and owner_uid=(select auth.uid())) then raise exception 'Payment account unavailable' using errcode='42501'; end if;
  update public.payment_accounts set is_default=(id=p_account_id),revision=revision+1,
    updated_at=greatest(date_trunc('milliseconds',clock_timestamp()),updated_at+interval '1 millisecond') where owner_uid=(select auth.uid());
  insert into public.audit_events (club_id,actor_uid,action,record_type,record_id,changes)
    select club_id,(select auth.uid()),'Default payment account changed','payment_account',id,
      jsonb_build_object('label',label,'masked',masked,'is_default',is_default)
    from public.payment_accounts where id=p_account_id;
end;
$$;
create function public.remove_my_payment_account(p_account_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare v_account public.payment_accounts%rowtype; v_other uuid;
begin
  select * into v_account from public.payment_accounts where id=p_account_id and owner_uid=(select auth.uid()) for update;
  if not found or not private.can_manage_payment_accounts() then raise exception 'Payment account unavailable' using errcode='42501'; end if;
  if exists(select 1 from public.claims where draft_payment_account_id=p_account_id) or exists(select 1 from public.claim_payment_destinations where account_id=p_account_id) then raise exception 'This account is referenced by a draft or submitted claim' using errcode='23514'; end if;
  delete from public.payment_accounts where id=p_account_id;
  insert into public.audit_events (club_id,actor_uid,action,record_type,record_id,changes)
    values (v_account.club_id,(select auth.uid()),'Unused payment account removed','payment_account',p_account_id,
      jsonb_build_object('label',v_account.label,'masked',v_account.masked));
  if v_account.is_default then
    select id into v_other from public.payment_accounts where owner_uid=(select auth.uid()) order by created_at limit 1;
    if v_other is not null then update public.payment_accounts set is_default=true where id=v_other; end if;
  end if;
end;
$$;

create function private.capture_default_payment_account()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  select id into new.draft_payment_account_id from public.payment_accounts
    where owner_uid=new.claimant_user_id and is_default limit 1;
  return new;
end;
$$;
revoke all on function private.capture_default_payment_account() from public,anon,authenticated;
create trigger claims_capture_default_payment_account before insert on public.claims
  for each row execute function private.capture_default_payment_account();

create function public.save_my_claim_preferences(p_claim_id uuid,p_expected_updated_at timestamptz,
  p_account_id uuid,p_justification text)
returns timestamptz language plpgsql security definer set search_path = '' as $$
declare v_claim public.claims%rowtype; v_at timestamptz;
begin
  select * into v_claim from public.claims where id=p_claim_id for update;
  if not found or v_claim.claimant_user_id<>(select auth.uid()) or v_claim.status<>'Draft' or not private.has_department_role(v_claim.department_id,'Member') then raise exception 'Claim draft unavailable' using errcode='42501'; end if;
  if v_claim.updated_at<>p_expected_updated_at then raise exception 'Draft changed. Reload before saving.' using errcode='40001'; end if;
  if length(coalesce(p_justification,''))>1000 then raise exception 'Keep the explanation within 1,000 characters' using errcode='22023'; end if;
  if p_account_id is not null and not exists(select 1 from public.payment_accounts where id=p_account_id and owner_uid=(select auth.uid())) then raise exception 'Select one of your saved payment accounts' using errcode='42501'; end if;
  v_at:=greatest(date_trunc('milliseconds',clock_timestamp()),v_claim.updated_at+interval '1 millisecond');
  update public.claims set draft_payment_account_id=p_account_id,over_budget_justification=trim(coalesce(p_justification,'')),
    revision=revision+1,updated_at=v_at where id=p_claim_id;
  return v_at;
end;
$$;

create function public.my_claim_destination(p_claim_id uuid)
returns table(label text,kind text,holder text,institution text,masked text,selected_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select d.label,d.kind,d.holder,d.institution,d.masked,d.selected_at
  from public.claim_payment_destinations d join public.claims c on c.id=d.claim_id
  where d.claim_id=p_claim_id and private.can_read_claim(c.id);
$$;

revoke all on function public.list_my_payment_accounts(),public.get_my_payment_account(uuid),
  public.save_my_payment_account(uuid,timestamptz,text,text,text,text,text,boolean),
  public.set_my_payment_account_default(uuid),public.remove_my_payment_account(uuid),
  public.save_my_claim_preferences(uuid,timestamptz,uuid,text),public.my_claim_destination(uuid) from public,anon;
grant execute on function public.list_my_payment_accounts(),public.get_my_payment_account(uuid),
  public.save_my_payment_account(uuid,timestamptz,text,text,text,text,text,boolean),
  public.set_my_payment_account_default(uuid),public.remove_my_payment_account(uuid),
  public.save_my_claim_preferences(uuid,timestamptz,uuid,text),public.my_claim_destination(uuid) to authenticated;
