import type { ProofFile } from '../../domain/treasury';
export function ProofPreview({proof}:{proof:ProofFile}) {
  return <div className="treasury-proof"><div className="row between wrap"><strong>{proof.name}</strong><a className="text-link" href={proof.dataUrl} download={proof.name}>Download proof</a></div>
    <small>{proof.mime} · {(proof.size/1024).toFixed(1)} KB</small>
    {proof.mime.startsWith('image/')?<img src={proof.dataUrl} alt={`Payment proof: ${proof.name}`}/>:<p className="settings-copy">PDF proof is preserved as uploaded. Download it to inspect the document.</p>}
  </div>;
}
