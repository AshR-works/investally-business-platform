'use client';

import { ReactNode, useEffect, useRef } from 'react';
import { Icon } from './icon';

/** Fenêtre modale accessible : Échap ferme, le focus entre dans la fenêtre, le fond est rendu inerte (`inert`), Tab reste dans la fenêtre et le focus revient à l'élément d'origine à la fermeture. */
export function Modal({ title, onClose, children, size = 'default' }: { title: string; onClose: () => void; children: ReactNode; size?: 'default' | 'wide' }) {
  const ref = useRef<HTMLDivElement>(null);
  const close = useRef(onClose);
  close.current = onClose;

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const dialog = ref.current;
    // Le focus va au premier champ ; sans champ, au premier bouton d'action ; en dernier recours, à la croix.
    (dialog?.querySelector<HTMLElement>('input, select, textarea') ?? dialog?.querySelector<HTMLElement>('button:not(.dialog-close)') ?? dialog?.querySelector<HTMLElement>('.dialog-close'))?.focus();

    // Le reste de la page devient inerte : ni lecture, ni focus, ni clic derrière la fenêtre (en plus d'aria-modal,
    // que tous les lecteurs d'écran ne respectent pas).
    const inerted: HTMLElement[] = [];
    for (let node: HTMLElement | null = dialog?.parentElement ?? null; node && node !== document.body; node = node.parentElement) {
      for (const sibling of Array.from(node.parentElement?.children ?? [])) {
        if (sibling !== node && sibling instanceof HTMLElement && !sibling.inert) {
          sibling.inert = true;
          inerted.push(sibling);
        }
      }
    }

    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close.current();
      if (event.key !== 'Tab' || !dialog) return;
      // Le focus reste dans la fenêtre : Tab sur le dernier élément revient au premier, et inversement.
      const items = Array.from(dialog.querySelectorAll<HTMLElement>('a[href], button, input, select, textarea, [tabindex]:not([tabindex="-1"])')).filter((el) => !el.hasAttribute('disabled'));
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      for (const el of inerted) el.inert = false;
      previous?.focus();
    };
  }, []);

  return (
    <div className="overlay" role="presentation">
      <div className={size === 'wide' ? 'dialog wide' : 'dialog'} role="dialog" aria-modal="true" aria-label={title} ref={ref}>
        <div className="dialog-head">
          <h2>{title}</h2>
          <button type="button" className="dialog-close" onClick={onClose} aria-label="Fermer la fenêtre" title="Fermer"><Icon name="close" className="size-5" /></button>
        </div>
        {children}
      </div>
    </div>
  );
}
