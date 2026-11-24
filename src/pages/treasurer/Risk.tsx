import { useState } from 'react';
import { demoMode } from '../../services/supabase/client';
import { Link, useParams } from 'react-router-dom';
import { useTreasury } from '../../context/treasury-context';
import { summarize } from '../../domain/budget';
import { claimContext } from '../../domain/risk';
import { treasuryService } from '../../services/treasury';
import { RiskRulesForm } from '../../components/treasurer/RiskRulesForm';
import { Badge, Empty, PageHeader, Panel, useFormat } from '../../components/ui';
import { PressureAnalysis } from '../../components/treasurer/PressureAnalysis';
import { PressureHistory } from '../../components/treasurer/PressureHistory';
export function TreasuryRisk() {
  const { id } = useParams();
  const { data, busy, run } = useTreasury();
  const { money, time } = useFormat();
  const [error, setError] = useState(''),
    [configure, setConfigure] = useState(false);
  const claim = data?.expenses.find((e) => e.id === id);
  if (!data || !claim)
    return (
      <Empty
        title="Claim access restricted"
        action={
          <Link className="btn" to="/treasurer/claims">
            Back to claims
          </Link>
        }
      >
        The requested claim is outside your oversight.
      </Empty>
    );
  const c = claimContext(data, claim);
  const dep = summarize(data, claim.activityId, claim.departmentId),
    activity = summarize(data, claim.activityId);
  const analysis = claim.review?.decisionAnalysis ?? claim.review?.analysis;
  const final = ['Approved', 'Declined'].includes(claim.state);
  const analyze = async () => {
    setError('');
    try {
      await run(
        () => treasuryService.analyze(claim.id),
        'Risk check saved. The claim is not approved or declined yet.',
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to analyze claim.');
    }
  };
  return (
    <div className="stack">
      <Link className="back-link" to={`/treasurer/claims/${id}`}>
        ← Back to claim
      </Link>
      <PageHeader
        eyebrow="ADVICE ONLY · YOU DECIDE"
        title="Over-budget check"
        description={`${claim.description} · ${c.activity.name} / ${c.department.name}`}
      >
        {demoMode && <button className="btn" onClick={() => setConfigure(true)}>
          Change risk levels
        </button>}
        {!final && (
          <button className="btn primary" disabled={busy} onClick={() => void analyze()}>
            {busy ? 'Analyzing…' : 'Analyze risk'}
          </button>
        )}
      </PageHeader>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <Panel
        title="Budget check"
        subtitle="Current balances. This claim is already counted in them."
      >
        <dl className="treasury-facts">
          {[
            ['Item budget', c.task ? money(c.task.budget) : 'No item budget'],
            ['Claim amount', money(claim.amount)],
            ['Over budget', money(Math.max(0, c.variance))],
            ['Over item budget', `${c.variancePercent.toFixed(2)}%`],
            ['Department left after claims', money(dep.remaining)],
            ['Department free to spend', money(dep.available)],
            ['Activity left after claims', money(activity.remaining)],
            ['Activity free to spend', money(activity.available)],
            [
              'Other pending claims',
              money(
                activity.pending -
                  (['Pending review', 'In review'].includes(claim.state) ? claim.amount : 0),
              ),
            ],
            [
              'Approved, not yet paid',
              money(activity.recorded - activity.paid - (data.financialSummaries ? 0 : activity.pending)),
            ],
          ].map(([label, value]) => (
            <div key={label}>
              <dt>{label}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>
      </Panel>
      <div className="treasury-justification">
        <span className="eyebrow">MEMBER’S EXPLANATION</span>
        <p>{claim.review?.justification || 'The member gave no explanation.'}</p>
      </div>
      <Panel
        title="What approving changes"
        subtitle="This claim is already counted. Approving won’t count it twice."
      >
        <div className="treasury-impact">
          <h3>If you approve, the club will owe the member {money(claim.amount)}.</h3>
          <p>
            Claims waiting for review already reduce the money free to spend. Approving only changes
            the status. Recording the payment later moves the amount from “owed” to “paid”.
          </p>
          <p>
            {dep.available < 0
              ? `The department is ${money(-dep.available)} over budget, counting claims and unfinished purchases.`
              : `Department money still free to spend: ${money(dep.available)}.`}
          </p>
          <p>
            Declined claims don’t count as spending. Their item budget stays set aside for now.
          </p>
        </div>
      </Panel>
      {analysis ? (
        <Panel
          title={final ? 'Risk check at decision time' : 'Latest risk check'}
          subtitle={`${time(analysis.at)} · ${analysis.actor} · ${final ? 'saved when decided' : 'run again for the latest balances'}`}
        >
          <div className="treasury-risk-result">
            <Badge
              tone={
                analysis.band === 'High' ? 'danger' : analysis.band === 'Medium' ? 'gold' : 'green'
              }
            >
              {analysis.band} risk
            </Badge>
            <p>
              Based on fixed rules, not a prediction. The highest factor sets the overall level. You
              decide.
            </p>
            <dl className="treasury-facts">
              <div>
                <dt>Over item budget</dt>
                <dd>
                  {money(analysis.variance)} · {analysis.variancePercent.toFixed(2)}%
                </dd>
              </div>
              <div>
                <dt>Department free to spend</dt>
                <dd>{money(analysis.departmentAvailable)}</dd>
              </div>
              <div>
                <dt>Activity free to spend</dt>
                <dd>{money(analysis.activityAvailable)}</dd>
              </div>
              <div>
                <dt>Other claims waiting</dt>
                <dd>{money(analysis.pendingOther)}</dd>
              </div>
            </dl>
            {analysis.factors.map((f) => (
              <article key={f.label}>
                <div className="row between wrap">
                  <h3>{f.label}</h3>
                  <Badge
                    tone={f.level === 'High' ? 'danger' : f.level === 'Medium' ? 'gold' : 'green'}
                  >
                    {f.level}
                  </Badge>
                </div>
                <p>{f.detail}</p>
              </article>
            ))}
            <p className="field-hint">
              Rules used: Medium if {analysis.rules.mediumVariance}%+ over the item budget, High if{' '}
              {analysis.rules.highVariance}%+. Low money left means {analysis.rules.lowHeadroomPercent}% of
              the budget or less. Over budget is always High.
            </p>
          </div>
        </Panel>
      ) : (
        <Panel title="Risk check">
          <Empty title={final ? 'No risk check saved' : 'No risk check yet'}>
            {final
              ? 'This claim was decided before risk checks were saved. Use the current balances above.'
              : 'Select Analyze risk to see what affects this claim. You must run it before approving an over-budget claim.'}
          </Empty>
        </Panel>
      )}
      {!final && import.meta.env.VITE_PRESSURE_MODEL !== 'off' &&
        <PressureAnalysis key={claim.id} claimId={claim.id} revision={claim.review?.updatedAt ?? ''} />}
      {final && <PressureHistory key={claim.id} claimId={claim.id} />}
      <Link className="btn" to={`/treasurer/claims/${id}`}>
        Back to claim
      </Link>
      {configure && <RiskRulesForm onClose={() => setConfigure(false)} />}
    </div>
  );
}
