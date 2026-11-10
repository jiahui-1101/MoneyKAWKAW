import { lazy, Suspense, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useSession } from '../../context/session-context';
import { demoMode } from '../../services/supabase/client';
const AssistantPanel = lazy(() => import('./AssistantPanel'));
export function AssistantHost() {
  const { actor } = useSession();
  const location = useLocation();
  return demoMode ? null : <AssistantEntry key={`${actor.userId}:${actor.role}:${location.pathname}`} />;
}
function AssistantEntry() {
  const [open, setOpen] = useState(false);
  return <><button className="btn primary assistant-entry" aria-haspopup="dialog" onClick={() => setOpen(true)}>AI Assistant</button>
    {open && <Suspense fallback={<p role="status" className="assistant-entry data-note">Opening assistant…</p>}>
      <AssistantPanel onClose={() => setOpen(false)} />
    </Suspense>}</>;
}
