import { useEffect, useState } from 'react';
import { Panel } from '../ui';
import { demoMode, supabaseClient } from '../../services/supabase/client';
import { checked } from '../../services/supabase/finance';
import { pressureSchema } from '../../domain/pressure-features';
import type { Database } from '../../services/supabase/database.types';
type Advice = Database['public']['Tables']['claim_pressure_advice']['Row'];
export function PressureHistory({ claimId }: { claimId: string }) {
  const [state, setState] = useState<{ id: string; rows?: Advice[]; error?: string }>();
  useEffect(() => {
    if (demoMode) return;
    const control = new AbortController();
    const load = async () => {
      try {
        const rows = checked(await supabaseClient().from('claim_pressure_advice').select('*')
          .eq('claim_id', claimId).order('created_at', { ascending: false }).limit(5).abortSignal(control.signal));
        if (!control.signal.aborted) setState({ id: claimId, rows });
      } catch {
        if (!control.signal.aborted) setState({ id: claimId, error: 'Retained experimental advice could not be loaded.' });
      }
    };
    void load();
    return () => control.abort();
  }, [claimId]);
  if (demoMode) return null;
  const current = state?.id === claimId ? state : undefined;
  return <Panel title="Retained experimental advice" subtitle="Latest five snapshots · private to authorized Treasurers">
    <div className="stack member-content">
      {!current ? <p role="status">Loading retained advice…</p> : current.error ? <p role="status">{current.error}</p> :
        !current.rows?.length ? <p>No experimental advice retained for this claim. No historical prediction is invented.</p> :
          current.rows.map((row) => <details key={row.id}>
            <summary>{new Date(row.created_at).toLocaleString()} · Experimental score {(row.score * 100).toFixed(1)} / 100</summary>
            <p className="field-hint">{row.model_version} · claim revision {row.claim_revision} · {row.feature_schema}</p>
            {row.feature_schema === pressureSchema.version && Array.isArray(row.contributions) &&
              row.contributions.map((v, i) => typeof v === 'number' && pressureSchema.features[i] ?
                <p key={i}>{pressureSchema.features[i].label}: {v.toFixed(3)} log-odds contribution</p> : null)}
            <p className="field-hint">Simulation-trained, unvalidated client-reported advice; not a causal explanation,
              verified real-world probability or financial authorization. Feature hash: {row.feature_hash}</p>
          </details>)}
    </div>
  </Panel>;
}
