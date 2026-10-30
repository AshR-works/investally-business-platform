'use client';

import { FormEvent, useEffect, useState } from 'react';
import { api, ApiError } from '../../lib/api';
import {
  buildContactBody, CONTACT_ROLES, type ContactField, type ContactForm, EMPTY_CONTACT_FORM, formFromContact, isDuplicateConflict, validateContactFields,
} from '../../lib/contacts';
import type { Company, Contact, Page } from '../../lib/types';
import { FormField, fieldProps } from '../form-field';
import { Modal } from '../modal';

const PREFIX = 'contact';

/**
 * Fenêtre de création OU de modification d'un contact (`contact` fourni = modification, préremplie). Avec `company`, l'entreprise
 * est imposée (création depuis une fiche entreprise) ; sans elle, on choisit parmi les entreprises de sa portée. Un doublon probable
 * (même entreprise, même nom ou même e-mail) est signalé et peut être créé quand même, après avertissement. Champs non conformes
 * en surbrillance après une première tentative d'envoi (EXD-16).
 */
export function ContactDialog({ contact, company, onClose, onDone }: {
  contact?: Contact;
  company?: { id: string; name: string };
  onClose: () => void;
  onDone: () => Promise<void>;
}) {
  const [form, setForm] = useState<ContactForm>(() => (contact ? formFromContact(contact) : { ...EMPTY_CONTACT_FORM, companyId: company?.id ?? '' }));
  const [companies, setCompanies] = useState<Company[]>([]);
  const [submitted, setSubmitted] = useState(false);
  const [duplicate, setDuplicate] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const set = <K extends keyof ContactForm>(key: K, value: ContactForm[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
    setDuplicate(null); // un champ modifié : l'avertissement de doublon n'est plus valable
  };
  const errors = submitted ? validateContactFields(form) : {};
  const props = (name: ContactField) => fieldProps(PREFIX, name, errors[name]);

  const needsCompanyChoice = !contact && !company;
  useEffect(() => {
    if (!needsCompanyChoice) return;
    api<Page<Company>>('/companies?pageSize=100').then((page) => setCompanies(page.items)).catch(() => setError('La liste des entreprises est indisponible.'));
  }, [needsCompanyChoice]);

  async function submit(event: FormEvent, allowDuplicate = false) {
    event.preventDefault();
    setError(null);
    setSubmitted(true);
    const first = Object.keys(validateContactFields(form))[0];
    if (first) {
      setTimeout(() => document.getElementById(`${PREFIX}-${first}`)?.focus(), 0);
      return;
    }
    setBusy(true);
    try {
      if (contact) await api(`/contacts/${contact.id}`, { method: 'PUT', body: buildContactBody(form, { version: contact.version, allowDuplicate }) });
      else await api('/contacts', { method: 'POST', body: buildContactBody(form, { allowDuplicate }) });
      await onDone();
    } catch (e) {
      setBusy(false);
      if (e instanceof ApiError && isDuplicateConflict(e.status, e.message)) setDuplicate(e.message);
      else setError(e instanceof ApiError ? e.message : "Échec de l'enregistrement");
    }
  }

  const problems = Object.values(errors);
  return (
    <Modal title={contact ? 'Modifier le contact' : 'Nouveau contact'} onClose={onClose} size="wide">
      <form onSubmit={(e) => void submit(e)} noValidate>
        <fieldset>
          <legend>Le contact</legend>
          {contact ? (
            <p className="m-0 mb-3 text-ink-2">Entreprise : <strong>{contact.companyName}</strong></p>
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
          <FormField prefix={PREFIX} name="lastName" label="Nom" error={errors.lastName}>
            <input {...props('lastName')} value={form.lastName} onChange={(e) => set('lastName', e.target.value)} maxLength={100} required aria-required="true" />
          </FormField>
          <FormField prefix={PREFIX} name="firstName" label="Prénom" error={errors.firstName}>
            <input {...props('firstName')} value={form.firstName} onChange={(e) => set('firstName', e.target.value)} maxLength={100} required aria-required="true" />
          </FormField>
          <FormField prefix={PREFIX} name="role" label="Fonction">
            <select {...props('role')} value={form.role} onChange={(e) => set('role', e.target.value)}>
              {CONTACT_ROLES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
            </select>
          </FormField>
          <FormField prefix={PREFIX} name="email" label="E-mail" error={errors.email}>
            <input {...props('email')} type="email" value={form.email} onChange={(e) => set('email', e.target.value)} maxLength={200} autoComplete="off" />
          </FormField>
          <FormField prefix={PREFIX} name="phone" label="Téléphone" error={errors.phone}>
            <input {...props('phone')} type="tel" value={form.phone} onChange={(e) => set('phone', e.target.value)} maxLength={40} autoComplete="off" />
          </FormField>
        </fieldset>

        {problems.length > 0 && (
          <div role="alert" className="error">
            <p className="m-0 font-semibold">Corrigez les champs en surbrillance avant d’enregistrer :</p>
            <ul className="m-0 pl-5">{problems.map((p) => <li key={p}>{p}</li>)}</ul>
          </div>
        )}
        {duplicate && (
          <div role="alert" className="error">
            <p className="m-0 font-semibold">Doublon probable</p>
            <p className="m-0">{duplicate}.</p>
            <div className="row" style={{ marginTop: '.6rem' }}>
              <button type="button" className="secondary" onClick={(e) => void submit(e as unknown as FormEvent, true)} disabled={busy}>{contact ? 'Enregistrer quand même' : 'Créer quand même'}</button>
              <span className="text-ink-2">ou corrigez le nom ou l’e-mail.</span>
            </div>
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
