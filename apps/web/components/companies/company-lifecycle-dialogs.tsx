'use client';

import { FormEvent, useEffect, useState } from 'react';
import { api, ApiError } from '../../lib/api';
import { type OwnerCandidate, otherOwners, type StatusAction } from '../../lib/company-lifecycle';
import { COMPANY_STATUS, statusStyle } from '../../lib/status';
import type { Company } from '../../lib/types';
import { FormField, fieldProps } from '../form-field';
import { Modal } from '../modal';

/** Changement de statut d'une entreprise (CU-C-05) : confirmation ; le serveur refuse « Qualifiée » sans contact. */
export function CompanyStatusDialog({ company, action, onClose, onDone }: { company: Company; action: StatusAction; onClose: () => void; onDone: () => Promise<void> }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const from = statusStyle(COMPANY_STATUS, company.status).label;
  const to = statusStyle(COMPANY_STATUS, action.to).label;
  async function confirm() {
    setBusy(true);
    setError(null);
    try {
      await api(`/companies/${company.id}/status`, { method: 'POST', body: { version: company.version, status: action.to } });
      await onDone();
    } catch (e) {
      setBusy(false);
      setError(e instanceof ApiError ? e.message : 'Changement impossible');
    }
  }
  return (
    <Modal title="Changer le statut" onClose={onClose}>
      <p className="m-0 mb-3">« <strong>{company.name}</strong> » passe de <strong>{from}</strong> à <strong>{to}</strong>. Le changement est enregistré dans l’audit.</p>
      {action.to === 'QUALIFIED' && <p className="m-0 mb-3 text-ink-2">Une entreprise ne peut être qualifiée que si elle a au moins un contact.</p>}
      {error && <p role="alert" className="error">{error}</p>}
      <div className="row end">
        <button type="button" className="secondary" onClick={onClose}>Retour</button>
        <button type="button" disabled={busy} onClick={() => void confirm()}>{action.label}</button>
      </div>
    </Modal>
  );
}

const PREFIX = 'owner';

/**
 * Changement de responsable (D17) : le choix se limite aux personnes de la portée de l'utilisateur (liste du serveur) et une
 * confirmation explicite précède l'enregistrement, car la portée des droits sur l'entreprise, ses opportunités, offres et
 * rendez-vous suit son responsable.
 */
export function CompanyOwnerDialog({ company, onClose, onDone }: { company: Company; onClose: () => void; onDone: () => Promise<void> }) {
  const [candidates, setCandidates] = useState<OwnerCandidate[] | null>(null);
  const [owner, setOwner] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [errors, setErrors] = useState<{ owner?: string; confirmed?: string }>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    api<OwnerCandidate[]>('/companies/owners')
      .then((list) => {
        if (!cancelled) setCandidates(otherOwners(list, company.ownerUserId));
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof ApiError ? e.message : 'Chargement impossible');
      });
    return () => {
      cancelled = true;
    };
  }, [company.ownerUserId]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    const next: { owner?: string; confirmed?: string } = {};
    if (!owner) next.owner = 'Choisissez le nouveau responsable.';
    if (!confirmed) next.confirmed = 'Confirmez le changement pour continuer.';
    setErrors(next);
    if (Object.keys(next).length > 0) return;
    setBusy(true);
    setError(null);
    try {
      await api(`/companies/${company.id}/owner`, { method: 'POST', body: { version: company.version, ownerUserId: owner } });
      await onDone();
    } catch (e) {
      setBusy(false);
      setError(e instanceof ApiError ? e.message : 'Changement impossible');
    }
  }

  return (
    <Modal title="Changer de responsable" onClose={onClose}>
      <form onSubmit={(e) => void submit(e)} noValidate>
        <p className="m-0 mb-3">« <strong>{company.name}</strong> » est suivie par <strong>{company.ownerName ?? 'un responsable inconnu'}</strong>. Ses opportunités, offres et rendez-vous suivent l’entreprise.</p>
        {candidates === null && !error && <p role="status" className="m-0 text-ink-2">Chargement…</p>}
        {candidates?.length === 0 && <p className="m-0 mb-3 text-ink-2">Personne d’autre n’est disponible dans votre périmètre.</p>}
        {candidates && candidates.length > 0 && (
          <>
            <FormField prefix={PREFIX} name="user" label="Nouveau responsable" error={errors.owner}>
              <select {...fieldProps(PREFIX, 'user', errors.owner)} value={owner} onChange={(e) => setOwner(e.target.value)}>
                <option value="">Choisir…</option>
                {candidates.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </FormField>
            <div className="field">
              <label className="inline-flex items-center gap-2">
                <input type="checkbox" checked={confirmed} aria-invalid={errors.confirmed ? true : undefined} aria-describedby={errors.confirmed ? `${PREFIX}-confirm-error` : undefined} onChange={(e) => setConfirmed(e.target.checked)} />
                Je confirme le changement de responsable
              </label>
              {errors.confirmed && <p id={`${PREFIX}-confirm-error`} className="field-error">{errors.confirmed}</p>}
            </div>
          </>
        )}
        {error && <p role="alert" className="error">{error}</p>}
        <div className="row end">
          <button type="button" className="secondary" onClick={onClose}>Retour</button>
          {candidates && candidates.length > 0 && <button type="submit" disabled={busy}>Changer de responsable</button>}
        </div>
      </form>
    </Modal>
  );
}
