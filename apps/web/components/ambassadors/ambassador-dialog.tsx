'use client';

import { FormEvent, useEffect, useState } from 'react';
import { api, ApiError } from '../../lib/api';
import {
  AMBASSADOR_ORIGINS, type AmbassadorField, type AmbassadorForm, buildAmbassadorBody, EMPTY_AMBASSADOR_FORM, formFromAmbassador, validateAmbassadorFields,
} from '../../lib/ambassadors';
import { todayIso } from '../../lib/receipts';
import type { Ambassador, Company, Page } from '../../lib/types';
import { FormField, fieldProps } from '../form-field';
import { Modal } from '../modal';
import { PHONE_HINT } from '../../lib/phone';

const PREFIX = 'ambassador';

/**
 * Fenêtre de création OU de modification d'un ambassadeur (`ambassador` fourni = modification, préremplie). Créer un ambassadeur est
 * toujours une **décision manuelle** du chargé de compte. L'origine ne se modifie pas ; un client est rattaché à son entreprise,
 * choisie parmi celles de sa portée. Champs non conformes en surbrillance après une première tentative d'envoi (EXD-16).
 */
export function AmbassadorDialog({ ambassador, onClose, onDone }: { ambassador?: Ambassador; onClose: () => void; onDone: () => Promise<void> }) {
  const [form, setForm] = useState<AmbassadorForm>(() => (ambassador ? formFromAmbassador(ambassador) : EMPTY_AMBASSADOR_FORM()));
  const [companies, setCompanies] = useState<Company[]>([]);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const set = <K extends keyof AmbassadorForm>(key: K, value: AmbassadorForm[K]) => setForm((f) => ({ ...f, [key]: value }));
  const errors = submitted ? validateAmbassadorFields(form, { today: todayIso() }) : {};
  const props = (name: AmbassadorField) => fieldProps(PREFIX, name, errors[name]);

  useEffect(() => {
    api<Page<Company>>('/companies?pageSize=100').then((page) => setCompanies(page.items)).catch(() => setError('La liste des entreprises est indisponible.'));
  }, []);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSubmitted(true);
    const first = Object.keys(validateAmbassadorFields(form, { today: todayIso() }))[0];
    if (first) {
      setTimeout(() => document.getElementById(`${PREFIX}-${first}`)?.focus(), 0);
      return;
    }
    setBusy(true);
    try {
      if (ambassador) await api(`/ambassadors/${ambassador.id}`, { method: 'PUT', body: buildAmbassadorBody(form, { version: ambassador.version }) });
      else await api('/ambassadors', { method: 'POST', body: buildAmbassadorBody(form) });
      await onDone();
    } catch (e) {
      setBusy(false);
      setError(e instanceof ApiError ? e.message : "Échec de l'enregistrement");
    }
  }

  const problems = Object.values(errors);
  const companyRequired = form.origin === 'CLIENT';
  return (
    <Modal title={ambassador ? 'Modifier l’ambassadeur' : 'Nouvel ambassadeur'} onClose={onClose} size="wide">
      <form onSubmit={(e) => void submit(e)} noValidate>
        <p className="m-0 mb-3 text-ink-2">Un ambassadeur est un client ou un apprenant devenu relais commercial. Sa création est toujours une décision de votre part : elle n’est jamais automatique.</p>
        <fieldset>
          <legend>L’ambassadeur</legend>
          <FormField prefix={PREFIX} name="lastName" label="Nom" error={errors.lastName}>
            <input {...props('lastName')} value={form.lastName} onChange={(e) => set('lastName', e.target.value)} maxLength={100} required aria-required="true" />
          </FormField>
          <FormField prefix={PREFIX} name="firstName" label="Prénom" error={errors.firstName}>
            <input {...props('firstName')} value={form.firstName} onChange={(e) => set('firstName', e.target.value)} maxLength={100} required aria-required="true" />
          </FormField>
          {ambassador ? (
            <p className="m-0 mb-3 text-ink-2">Origine : <strong>{AMBASSADOR_ORIGINS.find((o) => o.value === ambassador.origin)?.label ?? ambassador.origin}</strong> (non modifiable)</p>
          ) : (
            <FormField prefix={PREFIX} name="origin" label="Origine" error={errors.origin}>
              <select {...props('origin')} value={form.origin} onChange={(e) => set('origin', e.target.value)}>
                {AMBASSADOR_ORIGINS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </FormField>
          )}
          <FormField prefix={PREFIX} name="companyId" label={companyRequired ? 'Entreprise' : 'Entreprise (facultatif)'} error={errors.companyId}>
            <select {...props('companyId')} value={form.companyId} onChange={(e) => set('companyId', e.target.value)} required={companyRequired} aria-required={companyRequired ? 'true' : undefined}>
              <option value="">{companyRequired ? '— Choisir —' : '— Aucune —'}</option>
              {companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              {ambassador?.companyId && !companies.some((c) => c.id === ambassador.companyId) && <option value={ambassador.companyId}>{ambassador.companyName}</option>}
            </select>
          </FormField>
          <FormField prefix={PREFIX} name="email" label="E-mail" error={errors.email}>
            <input {...props('email')} type="email" value={form.email} onChange={(e) => set('email', e.target.value)} maxLength={200} autoComplete="off" />
          </FormField>
          <FormField prefix={PREFIX} name="phone" label={`Téléphone (${PHONE_HINT})`} error={errors.phone}>
            <input {...props('phone')} type="tel" inputMode="tel" value={form.phone} onChange={(e) => set('phone', e.target.value)} maxLength={40} autoComplete="off" />
          </FormField>
          <FormField prefix={PREFIX} name="appointedOn" label="Ambassadeur depuis le" error={errors.appointedOn}>
            <input {...props('appointedOn')} type="date" value={form.appointedOn} max={todayIso()} onChange={(e) => set('appointedOn', e.target.value)} required aria-required="true" />
          </FormField>
          <FormField prefix={PREFIX} name="note" label="Note (facultatif)" error={errors.note}>
            <textarea {...props('note')} value={form.note} onChange={(e) => set('note', e.target.value)} rows={3} maxLength={500} />
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
