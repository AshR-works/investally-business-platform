import { contactMethodLabel, formatCommission } from '../../lib/facilitation';
import type { Facilitation } from '../../lib/types';
import { Badge } from '../data/badge';
import { Card } from '../data/card';

/**
 * Bloc « Mise en relation » de la fiche entreprise. Le facilitateur et la commission ne sont affichés que si l'API les
 * a fournis (droits de l'utilisateur) : leur absence est dite sobrement, sans révéler ce qu'on ne peut pas voir.
 */
export function FacilitationPanel({ facilitation }: { facilitation: Facilitation | null | undefined }) {
  if (!facilitation) return null;
  const { facilitator, commission } = facilitation;
  return (
    <Card className="mb-8">
      <section aria-labelledby="facilitation-title" className="p-5">
        <h2 id="facilitation-title" className="m-0 mb-4 text-[length:var(--text-md)]">Mise en relation</h2>
        <dl className="m-0 grid grid-cols-[repeat(auto-fit,minmax(12rem,1fr))] gap-6">
          <div>
            <dt className="text-xs font-semibold text-ink-2">Facilitateur</dt>
            <dd className="m-0 mt-1">
              {facilitator ? `${facilitator.firstName} ${facilitator.lastName}` : 'Non visible avec vos droits'}
              {facilitation.isCompanyEmployee && <> <Badge tone="info">Employé de l’entreprise</Badge></>}
            </dd>
          </div>
          {facilitator && <div><dt className="text-xs font-semibold text-ink-2">Téléphone du facilitateur</dt><dd className="m-0 mt-1">{facilitator.phone}</dd></div>}
          <div><dt className="text-xs font-semibold text-ink-2">Méthode de prise de contact</dt><dd className="m-0 mt-1">{contactMethodLabel(facilitation.contactMethod)}</dd></div>
          {commission !== undefined && (
            <div><dt className="text-xs font-semibold text-ink-2">Commission</dt><dd className="m-0 mt-1">{commission ? formatCommission(commission) : 'Aucune'}</dd></div>
          )}
        </dl>
        {facilitator?.comment && (
          <p className="m-0 mt-4"><span className="text-xs font-semibold text-ink-2">Commentaire sur le facilitateur</span><br />{facilitator.comment}</p>
        )}
      </section>
    </Card>
  );
}
