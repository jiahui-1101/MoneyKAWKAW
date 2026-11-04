import { Link, useParams, useSearchParams } from 'react-router-dom';
import { useMember } from '../../context/member-context';
import { useMemberDraft } from '../../components/member/useMemberDraft';
import { ReceiptUpload } from '../../components/member/ReceiptUpload';
import { ReceiptItemEditor } from '../../components/member/ReceiptItemEditor';
import { ClaimSubmitForm } from '../../components/member/ClaimSubmitForm';
import { ReceiptEvidenceView } from '../../components/treasurer/ReceiptReview';
import { receiptTotal } from '../../domain/receipt';
import { Empty, PageHeader, Skeleton, useFormat } from '../../components/ui';
const steps = [
  { id: 'upload', label: 'Receipt & source' },
  { id: 'items', label: 'Claimable items' },
  { id: 'review', label: 'Compare & review' },
  { id: 'submit', label: 'Submit claim' },
];
export function MemberDraft() {
  const { id = '' } = useParams(),
    { data } = useMember(),
    { money } = useFormat(),
    [params, setParams] = useSearchParams();
  const { draft, loading, error, reload, change, saving } = useMemberDraft(id);
  if (loading) return <Skeleton />;
  if (!draft || !data)
    return (
      <Empty
        title="Claim draft unavailable"
        action={
          <div className="row wrap">
            <button className="btn" onClick={() => void reload()}>
              Retry draft
            </button>
            <Link className="btn primary" to="/member/tasks">
              My purchases
            </Link>
          </div>
        }
      >
        {error || 'This draft is outside your current task ownership.'}
      </Empty>
    );
  const task = data.assignments.find((t) => t.id === draft.taskId);
  if (!task)
    return (
      <Empty title="Task access restricted">
        Your active department membership or task ownership has changed.
      </Empty>
    );
  const canEdit = !!draft.receipt?.extraction;
  const scope = data.scopes.find(
    (s) => s.activity.id === task.activityId && s.department.id === task.departmentId,
  );
  const requested = params.get('step') ?? (canEdit ? 'items' : 'upload'),
    step =
      steps.some((s) => s.id === requested) && (requested === 'upload' || canEdit)
        ? requested
        : 'upload';
  const go = (next: string) => setParams({ step: next });
  return (
    <div className="stack">
      <Link className="back-link" to={`/member/tasks/${task.id}`}>
        ← My purchase / Claim preparation
      </Link>
      <PageHeader
        eyebrow={`${scope?.activity.name ?? 'My activity'} · ${scope?.department.name ?? 'My department'} · CLAIM DRAFT`}
        title={task.purchasing!.name}
        description={`${task.purchasing!.description} · Item budget ${money(task.budget)}. Your original evidence and saved modifications stay linked to this purchase.`}
      />
      <div className="member-wizard" aria-label="Claim preparation steps">
        {steps.map((s, i) => (
          <button
            key={s.id}
            className={s.id === step ? 'selected' : ''}
            aria-current={s.id === step ? 'step' : undefined}
            disabled={saving || (s.id !== 'upload' && !canEdit)}
            onClick={() => go(s.id)}
          >
            <span>{i + 1}</span>
            {s.label}
          </button>
        ))}
      </div>
      <p className="member-result">
        Draft changes persist when saved. Only final submission creates a claim and changes
        financial totals.
      </p>
      {step === 'upload' && (
        <ReceiptUpload
          draft={draft}
          saving={saving}
          change={change}
          onCaptured={() => go('items')}
        />
      )}
      {step === 'items' && (
        <ReceiptItemEditor
          draft={draft}
          saving={saving}
          change={change}
          onReview={() => go('review')}
        />
      )}
      {step === 'review' && (
        <>
          <ReceiptEvidenceView receipt={draft.receipt!} amount={receiptTotal(draft.receipt!)} />
          <div className="row wrap">
            <button className="btn" onClick={() => go('items')}>
              Return to item corrections
            </button>
            <button className="btn primary" onClick={() => go('submit')}>
              Continue to claim submission
            </button>
          </div>
        </>
      )}
      {step === 'submit' && (
        <ClaimSubmitForm draft={draft} task={task} saving={saving} change={change} />
      )}
    </div>
  );
}
