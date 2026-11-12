import type { ReactNode } from 'react';

/**
 * Barre de sélection (EXD-02) : apparaît tant que des lignes ou des cartes sont sélectionnées, annonce le nombre aux
 * lecteurs d'écran et propose « Tout désélectionner ». Les actions groupées (`children`) s'y ajoutent quand elles existent.
 */
export function SelectionBar({ count, onClear, children }: { count: number; onClear: () => void; children?: ReactNode }) {
  return (
    <div role="status" className="mb-4 min-h-0">
      {count > 0 && (
        <div className="flex flex-wrap items-center gap-3 rounded-panel border border-brand-strong bg-selected px-4 py-3">
          <strong>{count} sélectionnée{count > 1 ? 's' : ''}</strong>
          {children}
          <button type="button" onClick={onClear} className="secondary small ml-auto">Tout désélectionner</button>
        </div>
      )}
    </div>
  );
}
