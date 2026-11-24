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
        if (!control.signal.aborted) setState({ id: claimId, error: 'Couldn’t load past forecasts.' });
      }
    };
    void load();
    return () => control.abort();
  }, [claimId]);
  if (demoMode) return null;
  const current = state?.id === claimId ? state : undefined;
  return <Panel title="Past forecasts" subtitle="Last 5 runs · only Treasurers can see these">
    <div className="stack member-content">
      {!current ? <p role="status">Loading past forecasts…</p> : current.error ? <p role="status">{current.error}</p> :
        !current.rows?.length ? <p>No forecasts were run for this claim.</p> :
          current.rows.map((row) => <details key={row.id}>
            <summary>{new Date(row.created_at).toLocaleString()} · Forecast score {(row.score * 100).toFixed(1)} / 100</summary>
            
            {row.feature_schema === pressureSchema.version && Array.isArray(row.contributions) &&
              row.contributions.map((v, i) => typeof v === 'number' && pressureSchema.features[i] ?
                <p key={i}>{pressureSchema.features[i].label}: {v.toFixed(3)} effect on score</p> : null)}
            <p className="field-hint">A hint only, trained on made-up data. Not a cause, not a real probability,
              not an approval.</p>
            <p className="field-hint">Technical: {row.model_version} · revision {row.claim_revision} · {row.feature_schema} · {row.feature_hash}</p>
          </details>)}
    </div>
  </Panel>;
}
