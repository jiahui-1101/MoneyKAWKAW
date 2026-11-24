import { useState } from 'react';
import { DepartmentActivity, useDepartmentScope } from '../../components/hod/HodWidgets';
import { PageHeader } from '../../components/ui';
export function HodHistory() {
  const { data, scope } = useDepartmentScope();
  const [query, setQuery] = useState('');
  const filtered = {
    ...data,
    events: data.events.filter((e) =>
      `${e.action} ${e.actor} ${e.detail}`.toLowerCase().includes(query.toLowerCase()),
    ),
  };
  return (
    <div className="stack">
      <PageHeader
        eyebrow={`${scope.department.name.toUpperCase()} · DEPARTMENT HISTORY`}
        title="Department history"
        description="Every change to your department’s tasks, newest first."
      />
      <div className="history-filters">
        <input
          aria-label="Search department history"
          placeholder="Search by change, person or detail…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>
      <DepartmentActivity data={filtered} scope={scope} all />
      <p className="data-note">
        Only this department’s changes are shown. Changes can’t be edited or deleted.
      </p>
    </div>
  );
}
