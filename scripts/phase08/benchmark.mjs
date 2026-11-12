import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { admin } from '../../tests/supabase/helpers.mjs';
import { ok } from '../../tests/supabase/phase04-fixture.mjs';
import { archiveEdge, archiveFixture, approveClosing } from '../../tests/supabase/phase08-fixture.mjs';
import { decodeArchive, hash, recoverArchive } from './recover.mjs';
import { scaleFixture, seedLocalRows } from './benchmark-seed.mjs';

const directory = '.local/phase08';
const reference = JSON.parse(await readFile(join(directory, 'recovery-result.json'), 'utf8'));
const sample = decodeArchive(await readFile(join(directory, 'browser-archive.json.gz')),
  reference.archive.logical_sha256, reference.archive.compressed_sha256).document;
const originals = new Map();
for (const entry of sample.records.evidence) {
  const bytes = await readFile(join(directory, 'recovery-evidence', entry.bucket, entry.path));
  assert.equal(hash(bytes), entry.sha256);
  originals.set(entry.kind, bytes);
}
const counts = process.argv.length > 2 ? process.argv.slice(2).map(Number) : [10,100,500];
assert.ok(counts.every((count) => [10,100,500].includes(count)), 'Choose bounded workload sizes 10, 100 or 500');
const results = [];
for (const count of counts) {
  const started = performance.now();
  const allocation = count * 11000 + 100000;
  const fixture = await archiveFixture('Phase 08 benchmark ' + count, { budget: allocation + 100000, allocation });
  const rows = scaleFixture(sample, fixture, count);
  const hodId = ok(await fixture.hod.auth.getUser()).user.id;
  const database = seedLocalRows(rows, fixture.activityId, hodId);
  const evidenceRoot = join(directory, 'benchmark-evidence-' + count);
  for (let start = 0; start < rows.evidence.length; start += 10) {
    await Promise.all(rows.evidence.slice(start, start + 10).map(async (entry) => {
      const bytes = originals.get(entry.kind);
      ok(await admin.storage.from(entry.bucket).upload(entry.path, bytes, { contentType: entry.mime }));
      const file = join(evidenceRoot, entry.bucket, entry.path);
      await mkdir(dirname(file), { recursive: true });
      await writeFile(file, bytes);
    }));
  }
  const fixtureMs = Math.round(performance.now() - started);
  await approveClosing(fixture);
  const generation = await archiveEdge(fixture.director, fixture.activityId, 'Director', 'generate');
  const metrics = await generation.json();
  assert.equal(generation.status, 200, JSON.stringify(metrics));
  assert.equal(metrics.evidenceCount, count * 2);
  const verification = await archiveEdge(fixture.treasurer, fixture.activityId, 'Treasurer', 'verify');
  const verified = await verification.json();
  assert.equal(verification.status, 200, JSON.stringify(verified));
  const retrieved = await archiveEdge(fixture.treasurer, fixture.activityId, 'Treasurer', 'download');
  assert.equal(retrieved.status, 200);
  const compressed = Buffer.from(await retrieved.arrayBuffer());
  const restored = recoverArchive({ compressed, logicalSha: metrics.logicalSha256,
    compressedSha: metrics.compressedSha256, evidenceRoot });
  assert.equal(restored.paid, 11000 * count);
  assert.equal(restored.paymentCount, count);
  results.push({ claims: count, fixtureMs, ...metrics, verificationMs: verified.milliseconds,
    verificationReads: verified.storageReads, recoveryMs: restored.milliseconds,
    retainedRows: database.rows, retainedTupleBytes: database.tupleBytes, recoveredRows: restored.restoredRows,
    nodeRssBytes: process.memoryUsage().rss,
    compressionRatio: metrics.logicalBytes / metrics.compressedBytes,
    netAdditionalArchiveBytes: metrics.compressedBytes });
  await writeFile(join(directory, 'benchmark-results.json'), JSON.stringify(results, null, 2));
  console.log(JSON.stringify(results.at(-1)));
}
