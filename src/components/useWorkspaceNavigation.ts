import { useEffect, useRef, useState } from 'react';
export function useWorkspaceNavigation() {
  const [open, setOpen] = useState(false);
  const [mobile, setMobile] = useState(() => window.matchMedia('(max-width: 760px)').matches);
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    const media = window.matchMedia('(max-width: 760px)');
    const change = () => { setMobile(media.matches); if (!media.matches) setOpen(false); };
    media.addEventListener('change', change);
    return () => media.removeEventListener('change', change);
  }, []);
  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement;
    const overflow = document.body.style.overflow; document.body.style.overflow = 'hidden';
    const items = () => [...(ref.current?.querySelectorAll<HTMLElement>('a,button,select') ?? [])].filter(e => e.getClientRects().length && !e.hasAttribute('disabled'));
    items()[0]?.focus();
    const keys = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
      if (e.key !== 'Tab') return;
      const focusable = items();
      if (e.shiftKey && document.activeElement === focusable[0]) { e.preventDefault(); focusable.at(-1)?.focus(); }
      if (!e.shiftKey && document.activeElement === focusable.at(-1)) { e.preventDefault(); focusable[0]?.focus(); }
    };
    document.addEventListener('keydown', keys);
    return () => { document.body.style.overflow = overflow; document.removeEventListener('keydown', keys); previous?.focus(); };
  }, [open]);
  return { open, setOpen, mobile, ref };
}
