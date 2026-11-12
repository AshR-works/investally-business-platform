'use client';

import { RefObject, useEffect } from 'react';

/** Vrai si l'évènement vient d'en dehors du conteneur : le conteneur est connu et la cible est un nœud du document (elle a un `nodeType`) qui n'en fait pas partie. */
export function isOutside(container: Pick<Node, 'contains'> | null, target: EventTarget | null): boolean {
  return container !== null && target !== null && typeof (target as Partial<Node>).nodeType === 'number' && !container.contains(target as Node);
}

/**
 * Referme un menu ou un panneau ouvert : au clic (ou toucher) en dehors, et à la touche Échap. Un seul comportement pour tous les menus déroulants de
 * l'application (lot A) : avant, seul le menu « ⋯ » d'une ligne le faisait. Actif seulement quand le menu est ouvert (aucun écouteur sinon).
 */
export function useDismiss(ref: RefObject<HTMLElement | null>, active: boolean, onDismiss: (reason: 'outside' | 'escape') => void): void {
  useEffect(() => {
    if (!active) return;
    const onPointer = (event: PointerEvent) => {
      if (isOutside(ref.current, event.target)) onDismiss('outside');
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onDismiss('escape');
    };
    document.addEventListener('pointerdown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [ref, active, onDismiss]);
}
