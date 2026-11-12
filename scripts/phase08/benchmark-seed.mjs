import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';

const groups = {
  tasks: 'purchase_tasks',
  claims: 'claims',
  receipts: 'claim_receipts',
  items: 'claim_items',
  receiptModifications: 'receipt_modifications',
  claimHistory: 'claim_status_history',
  destinations: 'claim_payment_destinations',
  proofs: 'payment_proofs',
  payments: 'reimbursement_payments',
  notifications: 'financial_notifications',
  audit: 'audit_events',
};
const uuid = /[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}/g;

export function scaleFixture(sample, fixture, count) {
  assert.equal(sample.records.claims.length, 1);
  assert.equal(sample.records.claims[0].status, 'Received');
  assert.equal(sample.records.evidence.length, 2);
  const source = Object.fromEntries(Object.keys(groups).map((key) => [key, sample.records[key] ?? []]));
  source.audit = source.audit.filter((row) => ['claim','purchasing_task'].includes(row.record_type));
  const output = Object.fromEntries([...Object.keys(groups), 'evidence'].map((key) => [key, []]));
  for (let i = 0; i < count; i++) {
    const ids = new Map([
      [sample.activity.id, fixture.activityId],
      [sample.records.departments[0].id, fixture.multimediaId],
    ]);
    for (const records of Object.values(source)) for (const row of records) ids.set(row.id, randomUUID());
    const clone = (rows) => JSON.parse(JSON.stringify(rows).replace(uuid, (id) => ids.get(id) ?? id));
    for (const [key, rows] of Object.entries(source)) output[key].push(...clone(rows));
    output.evidence.push(...clone(sample.records.evidence));
  }
  for (const task of output.tasks) task.request_key = randomUUID();
  for (const claim of output.claims) {
    claim.idempotency_key = randomUUID();
    claim.submission_key = randomUUID();
    output.destinations.push({
      claim_id: claim.id, owner_uid: claim.claimant_user_id, selected_by: claim.claimant_user_id,
      label: 'Synthetic benchmark account', kind: 'Bank', holder: 'Synthetic Member',
      institution: 'Test Bank', identifier: '0000000011113210', masked: 'Bank •••• 3210',
      selected_at: claim.submitted_at,
    });
  }
  for (const payment of output.payments) {
    payment.request_key = randomUUID();
    payment.reference = 'SYNTHETIC-SCALE-' + payment.id;
  }
  return output;
}

export function seedLocalRows(rows, activityId, hodId) {
  const valid = /^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/;
  assert.ok(valid.test(hodId) && valid.test(activityId));
  const base64 = Buffer.from(JSON.stringify(rows)).toString('base64');
  const inserts = Object.entries(groups).map(([key, table]) =>
    "insert into public." + table + " select r.* from benchmark_input cross join lateral " +
    "jsonb_populate_recordset(null::public." + table + ", data->'" + key + "') r;").join('\n');
  const metrics = "select jsonb_build_object('rows',count(*),'tupleBytes',coalesce(sum(bytes),0)) from (" +
    Object.entries(groups).map(([key, table]) => {
      if (key === 'audit' || key === 'tasks' || key === 'claims')
        return "select pg_column_size(t) bytes from public." + table + " t where t.activity_id='" + activityId + "'";
      return "select pg_column_size(t) bytes from public." + table +
        " t join public.claims c on c.id=t.claim_id where c.activity_id='" + activityId + "'";
    }).join(' union all ') + ") totals;";
  const sql = "\\set benchmark_base64 '" + base64 + "'\n" +
    "begin; create temporary table benchmark_input(data jsonb) on commit drop;\n" +
    "insert into benchmark_input values (convert_from(decode(:'benchmark_base64','base64'),'UTF8')::jsonb);\n" +
    "set local request.jwt.claim.sub='" + hodId + "';\n" + inserts + "\n" + metrics + "\ncommit;";
  const result = spawnSync('docker', ['exec','-i','supabase_db_MoneyKAWKAW','psql','-U','postgres','-d','postgres','-qAt','-v','ON_ERROR_STOP=1'],
    { input: sql, encoding: 'utf8', windowsHide: true });
  if (result.error || result.status !== 0) throw new Error((result.stderr || result.error?.message || 'Local benchmark fixture failed').trim());
  return JSON.parse(result.stdout);
}
