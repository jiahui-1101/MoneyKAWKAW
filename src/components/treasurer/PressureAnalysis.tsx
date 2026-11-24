import { useEffect, useState } from 'react';
import { Panel, Badge, useFormat } from '../ui';
import { pressureSchema, validatePressureSnapshot, type PressureSnapshot } from '../../domain/pressure-features';
import { runPressureModel, type PressureResult } from '../../services/pressure-model';
import { supabaseClient, demoMode } from '../../services/supabase/client';
import { checked } from '../../services/supabase/finance';

export function PressureAnalysis({ claimId, revision }: { claimId: string; revision: string }) {
  const { date, time } = useFormat();
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
        if (JSON.stringify(current.raw) !== JSON.stringify(snapshot.raw)) throw new Error('Balances changed while running. Try again.');
        if (control.signal.aborted) return;
        checked(await supabaseClient().rpc('retain_claim_pressure_advice', { p_claim_id: claimId,
          p_expected_updated_at: revision, p_model_version: result.version, p_score: result.score,
          p_contributions: result.contributions, p_raw: snapshot.raw }));
        if (!control.signal.aborted) setState({ key, result, snapshot });
      } catch (error) {
        if (!control.signal.aborted) setState({ key, error: error instanceof Error ? error.message : 'Forecast unavailable.' });
      }
    };
    void infer();
    return () => control.abort();
  }, [claimId, revision, request, key]);
  const current = state?.key === key ? state : undefined;
  const loading = request > 0 && !current;
  return <Panel title="Budget forecast (experimental)" subtitle="Extra advice only · trained on made-up data">
    <div className="stack member-content">
      <p>Estimates whether this department may run short for planned purchases in the next 30 days
        (or before the activity closes). It is a rough hint, not a real probability.</p>
      <p>The budget check above still applies, even if this score is low. This forecast can’t approve,
        decline or change anything.</p>
      <div><button className="btn" disabled={loading || demoMode} onClick={() => setRequest((n) => n + 1)}>
        {loading ? 'Running forecast…' : 'Run forecast'}
      </button></div>
      {demoMode && <p className="field-hint">Not available in demo mode.</p>}
      {current?.error && <p role="status" className="data-note">Forecast unavailable right now. You can still decide using the budget check above.</p>}
      {current?.result && current.snapshot && <>
        <Badge tone="gold">Forecast score · {(current.result.score * 100).toFixed(1)} / 100</Badge>
        <p className="field-hint">Based on balances at {time(current.snapshot.asOf)} · looks ahead to {date(current.snapshot.horizonEnd)}</p>
        <dl className="treasury-facts">
          {current.result.contributions.map((value, index) => ({ value, index }))
            .sort((a, b) => Math.abs(b.value) - Math.abs(a.value)).slice(0, 4).map(({ value, index }) =>
              <div key={index}><dt>{pressureSchema.features[index].label}</dt>
                <dd>{value >= 0 ? '+' : ''}{value.toFixed(3)} effect on score</dd></div>)}
        </dl>
        <p className="field-hint">Positive numbers raise the score. They show patterns, not causes. The
          model was trained on made-up data, not real club history. The budget check above still applies,
          and you make the decision.</p>
        <details className="field-hint"><summary>Technical details</summary>
          {current.result.version} · {current.result.milliseconds.toFixed(1)} ms · log-odds contributions</details>
      </>}
    </div>
  </Panel>;
}
