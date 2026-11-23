-- Forward-only compatibility fix: stale application versions are HTTP 409 conflicts.
-- Never signal retryable PostgreSQL serialization failure for a permanent stale input.
-- Exact baseline guards prevent silently editing drifted or unexpected functions.
do $migration$
declare r record; v_oid regprocedure; v_definition text; v_changed integer := 0;
begin
  for r in select * from (values
    ('public.correct_my_claim_receipt_total(uuid, timestamp with time zone, bigint, text)','7480fcdb9fd8b9e0452b784a001c1ab5',1),
    ('public.decide_activity_reconciliation(uuid, uuid, bigint, uuid, boolean, text)','c5dd339141e1eb10c3648d31f5503b8f',1),
    ('public.edit_my_claim_item(uuid, timestamp with time zone, uuid, jsonb, boolean, text, receipt_modification_type)','76c86a9c7ec9728806594d946bef26da',1),
    ('public.finalize_activity_archive_object(uuid, uuid, text, bigint, text, text, bigint, integer, bigint)','af724326202507a3cfc4eb385a3755ac',1),
    ('public.prepare_claim_receipt(uuid, timestamp with time zone, text, text, bigint, text)','aa44fe32e7d3472f2f14aac801a46573',1),
    ('public.record_reimbursement(uuid, timestamp with time zone, uuid, bigint, date, text, uuid, text, boolean)','1081ab790d9693cc2027a6c1168a1451',2),
    ('public.reopen_activity_closing(uuid, bigint, text)','62d1323c75d45320ff9374dcf5e4a4ca',1),
    ('public.retain_claim_pressure_advice(uuid, timestamp with time zone, text, numeric, jsonb, jsonb)','da5292d61af6ee1bb2a13648087587f8',2),
    ('public.save_my_claim_baseline(uuid, timestamp with time zone, uuid, text, date, bigint, text, text, jsonb)','04ba9c1081e80c58c8763975636a638d',1),
    ('public.save_my_claim_preferences(uuid, timestamp with time zone, uuid, text)','448336cd22e17f01d8644078f29bc9e1',1),
    ('public.save_my_payment_account(uuid, timestamp with time zone, text, text, text, text, text, boolean)','c1ffc614ac6b651996b2033520b35579',1),
    ('public.save_purchase_task(uuid, uuid, uuid, uuid, text, text, uuid, bigint, date, purchase_priority, timestamp with time zone)','382fd19d1dedbf896e449aeb59fab0cb',1),
    ('public.sign_activity_reconciliation(uuid, bigint, uuid)','13377c7cddae0526834fa29aebb85faf',1),
    ('public.submit_my_claim(uuid, timestamp with time zone, timestamp with time zone, timestamp with time zone, uuid)','a241dd1997121a2cebf0e8c7704529ed',3),
    ('public.transition_claim(uuid, claim_status, timestamp with time zone, uuid, text)','99887dbbb4269efc4d1d6dc488c45c98',1),
    ('public.update_hod_purchase_task_status(uuid, purchase_task_status, timestamp with time zone)','5a10f9d3d359812caed2b3d10ef49f5f',1),
    ('public.update_my_purchase_progress(uuid, purchase_task_status, timestamp with time zone)','1f01652212bff5f60bf9ce6eee8c83da',1)
  ) as reviewed(signature, expected_md5, replacements)
  loop
    v_oid := to_regprocedure(r.signature);
    if v_oid is null then raise exception 'Reviewed conflict function missing: %', r.signature; end if;
    v_definition := pg_get_functiondef(v_oid);
    if md5(v_definition) <> r.expected_md5 then
      raise exception 'Conflict function differs from reviewed baseline: %', r.signature;
    end if;
    if (length(v_definition)-length(replace(v_definition, '''40001''', '')))/7 <> r.replacements then
      raise exception 'Unexpected conflict replacement count: %', r.signature;
    end if;
    execute replace(v_definition, '''40001''', '''PT409''');
    v_changed := v_changed + r.replacements;
  end loop;
  if v_changed <> 21 then raise exception 'Incomplete reviewed conflict migration'; end if;
end;
$migration$;
