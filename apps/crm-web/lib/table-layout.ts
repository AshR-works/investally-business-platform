/**
 * Largeurs des colonnes d'un tableau. Principes (lot A, 2026-11-10) :
 * - les largeurs ne dépendent QUE des colonnes, jamais du contenu des lignes : trier ou changer de page ne déplace jamais une colonne ;
 * - chaque colonne a une largeur MINIMALE selon la nature de ce qu'elle affiche (date, téléphone, montant, état, référence…) : jamais coupée au milieu d'un mot,
 *   d'un numéro ou d'une date, jamais chevauchée par sa voisine ; quand la place manque, le tableau défile à l'horizontale au lieu d'écraser ses colonnes ;
 * - le reste de la largeur se répartit selon le poids de chaque colonne.
 * La nature d'une colonne se déduit de son en-tête (table ci-dessous, testée) ; une colonne peut la préciser (`min`, `nowrap`).
 */

/** Largeur (rem) de la case de sélection. */
export const SELECTION_REM = 3;
/** Largeur (rem) d'une unité de poids : un tableau dont les poids totalisent 22 vise ~77 rem ; au-delà de sa place, il défile. */
export const WEIGHT_UNIT_REM = 3.5;

export type ColumnKind = 'date' | 'datetime' | 'phone' | 'money' | 'status' | 'reference' | 'country' | 'text';

const KINDS: readonly (readonly [RegExp, ColumnKind])[] = [
  [/^(dernière connexion|dernière activité|connexion)$/i, 'datetime'],
  [/^(créée? le|déposée le|versée le|depuis|échéance|entrée|date|valide jusqu.au|prochaine relance|version du)$/i, 'date'],
  [/téléphone/i, 'phone'],
  [/^(montant|valeur|commission|à verser)$/i, 'money'],
  [/^(état|statut|mfa|antivirus)$/i, 'status'],
  [/^référence$/i, 'reference'],
  [/^pays$/i, 'country'],
];

/** Largeur minimale (rem, marges de cellule comprises) d'une colonne selon ce qu'elle affiche. */
export const MIN_REM: Record<ColumnKind, number> = { date: 8, datetime: 11.5, phone: 10, money: 11, status: 11.5, reference: 10, country: 9, text: 0 };
/** Ce qui ne se coupe jamais : une date, un numéro, un montant, un état, une référence. */
const NO_WRAP: ReadonlySet<ColumnKind> = new Set<ColumnKind>(['date', 'datetime', 'phone', 'money', 'status', 'reference']);

/** Nature d'une colonne d'après son en-tête (`text` si elle n'est pas reconnue). */
export function kindOf(header: string): ColumnKind {
  const text = header.trim();
  return KINDS.find(([pattern]) => pattern.test(text))?.[1] ?? 'text';
}

export interface LayoutColumn {
  header: string;
  weight?: number;
  /** Largeur minimale (rem) ; sinon celle de la nature de la colonne. */
  min?: number;
  /** Force ou interdit la coupure des lignes ; sinon selon la nature de la colonne. */
  nowrap?: boolean;
}

export interface ColumnLayout {
  /** Largeur de la colonne, en rem. */
  width: string;
  /** Le contenu ne passe jamais à la ligne (et ne déborde jamais : il est tronqué plutôt que de chevaucher la colonne voisine). */
  nowrap: boolean;
}

/** Largeur et règle de coupure de chaque colonne : le plus grand de sa largeur minimale et de sa part de poids. */
export function columnLayout(columns: readonly LayoutColumn[]): ColumnLayout[] {
  return columns.map((column) => {
    const kind = kindOf(column.header);
    const weight = column.weight !== undefined && column.weight > 0 ? column.weight : 1;
    const min = column.min ?? MIN_REM[kind];
    return { width: `${Math.max(min, weight * WEIGHT_UNIT_REM).toFixed(2)}rem`, nowrap: column.nowrap ?? NO_WRAP.has(kind) };
  });
}

/** Largeur totale des colonnes (rem) : le tableau n'est jamais plus étroit, il défile à l'horizontale si sa place est plus petite. */
export function tableWidthRem(layout: readonly ColumnLayout[], hasSelection: boolean): number {
  return layout.reduce((sum, column) => sum + parseFloat(column.width), hasSelection ? SELECTION_REM : 0);
}
