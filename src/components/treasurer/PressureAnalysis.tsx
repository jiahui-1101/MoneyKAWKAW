import { useEffect, useState } from 'react';
import { Panel, Badge } from '../ui';
import { pressureSchema, validatePressureSnapshot, type PressureSnapshot } from '../../domain/pressure-features';
import { runPressureModel, type PressureResult } from '../../services/pressure-model';
import { supabaseClient, demoMode } from '../../services/supabase/client';
import { checked } from '../../services/supabase/finance';

export function PressureAnalysis({ claimId, revision }: { claimId: string; revision: string }) {
  const [request, setRequest] = useState(0);
  const [state, setState] = useState<{ key: string; result?: PressureResult; snapshot?: PressureSnapshot; error?: string }>();
  const key = `${claimId}:${revision}:${request}`;
  useEffect(() => {
    if (!request || demoMode) return;
    const control = new AbortController();
    const infer = async () => {
      try {
        const snapshot = checked(await supabaseClient().rpc('claim_pressure_snapshot', { p_claim_id: claimId })) as unknown as PressureSnapshot;
        const values = validatePressureSnapshot(snapshot, claimId, revision);
        if (control.signal.aborted) return;
        const result = await runPressureModel(values, control.signal);
        // Revalidate current grants, revision AND all financial inputs after inference.
        const current = checked(await supabaseClient().rpc('claim_pressure_snapshot', { p_claim_id: claimId })) as unknown as PressureSnapshot;
        validatePressureSnapshot(current, claimId, revision);
        if (JSON.stringify(current.raw) !== JSON.stringify(snapshot.raw)) throw new Error('Financial context changed. Run again.');
        if (control.signal.aborted) return;
        checked(await supabaseClient().rpc('retain_claim_pressure_advice', { p_claim_id: claimId,
          p_expected_updated_at: revision, p_model_version: result.version, p_score: result.score,
          p_contributions: result.contributions, p_raw: snapshot.raw }));
        if (!control.signal.aborted) setState({ key, result, snapshot });
      } catch (error) {
        if (!control.signal.aborted) setState({ key, error: error instanceof Error ? error.message : 'Experimental LightGBM unavailable.' });
      }
    };
    void infer();
    return () => control.abort();
  }, [claimId, revision, request, key]);
  const current = state?.key === key ? state : undefined;
  const loading = request > 0 && !current;
  return <Panel title="LightGBM future budget pressure — Experimental" subtitle="Supplementary decision support · simulation-trained">
    <div className="stack member-content">
      <p>Estimates future blocked procurement demand within 30 days or activity closing, whichever is sooner.
        This is a simulation-derived score, not a validated real-world probability.</p>
      <p>The financial safety rules above remain authoritative even when this model suggests low future pressure.
        This model cannot approve, reject or change any financial record.</p>
      <div><button className="btn" disabled={loading || demoMode} onClick={() => setRequest((n) => n + 1)}>
        {loading ? 'Loading experimental model…' : 'Run experimental LightGBM'}
      </button></div>
      {demoMode && <p className="field-hint">Requires a real authorized local or Supabase claim.</p>}
      {current?.error && <p role="status" className="data-note">LightGBM unavailable: {current.error} Continue with financial rules and ordinary review.</p>}
      {current?.result && current.snapshot && <>
        <Badge tone="gold">Experimental score · {(current.result.score * 100).toFixed(1)} / 100</Badge>
        <p className="field-hint">{current.result.version} · {current.result.milliseconds.toFixed(1)} ms ·
          snapshot {new Date(current.snapshot.asOf).toLocaleString()} · horizon ends {new Date(current.snapshot.horizonEnd).toLocaleDateString()}</p>
        <dl className="treasury-facts">
          {current.result.contributions.map((value, index) => ({ value, index }))
            .sort((a, b) => Math.abs(b.value) - Math.abs(a.value)).slice(0, 4).map(({ value, index }) =>
              <div key={index}><dt>{pressureSchema.features[index].label}</dt>
                <dd>{value >= 0 ? '+' : ''}{value.toFixed(3)} log-odds contribution</dd></div>)}
        </dl>
        <p className="field-hint">Learned tree-path contributions relative to training-leaf expectations;
          positive values raise the model score. These are associations, not causes or SHAP values.
          No real historical club outcomes were available for calibration. This experimental advice is
          retained separately as client-reported evidence; the SQL rule assessment remains the decision authority.</p>
      </>}
    </div>
  </Panel>;
}
