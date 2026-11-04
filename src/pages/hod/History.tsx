import { useState } from 'react';
import { DepartmentActivity, useDepartmentScope } from '../../components/hod/HodWidgets';
import { PageHeader } from '../../components/ui';
export function HodHistory() {
  const {data,scope}=useDepartmentScope();const [query,setQuery]=useState('');
  const filtered={...data,events:data.events.filter(e=>`${e.action} ${e.actor} ${e.detail}`.toLowerCase().includes(query.toLowerCase()))};
  return <div className="stack"><PageHeader eyebrow={`${scope.department.name.toUpperCase()} · DEPARTMENT HISTORY`} title="The details behind every purchase." description="Creation, reassignment, budget, and progress changes stay linked to their source task."/><div className="history-filters"><input aria-label="Search department activity" placeholder="Search changes, actor, or details…" value={query} onChange={e=>setQuery(e.target.value)}/></div><DepartmentActivity data={filtered} scope={scope} all/><p className="data-note">Only this department’s events are shown. Local demo history is append-only through HOD controls; durable production audit storage remains a future backend responsibility.</p></div>;
}
