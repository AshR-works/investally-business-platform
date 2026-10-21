'use client';

import { ReactNode, useEffect, useRef } from 'react';
import { allSelected, setMany, someSelected, toggleId, type Selection } from '../../lib/selection';

/** Colonne d'un tableau : en-tête, rendu de la cellule, alignement. `srOnlyHeader` pour une colonne d'actions sans titre visible. */
export interface Column<T> {
  id: string;
  header: string;
  cell: (row: T) => ReactNode;
  align?: 'left' | 'right';
  srOnlyHeader?: boolean;
}

/** Sélection persistante d'un tableau : l'ensemble des identifiants et son gestionnaire. */
export interface TableSelection {
  selected: Selection;
  onChange: (next: Set<string>) => void;
}

/** Éléments sur lesquels un clic ne doit PAS basculer la sélection de la ligne. */
const INTERACTIVE = 'button, a, input, label, select, textarea, summary, [role="button"], [role="menuitem"]';

/**
 * Tableau de données du design. Ligne sélectionnée = fond teinté + barre latérale de 4 px + case cochée (la couleur
 * n'est pas le seul signe, EXD-02) ; la sélection se fait à la case ou au clic sur la ligne, et survit aux changements
 * de page. L'en-tête a sa propre case « tout sélectionner (page) », indéterminée si la sélection est partielle.
 */
export function DataTable<T>({
  caption, columns, rows, rowId, rowLabel, selection, empty = 'Aucun résultat.', busy = false,
}: {
  /** Nom du tableau pour les lecteurs d'écran (non affiché). */
  caption: string;
  columns: Column<T>[];
  rows: T[];
  rowId: (row: T) => string;
  /** Nom de la ligne, repris dans « Sélectionner … » (ex. le nom de l'entreprise). */
  rowLabel: (row: T) => string;
  selection?: TableSelection;
  empty?: ReactNode;
  busy?: boolean;
}) {
  const headerBox = useRef<HTMLInputElement>(null);
  const ids = rows.map(rowId);
  const some = selection ? someSelected(selection.selected, ids) : false;
  useEffect(() => {
    if (headerBox.current) headerBox.current.indeterminate = some;
  }, [some]);

  const cols = columns.length + (selection ? 1 : 0);
  const cell = 'border-b border-line px-4 py-3 align-middle';

  return (
    <div className="overflow-x-auto" aria-busy={busy}>
      <table className="w-full border-collapse text-[length:var(--text-sm)]">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr>
            {selection && (
              <th scope="col" className="w-10 border-b border-line bg-surface-2 px-4 py-3">
                <input
                  ref={headerBox}
                  type="checkbox"
                  aria-label="Tout sélectionner (page affichée)"
                  checked={allSelected(selection.selected, ids)}
                  onChange={(event) => selection.onChange(setMany(selection.selected, ids, event.target.checked))}
                  className="size-4 cursor-pointer accent-[var(--brand-strong)]"
                />
              </th>
            )}
            {columns.map((column) => (
              <th key={column.id} scope="col" className={`border-b border-line bg-surface-2 px-4 py-3 text-xs font-semibold text-ink-2 ${column.align === 'right' ? 'text-right' : 'text-left'}`}>
                {column.srOnlyHeader ? <span className="sr-only">{column.header}</span> : column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const id = rowId(row);
            const selected = !!selection?.selected.has(id);
            return (
              <tr
                key={id}
                data-selected={selected || undefined}
                onClick={(event) => {
                  if (!selection || (event.target as HTMLElement).closest(INTERACTIVE)) return;
                  selection.onChange(toggleId(selection.selected, id));
                }}
                className={`${selection ? 'cursor-pointer' : ''} ${selected ? 'bg-selected shadow-[inset_4px_0_0_var(--selected-bar)]' : 'hover:bg-surface-2'}`}
              >
                {selection && (
                  <td className={`${cell} w-10`}>
                    <input
                      type="checkbox"
                      aria-label={`Sélectionner ${rowLabel(row)}`}
                      checked={selected}
                      onChange={() => selection.onChange(toggleId(selection.selected, id))}
                      className="size-4 cursor-pointer accent-[var(--brand-strong)]"
                    />
                  </td>
                )}
                {columns.map((column) => (
                  <td key={column.id} className={`${cell} ${column.align === 'right' ? 'text-right tabular-nums' : ''}`}>{column.cell(row)}</td>
                ))}
              </tr>
            );
          })}
          {rows.length === 0 && (
            <tr>
              <td colSpan={cols} className="px-4 py-10 text-center text-ink-2">{busy ? 'Chargement…' : empty}</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
