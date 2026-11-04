import { Bell } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMember } from '../../context/member-context';
import { memberNotifications } from '../../domain/member-notifications';
import { readMemberNotifications } from '../../services/member-notifications';
import { Empty, PageHeader, Panel, useFormat } from '../../components/ui';
export function MemberNotifications() {
  const { data, busy, run } = useMember(),
    { time } = useFormat();
  const [unreadOnly, setUnreadOnly] = useState(false),
    [error, setError] = useState('');
  if (!data) return null;
  const all = memberNotifications(data),
    unread = all.filter((n) => !n.read),
    shown = all.filter((n) => !unreadOnly || !n.read);
  const mark = async (ids: string[]) => {
    setError('');
    try {
      await run(() => readMemberNotifications(ids), 'Notification read state saved.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to update notifications.');
    }
  };
  return (
    <div className="stack">
      <PageHeader
        eyebrow="MY IN-APP NOTIFICATIONS"
        title="The updates that move your work forward."
        description="Actual assignment, deadline, review, payment, and receipt-confirmation updates. No push notification service is connected."
      >
        <button
          className="btn"
          disabled={busy || !unread.length}
          onClick={() => void mark(unread.map((n) => n.id))}
        >
          Mark all as read
        </button>
      </PageHeader>
      <Panel
        title="My updates"
        subtitle={`${unread.length} unread · tied to shared source records`}
      >
        <div className="member-tabs">
          <button
            className={!unreadOnly ? 'selected' : ''}
            aria-pressed={!unreadOnly}
            onClick={() => setUnreadOnly(false)}
          >
            All updates
          </button>
          <button
            className={unreadOnly ? 'selected' : ''}
            aria-pressed={unreadOnly}
            onClick={() => setUnreadOnly(true)}
          >
            Unread only
          </button>
        </div>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <div className="member-content stack">
          {shown.map((n) => (
            <article className="member-notification" key={n.id}>
              <span className="timeline-icon">
                <Bell size={16} />
              </span>
              <div>
                <Link className="activity-name" to={n.to}>
                  {n.title}
                </Link>
                <p>{n.detail}</p>
                <small>{time(n.at)}</small>
              </div>
              {!n.read && (
                <button className="btn" disabled={busy} onClick={() => void mark([n.id])}>
                  Mark read
                </button>
              )}
            </article>
          ))}
          {!shown.length && (
            <Empty title="You’re up to date">
              No matching notifications remain. Updates follow real shared records and deadlines.
            </Empty>
          )}
        </div>
      </Panel>
    </div>
  );
}
