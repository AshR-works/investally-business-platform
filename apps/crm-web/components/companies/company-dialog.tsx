'use client';

import { FormEvent, ReactNode, useEffect, useState } from 'react';
import { api, ApiError } from '../../lib/api';
import { useAuth } from '../../lib/auth-context';
import { COUNTRY_SUGGESTIONS } from '../../lib/countries';
import {
  buildCompanyBody, buildCompanyUpdateBody, COMMISSION_TYPES, CONTACT_METHODS, type CompanyForm, editCapabilities, EMPTY_COMPANY_FORM, type FieldName,
  formFromCompany, validateCompanyFields,
} from '../../lib/facilitation';
import { can } from '../../lib/permissions';
import type { Company, Facilitator, Page } from '../../lib/types';
import { Icon } from '../icon';
import { Modal } from '../modal';

const COMMENT_MAX = 2000;

/** Champ de formulaire : libellé relié, puis le contrôle, puis le message d'erreur écrit sous le champ. Composant de premier niveau (défini hors du rendu) pour ne pas recréer les champs, donc perdre le focus, à chaque frappe. */
function Field({ name, label, error, children }: { name: FieldName; label: string; error?: string; children: ReactNode }) {
  return (
    <div className="field">
      <label htmlFor={`company-${name}`}>{label}</label>
      {children}
      {error && <p id={`company-${name}-error`} className="field-error"><Icon name="alert" className="size-4" />{error}</p>}
    </div>
  );
}

/**
 * Fenêtre de création OU de modification d'une entreprise (`company` fourni = modification, préremplie) : coordonnées, puis
 * « mise en relation » (facilitateur existant ou nouveau, méthode de contact, commission). Le propriétaire est l'utilisateur
 * connecté à la création et ne change jamais. La commission n'apparaît que pour qui peut la définir ; si le facilitateur de la
 * fiche n'est pas visible avec les droits de l'utilisateur, la mise en relation reste inchangée. Le serveur re-contrôle chaque droit.
 *
 * Après une première tentative d'envoi, chaque champ non conforme est mis en évidence (bordure, fond, message écrit sous le
 * champ, `aria-invalid`) et le premier reçoit le focus ; la mise en évidence disparaît dès que la saisie est corrigée.
 */
