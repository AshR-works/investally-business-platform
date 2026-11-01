'use client';

import { useRouter } from 'next/navigation';
import { useAuth } from '../../lib/auth-context';
import { availableActions, OFFER_ACTION_LABEL, type OfferAction, type OfferRights } from '../../lib/offers';
import { can } from '../../lib/permissions';
import type { Offer } from '../../lib/types';
import { RowAction, RowActions } from '../data/row-actions';

/** Droits de l'utilisateur sur les offres, pour `availableActions` (le serveur re-contrôle chaque requête). */
export function useOfferRights(): OfferRights & { create: boolean } {
  const { profile } = useAuth();
  return {
    update: can(profile, 'bd.offer.update'),
    withdraw: can(profile, 'bd.offer.withdraw'),
    create: can(profile, 'bd.offer.create'),
    receiptRead: can(profile, 'bd.receipt.read'),
    followupRead: can(profile, 'bd.followup.read'),
    appointmentCreate: can(profile, 'bd.appointment.create'),
    documentsRead: can(profile, 'docs.document.read'),
  };
}

/** Menu d'actions d'une offre : seulement celles que son état et les droits de l'utilisateur permettent ; rien si aucune. */
/** Actions qui ouvrent une fenêtre (toutes sauf « Relances » et « Planifier un rendez-vous », qui ouvrent une autre page). */
export type OfferDialogAction = Exclude<OfferAction, 'followups' | 'appointment'>;

export function OfferRowActions({ offer, rights, onAction }: { offer: Offer; rights: OfferRights; onAction: (action: OfferDialogAction, offer: Offer) => void }) {
  const router = useRouter();
  const actions = availableActions(offer.status, rights);
  if (actions.length === 0) return <span className="sr-only">Aucune action</span>;
  return (
    <RowActions label={`Actions pour l’offre ${offer.reference}`}>
      {actions.map((action) => <RowAction key={action} danger={action === 'withdraw'} onClick={() => (action === 'followups' ? router.push(`/followups?offerId=${offer.id}`) : action === 'appointment' ? router.push(`/agenda?plan=1&companyId=${offer.companyId}&offerId=${offer.id}`) : onAction(action, offer))}>{OFFER_ACTION_LABEL[action]}</RowAction>)}
    </RowActions>
  );
}
