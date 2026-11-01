'use client';

import { FormEvent, useEffect, useState } from 'react';
import { api, ApiError } from '../../lib/api';
import { buildOfferBody, EMPTY_OFFER_FORM, formFromOffer, type OfferField, type OfferForm, validateOfferFields } from '../../lib/offers';
import type { Company, Offer, Page } from '../../lib/types';
import { FormField, fieldProps } from '../form-field';
import { Modal } from '../modal';

const PREFIX = 'offer';

/**
 * Fenêtre de création OU de modification d'une offre (`offer` fourni = modification d'un brouillon, préremplie). Avec `company`,
 * l'entreprise est imposée (création depuis une fiche) ; sans elle, on choisit parmi les entreprises de sa portée. Champs non
 * conformes en surbrillance après une première tentative d'envoi (EXD-16).
 */
export function OfferDialog({ offer, company, onClose, onDone }: {
  offer?: Offer;
  company?: { id: string; name: string };
  onClose: () => void;
  onDone: () => Promise<void>;
}) {
  const [form, setForm] = useState<OfferForm>(() => (offer ? formFromOffer(offer) : { ...EMPTY_OFFER_FORM, companyId: company?.id ?? '' }));
  const [companies, setCompanies] = useState<Company[]>([]);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const set = <K extends keyof OfferForm>(key: K, value: OfferForm[K]) => setForm((f) => ({ ...f, [key]: value }));
  const errors = submitted ? validateOfferFields(form) : {};
  const props = (name: OfferField) => fieldProps(PREFIX, name, errors[name]);

  const needsCompanyChoice = !offer && !company;
  useEffect(() => {
    if (!needsCompanyChoice) return;
    api<Page<Company>>('/companies?pageSize=100').then((page) => setCompanies(page.items.filter((c) => c.status !== 'ARCHIVED'))).catch(() => setError('La liste des entreprises est indisponible.'));
  }, [needsCompanyChoice]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSubmitted(true);
    const first = Object.keys(validateOfferFields(form))[0];
    if (first) {
      setTimeout(() => document.getElementById(`${PREFIX}-${first}`)?.focus(), 0);
      return;
    }
    setBusy(true);
    try {
      if (offer) await api(`/offers/${offer.id}`, { method: 'PUT', body: buildOfferBody(form, { version: offer.version }) });
      else await api('/offers', { method: 'POST', body: buildOfferBody(form) });
      await onDone();
    } catch (e) {
      setBusy(false);
      setError(e instanceof ApiError ? e.message : "Échec de l'enregistrement");
    }
  }

  const problems = Object.values(errors);
  return (
    <Modal title={offer ? `Modifier l’offre ${offer.reference}` : 'Nouvelle offre'} onClose={onClose} size="wide">
      <form onSubmit={(e) => void submit(e)} noValidate>
        <fieldset>
          <legend>L’offre</legend>
          {offer ? (
            <p className="m-0 mb-3 text-ink-2">Entreprise : <strong>{offer.companyName}</strong></p>
          ) : company ? (
            <p className="m-0 mb-3 text-ink-2">Entreprise : <strong>{company.name}</strong></p>
          ) : (
            <FormField prefix={PREFIX} name="companyId" label="Entreprise" error={errors.companyId}>
              <select {...props('companyId')} value={form.companyId} onChange={(e) => set('companyId', e.target.value)} required aria-required="true">
                <option value="">— Choisir —</option>
                {companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </FormField>
          )}
          <FormField prefix={PREFIX} name="subject" label="Objet" error={errors.subject}>
            <input {...props('subject')} value={form.subject} onChange={(e) => set('subject', e.target.value)} maxLength={200} required aria-required="true" placeholder="Ex. Formation analyse financière, 12 participants" />
          </FormField>
          <FormField prefix={PREFIX} name="amount" label="Montant" error={errors.amount}>
            <input {...props('amount')} inputMode="decimal" value={form.amount} onChange={(e) => set('amount', e.target.value)} required aria-required="true" autoComplete="off" placeholder="Ex. 4 500 000" />
          </FormField>
          <FormField prefix={PREFIX} name="currency" label="Devise" error={errors.currency}>
            <input {...props('currency')} value={form.currency} onChange={(e) => set('currency', e.target.value)} maxLength={10} autoComplete="off" />
          </FormField>
          <FormField prefix={PREFIX} name="note" label="Note" error={errors.note}>
            <textarea {...props('note')} value={form.note} onChange={(e) => set('note', e.target.value)} maxLength={1000} rows={4} />
          </FormField>
        </fieldset>

        {problems.length > 0 && (
          <div role="alert" className="error">
            <p className="m-0 font-semibold">Corrigez les champs en surbrillance avant d’enregistrer :</p>
            <ul className="m-0 pl-5">{problems.map((p) => <li key={p}>{p}</li>)}</ul>
          </div>
        )}
        {error && <p role="alert" className="error">{error}</p>}
        <div className="row end">
          <button type="button" className="secondary" onClick={onClose}>Annuler</button>
          <button type="submit" disabled={busy}>Enregistrer</button>
        </div>
      </form>
    </Modal>
  );
}
