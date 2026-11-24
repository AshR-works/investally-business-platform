'use client';

import { useCallback, useEffect, useState } from 'react';
import { AmbassadorDialog } from '../../../../components/ambassadors/ambassador-dialog';
import { Card } from '../../../../components/data/card';
import { EntityLink } from '../../../../components/entity-link';
import { PageHeader } from '../../../../components/data/page-header';
import { PageHeading } from '../../../../components/page-heading';
import { api, ApiError } from '../../../../lib/api';
import { useAuth } from '../../../../lib/auth-context';
import type { AmbassadorForm } from '../../../../lib/ambassadors';
import type { AmbassadorSuggestion } from '../../../../lib/certification';
import { dateText } from '../../../../lib/sessions';
import { can } from '../../../../lib/permissions';
import { todayIso } from '../../../../lib/receipts';

/** Prénom et nom depuis « Prénom Nom » (même format que partout ailleurs dans l'interface) : le premier mot est le prénom. */
function splitName(name: string): { firstName: string; lastName: string } {
  const [firstName = '', ...rest] = name.trim().split(/\s+/);
  return { firstName, lastName: rest.join(' ') };
}

/**
 * Suggestions d'ambassadeur (CU-I-62, S8) : un apprenant d'entreprise vient de recevoir un certificat ou une attestation. Jamais de
 * lecture des certifications ici — seulement un nom, une entreprise et une date. Créer l'ambassadeur reste une décision manuelle,
 * jamais automatique.
 */
export default function AmbassadorSuggestionsPage() {
  const { profile } = useAuth();
  const canRead = can(profile, 'bd.ambassador.read');
  const canCreate = can(profile, 'bd.ambassador.create');
  const [suggestions, setSuggestions] = useState<AmbassadorSuggestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dialog, setDialog] = useState<{ initial: Partial<AmbassadorForm>; companyName: string } | null>(null);

  const load = useCallback(async () => {
    if (!canRead) return;
    try {
      setSuggestions(await api<AmbassadorSuggestion[]>('/ambassador-suggestions'));
      setError(null);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Chargement impossible');
    } finally {
      setLoading(false);
    }
  }, [canRead]);
  useEffect(() => {
    void load();
  }, [load]);

  if (!canRead) {
    return (
      <>
        <PageHeading>Suggestions d’ambassadeur</PageHeading>
        <p>Votre profil n’a pas accès aux suggestions d’ambassadeur.</p>
      </>
    );
  }

  return (
    <>
      <PageHeader
        eyebrow="Business Development"
        title="Suggestions d’ambassadeur"
        description="Apprenants certifiés d’une entreprise, à envisager comme ambassadeurs. Aucun accès à leur certification ici ; créer l’ambassadeur reste une décision manuelle."
      />
      {error && <p role="alert" className="error">{error}</p>}
      <Card>
        {loading ? (
          <p className="m-0 p-5" aria-live="polite">Chargement…</p>
        ) : suggestions.length === 0 ? (
          <p className="m-0 p-5 text-ink-2">Aucune suggestion pour le moment.</p>
        ) : (
          <ul className="m-0 list-none p-0">
            {suggestions.map((s) => (
              <li key={s.id} className="flex items-center justify-between gap-3 border-b border-line px-5 py-3 last:border-0">
                <span>
                  <strong>{s.learnerName}</strong> ·{' '}
                  <EntityLink kind="company" id={s.companyId} label={s.companyName}>{s.companyName}</EntityLink>
                  <span className="text-ink-2"> · suggéré le {dateText(s.createdAt.slice(0, 10))}</span>
                </span>
                {canCreate && (
                  <button
                    type="button"
                    className="secondary"
                    onClick={() => {
                      const { firstName, lastName } = splitName(s.learnerName);
                      setDialog({ initial: { origin: 'LEARNER', companyId: s.companyId, lastName, firstName, appointedOn: todayIso() }, companyName: s.companyName });
                    }}
                  >
                    Créer un ambassadeur
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>
      {dialog && (
        <AmbassadorDialog
          initial={dialog.initial}
          initialCompanyName={dialog.companyName}
          onClose={() => setDialog(null)}
          onDone={async () => { setDialog(null); await load(); }}
        />
      )}
    </>
  );
}
