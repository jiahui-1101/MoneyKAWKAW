import assert from 'node:assert/strict';
import test from 'node:test';
import { createHash, randomUUID } from 'node:crypto';
import { gzipSync } from 'node:zlib';
import { admin } from './helpers.mjs';
import { ok } from './phase04-fixture.mjs';
import { archiveFixture, archiveEdge, approveClosing } from './phase08-fixture.mjs';

const sha = (bytes) => createHash('sha256').update(bytes).digest('hex');
const getMaterial = async (archive) => ok(await admin.rpc('activity_archive_material', { p_archive: archive }));
const report = async (f) => ok(await f.director.rpc('activity_closing_report', { p_activity: f.activityId, p_role: 'Director' }));
const generate = (f) => archiveEdge(f.director, f.activityId, 'Director', 'generate');

test('real Storage upload failure and corrupt staging retain a single recoverable archive', async () => {
  const f = await archiveFixture('Phase 08 staging faults');
  await approveClosing(f);
  const bucket = admin.storage.from('financial-archive');
  const config = ok(await admin.storage.getBucket('financial-archive'));
  const limits = { public: false, allowedMimeTypes: config.allowed_mime_types };
  ok(await admin.storage.updateBucket('financial-archive', { ...limits, fileSizeLimit: 1 }));
  try {
    const attempt = await generate(f);
    assert.equal(attempt.status, 409);
    assert.equal((await attempt.json()).code, 'UPLOAD_FAILED');
  } finally {
    ok(await admin.storage.updateBucket('financial-archive', { ...limits, fileSizeLimit: config.file_size_limit }));
  }
  const staged = await report(f);
  assert.equal(staged.state, 'Archiving');
  assert.equal(staged.archive.verification_state, 'Failed');
  const archiveId = staged.archive.id;
  const original = await getMaterial(archiveId);
  assert.equal(sha(original.source_text), original.logical_sha256);
  assert.equal(ok(await f.director.rpc('reserve_activity_archive', { p_activity: f.activityId })), archiveId);
  assert.equal((await getMaterial(archiveId)).source_text, original.source_text);
  ok(await bucket.upload(original.object_path, Buffer.from('invalid synthetic gzip'), { contentType: 'application/gzip' }));
  const corrupt = await generate(f);
  assert.equal(corrupt.status, 409);
  assert.equal((await corrupt.json()).code, 'ARCHIVE_MISMATCH');
  assert.equal((await report(f)).state, 'Archiving');

  const retry = await generate(f);
  const result = await retry.json();
  assert.equal(retry.status, 200, JSON.stringify(result));
  assert.equal(result.id, archiveId);
  assert.equal(result.logicalSha256, original.logical_sha256);
  const finalized = await getMaterial(archiveId);
  assert.notEqual(finalized.object_path, original.object_path);
  assert.equal((await report(f)).state, 'Archived');
  const quarantined = ok(await bucket.download(original.object_path));
  assert.equal(await quarantined.text(), 'invalid synthetic gzip');

  const parked = finalized.object_path + '.verification-fixture';
  ok(await bucket.move(finalized.object_path, parked));
  try {
    const missing = await archiveEdge(f.director, f.activityId, 'Director', 'verify');
    assert.equal(missing.status, 409);
    assert.equal((await missing.json()).code, 'ARCHIVE_MISSING');
    assert.equal((await report(f)).archive.verification_state, 'Failed');
  } finally {
    ok(await bucket.move(parked, finalized.object_path));
  }
  const verified = await archiveEdge(f.director, f.activityId, 'Director', 'verify');
  assert.equal(verified.status, 200);
  assert.equal((await report(f)).archive.verification_state, 'Verified');
});

test('retries finalization from an already uploaded immutable object', async () => {
  const f = await archiveFixture('Phase 08 interrupted finalization');
  await approveClosing(f);
  const archiveId = ok(await f.director.rpc('reserve_activity_archive', { p_activity: f.activityId }));
  const stage = await getMaterial(archiveId);
  const gzip = gzipSync(stage.source_text);
  ok(await admin.storage.from('financial-archive').upload(stage.object_path, gzip, { contentType: 'application/gzip' }));
  const actor = ok(await f.director.auth.getUser()).user.id;
  const result = {
    p_archive: archiveId, p_actor: actor, p_object_path: stage.object_path, p_revision: stage.source_revision,
    p_logical_sha: '0'.repeat(64), p_compressed_sha: sha(gzip),
    p_compressed_bytes: gzip.length, p_evidence_count: 0, p_evidence_bytes: 0,
  };
  assert.equal((await f.director.rpc('finalize_activity_archive_object', result)).error?.code, '42501');
  assert.equal((await admin.rpc('finalize_activity_archive_object', result)).error?.code, '23514');
  assert.equal((await report(f)).state, 'Archiving');
  assert.equal((await getMaterial(archiveId)).source_text, stage.source_text);
  const retry = await generate(f);
  const verified = await retry.json();
  assert.equal(retry.status, 200, JSON.stringify(verified));
  assert.equal(verified.storageWrites, 0);
  assert.equal(verified.id, archiveId);
  assert.equal(verified.compressedSha256, sha(gzip));
  assert.equal((await report(f)).state, 'Archived');
  assert.equal(ok(await f.director.rpc('reserve_activity_archive', { p_activity: f.activityId })), archiveId);
});
