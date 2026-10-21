'use client';

import { ReactNode, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Icon } from '../icon';

/** Largeur du menu (px) : sert à le placer à gauche du bouton sans recouvrir les boutons des lignes voisines. */
const MENU_WIDTH = 224;

/**
 * Menu d'actions d'une ligne (bouton « ⋯ ») : motif de divulgation `details`/`summary`, qui se manipule au clavier
 * (Entrée ou Espace ouvre, Échap ferme et rend le focus au bouton). Un clic ailleurs ou sur une action referme le menu.
 * Le menu est en position FIXE, à gauche du bouton (jamais coupé par le défilement du tableau, ne recouvre pas les
 * boutons des autres lignes) et remonte si la place manque en bas. Les actions sont des `button` (children) ; aucune
 * n'est exécutée sans passer par les contrôles existants (confirmation, step-up MFA, droits côté serveur).
 */
export function RowActions({ label, children }: { label: string; children: ReactNode }) {
  const ref = useRef<HTMLDetailsElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<{ top: number; left: number }>({ top: 0, left: 0 });

  useEffect(() => {
    const onPointer = (event: PointerEvent) => {
      const details = ref.current;
      if (details?.open && !details.contains(event.target as Node)) details.open = false;
    };
    document.addEventListener('pointerdown', onPointer);
    return () => document.removeEventListener('pointerdown', onPointer);
  }, []);

  // Placement après ouverture, une fois la hauteur du menu connue ; se referme si la page défile (position figée).
  useLayoutEffect(() => {
    if (!open || !ref.current || !menu.current) return;
    const anchor = ref.current.getBoundingClientRect();
    const height = menu.current.offsetHeight;
    setPosition({
      top: Math.max(8, Math.min(anchor.top, window.innerHeight - height - 8)),
      left: Math.max(8, anchor.left - MENU_WIDTH - 4),
    });
    const close = () => {
      if (ref.current) ref.current.open = false;
    };
    window.addEventListener('scroll', close, true);
    window.addEventListener('resize', close);
    return () => {
      window.removeEventListener('scroll', close, true);
      window.removeEventListener('resize', close);
    };
  }, [open]);

  return (
    <details
      ref={ref}
      className="relative"
      onToggle={(event) => setOpen((event.currentTarget as HTMLDetailsElement).open)}
      onKeyDown={(event) => {
        if (event.key === 'Escape' && ref.current?.open) {
          ref.current.open = false;
          ref.current.querySelector('summary')?.focus();
        }
      }}
      onClick={(event) => {
        // Un clic sur une action referme le menu (le bouton garde son propre gestionnaire).
        if ((event.target as HTMLElement).closest('[data-menu-item]') && ref.current) ref.current.open = false;
      }}
    >
      <summary
        aria-label={label}
        className="grid size-9 cursor-pointer list-none place-items-center rounded-control text-ink-2 hover:bg-surface-2 hover:text-ink [&::-webkit-details-marker]:hidden"
      >
        <Icon name="more" strokeWidth={3.2} />
      </summary>
      <div
        ref={menu}
        style={{ top: position.top, left: position.left, width: MENU_WIDTH }}
        className="fixed z-20 flex flex-col gap-0.5 rounded-panel border border-line-strong bg-surface p-1.5 shadow-[var(--shadow-3)]"
      >
        {children}
      </div>
    </details>
  );
}

/** Action d'un menu de ligne : bouton plein largeur, aligné à gauche, discret. */
export function RowAction({ children, onClick, danger = false }: { children: ReactNode; onClick: () => void; danger?: boolean }) {
  return (
    <button
      type="button"
      data-menu-item
      onClick={onClick}
      className={`w-full cursor-pointer rounded-control border-0 bg-transparent px-3 py-2 text-left text-[length:var(--text-sm)] font-medium hover:bg-surface-2 ${danger ? 'text-bad' : 'text-ink'}`}
    >
      {children}
    </button>
  );
}