export function CompanyDialog({ company, onClose, onDone }: { company?: Company; onClose: () => void; onDone: () => Promise<void> }) {
  const { profile } = useAuth();
  const canPickFacilitator = can(profile, 'bd.facilitator.read');
  const canCreateFacilitator = can(profile, 'bd.facilitator.create');
  const caps = company ? editCapabilities(company, can(profile, 'bd.commission.manage')) : { facilitationLocked: false, canSetCommission: can(profile, 'bd.commission.manage') };
  const canSetCommission = caps.canSetCommission;
  const [form, setForm] = useState<CompanyForm>(() => (company ? formFromCompany(company) : EMPTY_COMPANY_FORM));
  const [facilitators, setFacilitators] = useState<Facilitator[]>([]);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const set = <K extends keyof CompanyForm>(key: K, value: CompanyForm[K]) => setForm((f) => ({ ...f, [key]: value }));
  const errors = submitted ? validateCompanyFields(form) : {};
  const problems = Object.values(errors);

  useEffect(() => {
    if (form.facilitatorMode !== 'existing' || facilitators.length > 0) return;
    api<Page<Facilitator>>('/facilitators?pageSize=100').then((page) => setFacilitators(page.items)).catch(() => setError('La liste des facilitateurs est indisponible.'));
  }, [form.facilitatorMode, facilitators.length]);

  /** Attributs d'un champ : état non conforme annoncé et relié à son message. */
  const field = (key: FieldName) => ({ id: `company-${key}`, 'aria-invalid': errors[key] ? (true as const) : undefined, 'aria-describedby': errors[key] ? `company-${key}-error` : undefined });

  /** Enregistre l'entreprise saisie ; en cas d'échec le message de l'API s'affiche dans la fenêtre. */
  async function submit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSubmitted(true);
    const first = Object.keys(validateCompanyFields(form))[0];
    if (first) {
      // Le premier champ non conforme reçoit le focus une fois la mise en évidence affichée.
      setTimeout(() => document.getElementById(`company-${first}`)?.focus(), 0);
      return;
    }
    setBusy(true);
    try {
      if (company) await api(`/companies/${company.id}`, { method: 'PUT', body: buildCompanyUpdateBody(form, company, caps) });
      else await api('/companies', { method: 'POST', body: buildCompanyBody(form) });
      await onDone();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Échec de l'enregistrement");
      setBusy(false);
    }
  }

  const facilitated = form.facilitatorMode !== 'none';
  return (
    <Modal title={company ? 'Modifier l’entreprise' : 'Nouvelle entreprise'} onClose={onClose} size="wide">
      <form onSubmit={submit} noValidate>
        <fieldset>
          <legend>L’entreprise</legend>
          <Field name="name" error={errors.name} label="Nom de l’entreprise">
            <input {...field('name')} value={form.name} onChange={(e) => set('name', e.target.value)} maxLength={200} required aria-required="true" />
          </Field>
          <Field name="country" error={errors.country} label="Pays d’affiliation de l’entreprise">
            <input {...field('country')} value={form.country} onChange={(e) => set('country', e.target.value)} maxLength={100} list="company-country-suggestions" autoComplete="off" />
            <datalist id="company-country-suggestions">{COUNTRY_SUGGESTIONS.map((c) => <option key={c} value={c} />)}</datalist>
          </Field>
          <Field name="email" error={errors.email} label="E-mail de l’entreprise">
            <input {...field('email')} type="email" value={form.email} onChange={(e) => set('email', e.target.value)} maxLength={200} autoComplete="off" />
          </Field>
          <Field name="phone" error={errors.phone} label="Téléphone de l’entreprise">
            <input {...field('phone')} type="tel" value={form.phone} onChange={(e) => set('phone', e.target.value)} maxLength={40} autoComplete="off" />
          </Field>
          <div className="field">
            <label htmlFor="company-sector">Secteur d’activité</label>
            <input id="company-sector" value={form.sector} onChange={(e) => set('sector', e.target.value)} maxLength={100} />
          </div>
        </fieldset>

        {caps.facilitationLocked && (
          <fieldset>
            <legend>Mise en relation</legend>
            <p role="note" className="m-0 text-ink-2">Cette entreprise a un facilitateur que vous n’avez pas le droit de voir : la mise en relation ne peut pas être modifiée avec vos droits.</p>
          </fieldset>
        )}
        {!caps.facilitationLocked && (canPickFacilitator || canCreateFacilitator) && (
          <fieldset>
            <legend>Mise en relation</legend>
            <p className="m-0 mb-3 text-ink-2">Personne qui a présenté l’entreprise ou facilité le premier contact (elle peut en être un employé).</p>
            <div className="field">
              <label htmlFor="company-facilitator-mode">Facilitateur</label>
              <select id="company-facilitator-mode" value={form.facilitatorMode} onChange={(e) => set('facilitatorMode', e.target.value as CompanyForm['facilitatorMode'])}>
                <option value="none">Aucun facilitateur</option>
                {canPickFacilitator && <option value="existing">Un facilitateur déjà enregistré</option>}
                {canCreateFacilitator && <option value="new">Un nouveau facilitateur</option>}
              </select>
            </div>

            {form.facilitatorMode === 'existing' && (
              <Field name="facilitatorId" error={errors.facilitatorId} label="Facilitateur enregistré">
                <select {...field('facilitatorId')} value={form.facilitatorId} onChange={(e) => set('facilitatorId', e.target.value)}>
                  <option value="">— Choisir —</option>
                  {facilitators.map((f) => (
                    <option key={f.id} value={f.id}>{f.firstName} {f.lastName} · {f.phone}</option>
                  ))}
                </select>
              </Field>
            )}

            {form.facilitatorMode === 'new' && (
              <>
                <Field name="facilitatorLastName" error={errors.facilitatorLastName} label="Nom du facilitateur">
                  <input {...field('facilitatorLastName')} value={form.facilitatorLastName} onChange={(e) => set('facilitatorLastName', e.target.value)} maxLength={100} required aria-required="true" />
                </Field>
                <Field name="facilitatorFirstName" error={errors.facilitatorFirstName} label="Prénom du facilitateur">
                  <input {...field('facilitatorFirstName')} value={form.facilitatorFirstName} onChange={(e) => set('facilitatorFirstName', e.target.value)} maxLength={100} required aria-required="true" />
                </Field>
                <Field name="facilitatorPhone" error={errors.facilitatorPhone} label="Téléphone du facilitateur">
                  <input {...field('facilitatorPhone')} type="tel" value={form.facilitatorPhone} onChange={(e) => set('facilitatorPhone', e.target.value)} maxLength={40} required aria-required="true" autoComplete="off" />
                </Field>
                <div className="field">
                  <label htmlFor="company-facilitator-comment">Commentaire sur le facilitateur</label>
                  <textarea id="company-facilitator-comment" aria-describedby="company-facilitator-comment-count" value={form.facilitatorComment} onChange={(e) => set('facilitatorComment', e.target.value)} maxLength={COMMENT_MAX} rows={4} />
                  <p id="company-facilitator-comment-count" className="field-count">{form.facilitatorComment.length} / {COMMENT_MAX} caractères</p>
                </div>
              </>
            )}

            {facilitated && (
              <>
                <div className="field">
                  <label htmlFor="company-contact-method">Méthode de prise de contact avec l’entreprise</label>
                  <select id="company-contact-method" value={form.contactMethod} onChange={(e) => set('contactMethod', e.target.value)}>
                    {CONTACT_METHODS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
                  </select>
                </div>
                <label className="inline">
                  <input type="checkbox" checked={form.isCompanyEmployee} onChange={(e) => set('isCompanyEmployee', e.target.checked)} />
                  Le facilitateur est un employé de l’entreprise
                </label>

                {canSetCommission ? (
                  <>
                    <div className="field">
                      <label htmlFor="company-commission-type">Commission du facilitateur</label>
                      <select id="company-commission-type" value={form.commissionType} onChange={(e) => set('commissionType', e.target.value as CompanyForm['commissionType'])}>
                        <option value="">Aucune commission</option>
                        {COMMISSION_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                      </select>
                    </div>
                    {form.commissionType && (
                      <>
                        <Field name="commissionValue" error={errors.commissionValue} label={form.commissionType === 'PERCENT' ? 'Pourcentage (de 0 à 100)' : 'Montant'}>
                          <input {...field('commissionValue')} value={form.commissionValue} onChange={(e) => set('commissionValue', e.target.value)} inputMode="decimal" maxLength={16} />
                        </Field>
                        {form.commissionType === 'FIXED' && (
                          <Field name="commissionCurrency" error={errors.commissionCurrency} label="Devise (XAF = FCFA par défaut ; ou trois lettres, par exemple EUR)">
                            <input {...field('commissionCurrency')} value={form.commissionCurrency} onChange={(e) => set('commissionCurrency', e.target.value)} maxLength={4} autoCapitalize="characters" />
                          </Field>
                        )}
                      </>
                    )}
                  </>
                ) : (
                  <p role="note" className="m-0 text-ink-2">Vous pouvez enregistrer le facilitateur, mais pas définir de commission : ce droit est réservé.</p>
                )}
              </>
            )}
          </fieldset>
        )}

        {problems.length > 0 && (
          <div role="alert" className="error">
            <p className="m-0 font-semibold">Corrigez les champs en surbrillance avant d’enregistrer :</p>
            <ul className="m-0 pl-5">{problems.map((p) => <li key={p}>{p}</li>)}</ul>
          </div>
        )}
        {error && <p role="alert" className="error">{error}</p>}
        <div className="row end">
          <button type="button" className="secondary" onClick={onClose}>Annuler</button>
          <button type="submit" disabled={busy || form.name.trim().length === 0}>Enregistrer</button>
        </div>
      </form>
    </Modal>
  );
}
