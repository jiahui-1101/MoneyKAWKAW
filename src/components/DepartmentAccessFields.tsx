import { Check } from 'lucide-react';
import type { ClubDirectory } from '../domain/models';
import { demoProfiles } from '../domain/session';
import { Field } from './Field';

export function DepartmentAccessFields({ directory, hodId, members, setHodId, setMembers }: {
  directory: ClubDirectory; hodId: string; members: string[];
  setHodId: (id: string) => void; setMembers: (ids: string[]) => void;
}) {
  return <div className="stack"><Field label="Assigned HOD (explicit demo access)" id="department-hod"><select id="department-hod" value={hodId} onChange={e => setHodId(e.target.value)}><option value="">No HOD assigned</option>{directory.users.filter(u => demoProfiles.some(p => p.userId === u.id && p.role === 'HOD')).map(u => <option key={u.id} value={u.id}>{u.name}</option>)}</select></Field><fieldset className="field"><legend className="membership-legend">Eligible committee members</legend><div className="membership-list">{directory.users.filter(u => u.id !== hodId).map(u => <button type="button" key={u.id} aria-pressed={members.includes(u.id)} className={`member-toggle ${members.includes(u.id) ? 'selected' : ''}`} onClick={() => setMembers(members.includes(u.id) ? members.filter(id => id !== u.id) : [...members, u.id])}><span className="member-check">{members.includes(u.id) && <Check size={12} />}</span>{u.name}</button>)}</div></fieldset><p className="field-hint">This explicitly grants access to this department only. The selected HOD is also eligible to take a purchasing task. Descriptive lead names alone do not grant access.</p></div>;
}
