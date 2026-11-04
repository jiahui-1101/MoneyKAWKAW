import { ArrowUpRight, Check, Inbox, X } from 'lucide-react';
import { useContext, useEffect, useRef, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { WorkspaceContext, useWorkspace } from '../context/workspace-context';
import { FormatSettingsContext } from '../context/format-context';

export function useFormat() {
  const workspace = useContext(WorkspaceContext);
  const settings = useContext(FormatSettingsContext) ?? workspace?.store?.settings;
  const currency = settings?.currency ?? 'MYR';
  const timezone = settings?.timezone ?? 'Asia/Kuala_Lumpur';
  return {
    money: (n: number, compact = false) =>
      new Intl.NumberFormat('en-MY', {
        style: 'currency',
        currency,
        currencyDisplay: 'narrowSymbol',
        notation: compact && Math.abs(n) >= 100_000_000 ? 'compact' : 'standard',
        minimumFractionDigits: compact && n % 100 === 0 ? 0 : 2,
        maximumFractionDigits: 2,
      }).format(n / 100),
    date: (s: string) =>
      new Intl.DateTimeFormat('en-GB', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        timeZone: timezone,
      }).format(new Date(s.length === 10 ? `${s}T12:00:00Z` : s)),
    time: (s: string) =>
      new Intl.DateTimeFormat('en-GB', {
        day: 'numeric',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
        timeZone: timezone,
      }).format(new Date(s)),
    currency,
  };
}
export function Badge({ children, tone = 'neutral' }: { children: ReactNode; tone?: string }) {
  return (
    <span className={`badge badge-${tone}`}>
      <span className="status-dot" />
      {children}
    </span>
  );
}
export function Status({ value }: { value: string }) {
  return (
    <Badge
      tone={
        value === 'Active' || value === 'Approved'
          ? 'green'
          : value === 'Declined' ? 'danger' : value === 'In review' ? 'violet'
          : value === 'Planning' || value === 'Pending review'
            ? 'gold'
            : 'neutral'
      }
    >
      {value}
    </Badge>
  );
}
export function Progress({
  value,
  tone = 'brand',
  label,
}: {
  value: number;
  tone?: string;
  label: string;
}) {
  return (
    <div
      className={`progress progress-${tone}`}
      role="progressbar"
      aria-label={label}
      aria-valuenow={Math.round(value)}
      aria-valuemin={0}
      aria-valuemax={Math.max(100, Math.ceil(value))}
    >
      <span style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
    </div>
  );
}
export function Empty({
  title,
  children,
  action,
}: {
  title: string;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="empty">
      <span className="empty-icon">
        <Inbox size={24} />
      </span>
      <h2>{title}</h2>
      <p>{children}</p>
      {action}
    </div>
  );
}
export function Panel({
  title,
  subtitle,
  action,
  children,
  className = '',
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`panel ${className}`}>
      <div className="panel-head">
        <div>
          <h2>{title}</h2>
          {subtitle && <p>{subtitle}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}
export function PageHeader({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow: string;
  title: string;
  description: string;
  children?: ReactNode;
}) {
  return (
    <div className="page-heading">
      <div>
        <div className="eyebrow">{eyebrow}</div>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      <div className="row wrap">{children}</div>
    </div>
  );
}
export function TextLink({ to, children }: { to: string; children: ReactNode }) {
  return (
    <Link className="text-link" to={to}>
      {children}
      <ArrowUpRight size={14} />
    </Link>
  );
}
export function Skeleton() {
  return (
    <div className="stack" role="status" aria-label="Loading workspace">
      <div className="skeleton" style={{ height: 75 }} />
      <div className="metrics">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="skeleton" style={{ height: 145 }} />
        ))}
      </div>
      <div className="skeleton" style={{ height: 330 }} />
    </div>
  );
}
export function Modal({
  title,
  children,
  onClose,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement;
    const dialog = ref.current;
    dialog?.showModal();
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      dialog?.close();
      document.body.style.overflow = overflow;
      previous?.focus();
    };
  }, []);
  return (
    <dialog
      ref={ref}
      className="modal"
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      aria-labelledby="modal-title"
    >
      <div className="modal-inner">
        <div className="row between">
          <h2 id="modal-title">{title}</h2>
          <button className="icon-btn" aria-label="Close dialog" onClick={onClose}>
            <X size={18} />
          </button>
        </div>
        {children}
      </div>
    </dialog>
  );
}
export function Toast() {
  const { notice, dismiss } = useWorkspace();
  return <ToastMessage notice={notice} dismiss={dismiss} />;
}
export function ToastMessage({ notice, dismiss }: { notice: string; dismiss: () => void }) {
  return notice ? (
    <div className="toast" role="status">
      <Check size={18} />
      <span>{notice}</span>
      <button className="icon-btn" aria-label="Dismiss notification" onClick={dismiss}>
        <X size={16} />
      </button>
    </div>
  ) : null;
}
