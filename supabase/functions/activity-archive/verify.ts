import {
  ArchiveFault, archiveManifest, gunzip, gzip, maxCompressedBytes, readBounded, sha256, verifyEvidence,
} from '../_shared/archive-format.ts';
import type { ArchiveBackend, ArchiveMaterial } from './transport.ts';

export async function verifyArchive(backend: ArchiveBackend, material: ArchiveMaterial, create: boolean) {
  let reads = 1;
  let writes = 0;
  let response = await backend.read('financial-archive', material.object_path);
  if (!response.ok && create) {
    await response.body?.cancel();
    const original = new TextEncoder().encode(material.source_text ?? '');
    if (original.length !== material.logical_bytes || await sha256(original) !== material.logical_sha256)
      throw new ArchiveFault('ARCHIVE_MISMATCH');
    archiveManifest(original, material.id, material.activity_id);
    const compressed = await gzip(original);
    const uploaded = await backend.upload(material.object_path, compressed);
    writes += Number(uploaded);
    // A concurrent retry can win the immutable upload. Validate its bytes too.
    response = await backend.read('financial-archive', material.object_path);
    reads++;
    if (!response.ok && !uploaded) throw new ArchiveFault('UPLOAD_FAILED');
  }
  if (!response.ok) throw new ArchiveFault('ARCHIVE_MISSING');
  const compressed = await readBounded(response.body, maxCompressedBytes, 'ARCHIVE_MISMATCH');
  const compressedHash = await sha256(compressed);
  if (material.archive_state === 'Finalized' &&
    (material.compressed_sha256 !== compressedHash || material.compressed_bytes !== compressed.length))
    throw new ArchiveFault('ARCHIVE_MISMATCH');
  const original = await gunzip(compressed);
  if (original.length !== material.logical_bytes || await sha256(original) !== material.logical_sha256)
    throw new ArchiveFault('ARCHIVE_MISMATCH');
  const manifest = archiveManifest(original, material.id, material.activity_id);
  const evidenceBytes = await verifyEvidence(manifest, (item) => backend.read(item.bucket, item.path));
  return { compressed, compressedHash, evidenceBytes, evidenceCount: manifest.length, reads: reads + manifest.length, writes };
}
