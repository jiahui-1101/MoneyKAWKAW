import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useTreasury } from '../../context/treasury-context';
import { summarize } from '../../domain/budget';
import { claimContext } from '../../domain/risk';
import { treasuryService } from '../../services/treasury';
import { RiskRulesForm } from '../../components/treasurer/RiskRulesForm';
import { Badge, Empty, PageHeader, Panel, useFormat } from '../../components/ui';
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
        'Advisory risk analysis saved. No claim decision was made.',
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to analyze claim.');
    }
  };
  return (
    <div className="stack">
      <Link className="back-link" to={`/treasurer/claims/${id}`}>
        ← Claim detail / Budget & risk
      </Link>
      <PageHeader
        eyebrow="RULE-BASED ADVISORY ANALYSIS"
        title="Understand the amount beyond the plan."
        description={`${claim.description} · ${c.activity.name} / ${c.department.name}`}
      >
        <button className="btn" onClick={() => setConfigure(true)}>
          Configure thresholds
        </button>
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
        title="Budget context"
        subtitle="Current shared balances · amounts below already reserve this submitted claim"
      >
        <dl className="treasury-facts">
          {[
            ['Allocated item budget', c.task ? money(c.task.budget) : 'Unlinked'],
            ['Claim amount', money(claim.amount)],
            ['Over budget', money(Math.max(0, c.variance))],
            ['Item variance', `${c.variancePercent.toFixed(2)}%`],
            ['Department remaining', money(dep.remaining)],
            ['Department available', money(dep.available)],
            ['Activity remaining', money(activity.remaining)],
            ['Activity available', money(activity.available)],
            [
              'Other pending claims',
              money(
                activity.pending -
                  (['Pending review', 'In review'].includes(claim.state) ? claim.amount : 0),
              ),
            ],
            [
              'Approved unpaid liabilities',
              money(activity.recorded - activity.pending - activity.paid),
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
        <p>{claim.review?.justification || 'No reason retained.'}</p>
      </div>
      <Panel
        title="Financial impact of approval"
        subtitle="Moving a submitted claim to approved does not add the expense twice"
      >
        <div className="treasury-impact">
          <h3>{money(claim.amount)} becomes an approved liability if accepted.</h3>
          <p>
            Pending and in-review claims already reduce available funds. Approval changes the review
            classification; recording payment later moves the same amount from unpaid liability to
            paid.
          </p>
          <p>
            {dep.available < 0
              ? `The department currently has a ${money(-dep.available)} deficit after claims and open task reservations.`
              : `Department funds available after existing claims and reservations: ${money(dep.available)}.`}
          </p>
          <p>
            Declined claims are excluded from recorded expenses; their linked item estimates remain
            reserved pending a future correction workflow.
          </p>
        </div>
      </Panel>
      {analysis ? (
        <Panel
          title={final ? 'Analysis retained at decision' : 'Saved advisory result'}
          subtitle={`${time(analysis.at)} · ${analysis.actor} · ${final ? 'historical snapshot' : 'rerun to refresh current balances'}`}
        >
          <div className="treasury-risk-result">
            <Badge
              tone={
                analysis.band === 'High' ? 'danger' : analysis.band === 'Medium' ? 'gold' : 'green'
              }
            >
              {analysis.band} · rule-based risk level
            </Badge>
            <p>
              A deterministic rule assessment, not a statistical prediction. The highest factor sets
              the band. The Treasurer makes the decision.
            </p>
            <dl className="treasury-facts">
              <div>
                <dt>Snapshot variance</dt>
                <dd>
                  {money(analysis.variance)} · {analysis.variancePercent.toFixed(2)}%
                </dd>
              </div>
              <div>
                <dt>Department available</dt>
                <dd>{money(analysis.departmentAvailable)}</dd>
              </div>
              <div>
                <dt>Activity available</dt>
                <dd>{money(analysis.activityAvailable)}</dd>
              </div>
              <div>
                <dt>Other pending</dt>
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
              Rules in this snapshot: medium variance ≥ {analysis.rules.mediumVariance}%; high ≥{' '}
              {analysis.rules.highVariance}%; low headroom ≤ {analysis.rules.lowHeadroomPercent}%. A
              negative available balance is High.
            </p>
          </div>
        </Panel>
      ) : (
        <Panel title="Ready for a considered review">
          <Empty title={final ? 'No historical analysis retained' : 'No analysis recorded yet'}>
            {final
              ? 'This legacy decision predates advisory snapshots. The current balances above provide context; no historical analysis is invented.'
              : 'Select Analyze risk to calculate transparent factors from current shared records. Approval of an over-budget claim requires an analysis first.'}
          </Empty>
        </Panel>
      )}
      <Link className="btn" to={`/treasurer/claims/${id}`}>
        Return to claim review
      </Link>
      {configure && <RiskRulesForm onClose={() => setConfigure(false)} />}
    </div>
  );
}
