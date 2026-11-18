import assert from 'node:assert/strict';
import test from 'node:test';
import { spawnSync } from 'node:child_process';
import { readPages } from '../../src/services/supabase/pages.ts';
import { signIn, syntheticEmails } from './helpers.mjs';
import { archiveFixture } from './phase08-fixture.mjs';
import { ok } from './phase04-fixture.mjs';

test('scoped financial reads retrieve 1005 stored tasks beyond the default API row limit', async () => {
  const fixture = await archiveFixture('Phase09 pagination');
  const hod = ok(await fixture.hod.auth.getUser()).user.id;
  const uuids = [fixture.activityId, fixture.multimediaId, fixture.memberId, hod];
  assert.ok(uuids.every((value) => /^[a-f0-9-]{36}$/.test(value)));
  const sql = `begin;
    set local request.jwt.claim.sub='${hod}';
    insert into public.purchase_tasks(club_id,activity_id,department_id,item_name,description,
      assigned_member_id,created_by_hod,estimated_budget_sen,due_date,priority,status,request_key)
    select a.club_id,a.id,'${fixture.multimediaId}','Stored task '||n,'Synthetic bounded pagination',
      '${fixture.memberId}','${hod}',1,'2026-12-20','Medium','Not Started',gen_random_uuid()
    from public.activities a cross join generate_series(1,1005) n where a.id='${fixture.activityId}';
    commit;`;
  const seeded = spawnSync('docker', ['exec','-i','supabase_db_MoneyKAWKAW','psql','-U','postgres','-d','postgres','-qAt','-v','ON_ERROR_STOP=1'],
    { input: sql, encoding: 'utf8', windowsHide: true });
  assert.equal(seeded.status, 0, seeded.stderr);
  const query = (client) => client.from('purchase_tasks').select('id,assigned_member_id')
    .eq('activity_id', fixture.activityId).order('id');
  assert.equal(ok(await query(fixture.member)).length, 1000);
  const rows = ok(await readPages(() => query(fixture.member)));
  assert.equal(rows.length, 1005);
  assert.equal(new Set(rows.map((row) => row.id)).size, 1005);
  assert.ok(rows.every((row) => row.assigned_member_id === fixture.memberId));
  const { client: other } = await signIn(syntheticEmails.marketingMember);
  assert.equal(ok(await readPages(() => query(other))).length, 0);
});
