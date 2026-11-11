'use client';

import { ReactNode, useEffect, useRef } from 'react';
import { Icon } from '../icon';
import { columnLayout, tableWidthRem } from '../../lib/table-layout';
import { allSelected, setMany, someSelected, toggleId, type Selection } from '../../lib/selection';

/** Colonne d'un tableau : en-tête, rendu de la cellule, alignement. `srOnlyHeader` pour une colonne d'actions sans titre visible. */
export interface Column<T> {
  id: string;
  header: string;
  cell: (row: T) => ReactNode;
  align?: 'left' | 'right';
  srOnlyHeader?: boolean;
  /** Poids de la colonne dans la largeur restante (défaut 1). Les largeurs ne dépendent que des colonnes : trier ou changer de page ne les déplace jamais. */
  weight?: number;
  /** Largeur minimale (rem) ; sinon celle qui correspond à la nature de la colonne, déduite de son en-tête (date, téléphone, montant, état…). */
  min?: number;
  /** Force (`true`) ou interdit (`false`) le passage à la ligne ; sinon selon la nature de la colonne (une date, un numéro, un état ne se coupent jamais). */
  nowrap?: boolean;
  /** Champ de tri côté serveur : l'en-tête devient un bouton qui trie (et annonce le sens avec `aria-sort`). */
  sortField?: string;
}

/** Tri courant d'un tableau et son gestionnaire (le tri est fait par le serveur, sur toutes les pages). */
export interface TableSort {
  field: string;
  direction: 'asc' | 'desc';
  onSort: (field: string) => void;
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
  caption, columns, rows, rowId, rowLabel, selection, sort, empty = 'Aucun résultat.', busy = false,
}: {
  /** Nom du tableau pour les lecteurs d'écran (non affiché). */
  caption: string;
  columns: Column<T>[];
  rows: T[];
  rowId: (row: T) => string;
  /** Nom de la ligne, repris dans « Sélectionner … » (ex. le nom de l'entreprise). */
  rowLabel: (row: T) => string;
  selection?: TableSelection;
  sort?: TableSort;
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
  // Largeurs : le plus grand de la largeur minimale de la nature de la colonne et de sa part de poids ; le tableau défile à l'horizontale si sa place est plus petite.
  const layout = columnLayout(columns);
  const minWidth = `${Math.max(48, tableWidthRem(layout, !!selection))}rem`;
  const cell = 'border-b border-line px-4 py-3 align-middle';
  const cellFor = (index: number) => `${cell} ${layout[index]!.nowrap ? 'overflow-hidden text-ellipsis whitespace-nowrap' : '[overflow-wrap:anywhere]'}`;

  // « relative » : le cadre est le repère de position des textes réservés aux lecteurs d'écran (position absolue), qui sinon sortent du cadre défilant
  // et élargissent toute la page sur téléphone.
  return (
    <div className="relative overflow-x-auto" aria-busy={busy}>
      <table style={{ minWidth }} className="w-full table-fixed border-collapse text-[length:var(--text-sm)]">
        <caption className="sr-only">{caption}</caption>
        <colgroup>
          {selection && <col style={{ width: '3rem' }} />}
          {columns.map((column, index) => <col key={column.id} style={{ width: layout[index]!.width }} />)}
        </colgroup>
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
            {columns.map((column) => {
              const sorted = sort && column.sortField === sort.field ? sort.direction : null;
              return (
                <th
                  key={column.id}
                  scope="col"
                  aria-sort={sort && column.sortField ? (sorted === 'asc' ? 'ascending' : sorted === 'desc' ? 'descending' : 'none') : undefined}
                  className={`border-b border-line bg-surface-2 px-4 py-3 text-xs font-semibold text-ink-2 ${column.align === 'right' ? 'text-right' : 'text-left'}`}
                >
                  {column.srOnlyHeader ? (
                    <span className="sr-only">{column.header}</span>
                  ) : sort && column.sortField ? (
                    <button
                      type="button"
                      onClick={() => sort.onSort(column.sortField as string)}
                      className={`group inline-flex cursor-pointer items-center gap-1 border-0 bg-transparent p-0 font-[inherit] text-[length:inherit] hover:text-ink ${sorted ? 'text-ink' : 'text-inherit'}`}
                    >
                      <span className="min-w-0 text-left">{column.header}</span>
                      {/* Emplacement de taille fixe : l'icône change avec le tri sans jamais déplacer ni élargir l'en-tête. */}
                      <Icon
                        name={sorted === 'asc' ? 'sort-asc' : sorted === 'desc' ? 'sort-desc' : 'sort'}
                        className={`size-4 ${sorted ? 'text-[var(--brand-strong)]' : 'opacity-40 group-hover:opacity-100'}`}
                      />
                    </button>
                  ) : (
                    column.header
                  )}
                </th>
              );
            })}
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
                {columns.map((column, index) => (
                  <td key={column.id} className={`${cellFor(index)} ${column.align === 'right' ? 'text-right tabular-nums' : ''}`}>{column.cell(row)}</td>
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
