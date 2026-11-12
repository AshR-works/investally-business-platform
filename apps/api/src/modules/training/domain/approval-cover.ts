import { DomainError } from '../../../shared-kernel';
import { amountLabel, fromCents, toCents } from './money';
import { IsoDate } from './session-dates';

/** Ce que la règle sait d'un agrément (lu au module commercial). */
export interface CoverApproval {
  status: 'REQUESTED' | 'RECEIVED' | 'HONORED' | 'EXPIRED' | 'CANCELLED';
  amount: string | null;
  places: number | null;
  currency: string;
  validUntil: IsoDate | null;
}

/** Ce que les inscriptions vivantes (en attente ou confirmées) ont déjà consommé de l'agrément. */
export interface Consumption { places: number; cents: number }

/**
 * L'agrément peut-il couvrir une inscription à une session qui commence ce jour-là ? (D-INS-1 A) Seul un agrément **Reçu ou Honoré**
 * autorise ; sa fin de validité (si elle existe) doit couvrir la date de début de la session.
 */
export function assertApprovalValid(approval: Pick<CoverApproval, 'status' | 'validUntil'>, sessionStart: IsoDate): void {
  if (approval.status === 'REQUESTED') throw new DomainError('INVARIANT_VIOLATION', "L'agrément est seulement demandé : la promesse de paiement n'est pas encore signée");
  if (approval.status === 'EXPIRED') throw new DomainError('INVARIANT_VIOLATION', "L'agrément est expiré");
  if (approval.status === 'CANCELLED') throw new DomainError('INVARIANT_VIOLATION', "L'agrément est annulé");
  if (approval.validUntil && approval.validUntil < sessionStart) {
    throw new DomainError('INVARIANT_VIOLATION', `L'agrément expire le ${approval.validUntil}, avant le début de la session (${sessionStart})`);
  }
}

/**
 * Un agrément couvre-t-il une inscription de plus ? (D-INS-1 A et D-INS-2 A)
 * - il doit être valide (voir `assertApprovalValid`) ;
 * - un agrément en **places** consomme 1 place par inscription ; un agrément en **somme** consomme le **prix complet** du certificat ;
 *   si l'agrément porte les deux, les deux plafonds s'appliquent ;
 * - un certificat **sans prix complet**, ou dans une autre devise, ne s'inscrit pas sous un agrément en somme.
 * Renvoie le montant à recopier sur l'inscription (le prix complet quand l'agrément couvre une somme, sinon rien).
 */
export function assertApprovalCovers(
  approval: CoverApproval,
  sessionStart: IsoDate,
  certificate: { fullPrice: string | null; currency: string | null },
  used: Consumption,
): { chargedAmount: string | null } {
  assertApprovalValid(approval, sessionStart);
  if (approval.places !== null && used.places + 1 > approval.places) {
    throw new DomainError('INVARIANT_VIOLATION', `L'agrément n'a plus de place (${used.places} utilisée${used.places > 1 ? 's' : ''} sur ${approval.places})`);
  }
  if (approval.amount === null) return { chargedAmount: null };
  if (certificate.fullPrice === null) {
    throw new DomainError('INVARIANT_VIOLATION', "Le certificat n'a pas de prix complet : un agrément en somme ne peut pas le couvrir (renseignez le prix du certificat dans le catalogue)");
  }
  if (certificate.currency !== approval.currency) {
    throw new DomainError('INVARIANT_VIOLATION', `Le prix du certificat est en ${certificate.currency ?? 'devise inconnue'} et l'agrément en ${approval.currency} : aucune conversion n'est faite`);
  }
  const price = toCents(certificate.fullPrice);
  const remaining = toCents(approval.amount) - used.cents;
  if (price > remaining) {
    throw new DomainError('INVARIANT_VIOLATION', `Le montant restant de l'agrément (${amountLabel(Math.max(0, remaining))} ${approval.currency}) ne couvre pas le prix du certificat (${amountLabel(price)} ${approval.currency})`);
  }
  return { chargedAmount: fromCents(price) };
}
