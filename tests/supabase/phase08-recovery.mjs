import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm, rmdir, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { gzipSync } from 'node:zlib';
import { decodeArchive, hash, recoverArchive } from '../../scripts/phase08/recover.mjs';
import { admin } from './helpers.mjs';
import { ok } from './phase04-fixture.mjs';

export async function rehearseVerifiedArchive(fixture, compressed, result) {
  const evidenceRoot = await mkdtemp(join(tmpdir(), 'moneykawkaw-archive-recovery-'));
  const input = {
    compressed, logicalSha: result.logicalSha256, compressedSha: result.compressedSha256, evidenceRoot,
  };
  const { document } = decodeArchive(compressed, input.logicalSha, input.compressedSha);
  const variants = (body) => {
    const source = Buffer.from(JSON.stringify(body));
    const gzip = gzipSync(source);
    return { compressed: gzip, logicalSha: hash(source), compressedSha: hash(gzip) };
  };
  const unsupported = variants({ ...document, version: 999 });
  assert.throws(() => decodeArchive(unsupported.compressed, unsupported.logicalSha, unsupported.compressedSha),
    /Unsupported financial archive format version/);
  assert.throws(() => recoverArchive(input), /ENOENT/);
  const broken = structuredClone(document);
  broken.records.evidence[0].record_id = randomUUID();
  assert.throws(() => recoverArchive({ ...input, ...variants(broken) }), /Unlinked or duplicate evidence/);

  const files = [];
  const directories = new Set();
  try {
    for (const evidence of document.records.evidence) {
      const file = join(evidenceRoot, evidence.bucket, evidence.path);
      await mkdir(dirname(file), { recursive: true });
      directories.add(dirname(dirname(file)));
      directories.add(dirname(file));
      const object = ok(await fixture.treasurer.storage.from(evidence.bucket).download(evidence.path));
      await writeFile(file, Buffer.from(await object.arrayBuffer()));
      files.push(file);
    }
    const restored = recoverArchive(input);
    assert.equal(restored.paid, 11000);
    assert.equal(restored.evidenceCount, 2);
    const args = { p_archive: result.id, p_actor: fixture.treasurerUser.id,
      p_compressed_sha: result.compressedSha256, p_rows: restored.restoredRows,
      p_evidence_count: restored.evidenceCount, p_milliseconds: restored.milliseconds };
    assert.equal((await fixture.treasurer.rpc('record_activity_archive_recovery', args)).error?.code, '42501');
    ok(await admin.rpc('record_activity_archive_recovery', args));
    return restored;
  } finally {
    for (const file of files) await rm(file, { force: true });
    for (const directory of [...directories].sort((a, b) => b.length - a.length)) await rmdir(directory);
    await rmdir(evidenceRoot);
  }
}
