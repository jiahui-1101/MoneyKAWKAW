import { Check } from 'lucide-react';
import type { ClubDirectory } from '../domain/models';
import { demoProfiles } from '../domain/session';
import { demoMode } from '../services/supabase/client';
import { Field } from './Field';

export function DepartmentAccessFields({
  directory,
  hodId,
  members,
  setHodId,
  setMembers,
}: {
  directory: ClubDirectory;
  hodId: string;
  members: string[];
  setHodId: (id: string) => void;
  setMembers: (ids: string[]) => void;
}) {
  return (
    <div className="stack">
      <Field label={'Head of Department (HOD)'} id="department-hod">
        <select id="department-hod" value={hodId} onChange={(e) => setHodId(e.target.value)}>
          <option value="">No HOD yet</option>
          {directory.users
            .filter((u) => !demoMode || demoProfiles.some((p) => p.userId === u.id && p.role === 'HOD'))
            .map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
        </select>
      </Field>
      <fieldset className="field">
        <legend className="membership-legend">Committee members in this department</legend>
        <div className="membership-list">
          {directory.users
            .filter((u) => u.id !== hodId)
            .map((u) => (
              <button
                type="button"
                key={u.id}
                aria-pressed={members.includes(u.id)}
                className={`member-toggle ${members.includes(u.id) ? 'selected' : ''}`}
                onClick={() =>
                  setMembers(
                    members.includes(u.id)
                      ? members.filter((id) => id !== u.id)
                      : [...members, u.id],
                  )
                }
              >
                <span className="member-check">
                  {members.includes(u.id) && <Check size={12} />}
                </span>
                {u.name}
              </button>
            ))}
        </div>
      </fieldset>
      <p className="field-hint">
        Only the people you choose can see this department. The HOD can also take purchase
        tasks.
      </p>
    </div>
  );
}
