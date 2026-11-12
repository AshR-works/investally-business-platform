import { COMPANY_STATUS } from './status';

/**
 * Transitions MANUELLES du statut d'une entreprise (CU-C-05), miroir de celles du serveur : un cran à la fois, vers l'avant ou
 * en retour. « Cliente » (agrément) et « Archivée » (archivage) ne se posent jamais à la main. Le serveur reste juge.
 */
export const STATUS_STEPS: Readonly<Record<string, readonly string[]>> = {
  TARGET: ['CONTACTED'],
  CONTACTED: ['TARGET', 'QUALIFIED'],
  QUALIFIED: ['CONTACTED'],
  CLIENT: [],
  ARCHIVED: [],
};

/** Ordre des statuts pour distinguer avancer et revenir. */
const ORDER = ['TARGET', 'CONTACTED', 'QUALIFIED'] as const;

export interface StatusAction {
  to: string;
  label: string;
  /** Retour d'un cran : présenté comme une action secondaire. */
  backward: boolean;
}

const statusLabel = (status: string): string => COMPANY_STATUS[status]?.label ?? status;

/** Les changements de statut proposés depuis l'état actuel. */
export function statusActions(status: string): StatusAction[] {
  return (STATUS_STEPS[status] ?? []).map((to) => {
    const backward = ORDER.indexOf(to as (typeof ORDER)[number]) < ORDER.indexOf(status as (typeof ORDER)[number]);
    const label = backward ? `Revenir à « ${statusLabel(to)} »` : to === 'QUALIFIED' ? 'Qualifier l’entreprise' : 'Marquer comme contactée';
    return { to, label, backward };
  });
}

/** Une personne à qui confier une entreprise (liste fournie par le serveur, dans la portée de l'utilisateur). */
export interface OwnerCandidate {
  id: string;
  name: string;
}

/** Les candidats, hors le responsable actuel (on ne confie pas une entreprise à qui l'a déjà). */
export const otherOwners = (candidates: readonly OwnerCandidate[], currentOwnerId: string | null | undefined): OwnerCandidate[] =>
  candidates.filter((c) => c.id !== currentOwnerId);
