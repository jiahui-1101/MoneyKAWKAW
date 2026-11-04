import type { ProofFile } from '../domain/treasury';
export const proofLimit = 1_048_576;
export function validateProof(proof: ProofFile) {
  if (
    !proof ||
    !['image/png', 'image/jpeg', 'application/pdf'].includes(proof.mime) ||
    !proof.name?.trim() ||
    proof.name.length > 160 ||
    !Number.isSafeInteger(proof.size) ||
    proof.size < 8 ||
    proof.size > proofLimit
  )
    throw new Error('Choose a PNG, JPEG, or PDF proof up to 1 MB.');
  const prefix = `data:${proof.mime};base64,`;
  if (!proof.dataUrl.startsWith(prefix)) throw new Error('Invalid proof encoding.');
  let bytes: string;
  try {
    bytes = atob(proof.dataUrl.slice(prefix.length));
  } catch {
    throw new Error('Invalid proof file.');
  }
  const magic =
    proof.mime === 'image/png'
      ? bytes.startsWith('\x89PNG\r\n\x1a\n')
      : proof.mime === 'image/jpeg'
        ? bytes.startsWith('\xff\xd8\xff')
        : bytes.startsWith('%PDF-');
  if (!magic || bytes.length !== proof.size)
    throw new Error('The proof contents do not match its file type or size.');
}
export async function readProof(file: File): Promise<ProofFile> {
  if (file.size > proofLimit) throw new Error('Payment proof must be 1 MB or smaller.');
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('The selected file could not be read.'));
    reader.readAsDataURL(file);
  });
  const proof = { name: file.name, mime: file.type as ProofFile['mime'], dataUrl, size: file.size };
  validateProof(proof);
  return proof;
}
