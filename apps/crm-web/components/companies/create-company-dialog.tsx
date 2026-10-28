'use client';

import { FormEvent, useEffect, useState } from 'react';
import { api, ApiError } from '../../lib/api';
import { useAuth } from '../../lib/auth-context';
import { buildCompanyBody, COMMISSION_TYPES, CONTACT_METHODS, type CompanyForm, EMPTY_COMPANY_FORM, validateCompanyForm } from '../../lib/facilitation';
import { can } from '../../lib/permissions';
import type { Facilitator, Page } from '../../lib/types';
import { Modal } from '../modal';

/**
 * Fenêtre de création d'une entreprise : coordonnées, puis « mise en relation » (facilitateur existant ou nouveau,
 * méthode de contact, commission). Le propriétaire est l'utilisateur connecté, décidé côté serveur. La commission
 * n'apparaît que pour qui peut la définir ; le serveur re-contrôle chaque droit.
 */
export function CreateCompanyDialog({ onClose, onCreated }: { onClose: () => void; onCreated: () => Promise<void> }) {
  const { profile } = useAuth();
  const canPickFacilitator = can(profile, 'bd.facilitator.read');
  const canCreateFacilitator = can(profile, 'bd.facilitator.create');
  const canSetCommission = can(profile, 'bd.commission.manage');
  const [form, setForm] = useState<CompanyForm>(EMPTY_COMPANY_FORM);
  const [facilitators, setFacilitators] = useState<Facilitator[]>([]);
  const [problems, setProblems] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const set = <K extends keyof CompanyForm>(key: K, value: CompanyForm[K]) => setForm((f) => ({ ...f, [key]: value }));

  useEffect(() => {
    if (form.facilitatorMode !== 'existing' || facilitators.length > 0) return;
    api<Page<Facilitator>>('/facilitators?pageSize=100').then((page) => setFacilitators(page.items)).catch(() => setError('La liste des facilitateurs est indisponible.'));
  }, [form.facilitatorMode, facilitators.length]);

  /** Enregistre l'entreprise saisie ; en cas d'échec le message de l'API s'affiche dans la fenêtre. */
  async function submit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    const found = validateCompanyForm(form);
    setProblems(found);
    if (found.length > 0) return;
    setBusy(true);
    try {
      await api('/companies', { method: 'POST', body: buildCompanyBody(form) });
      await onCreated();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Échec de l'enregistrement");
      setBusy(false);
    }
  }

  const facilitated = form.facilitatorMode !== 'none';
  return (
    <Modal title="Nouvelle entreprise" onClose={onClose} size="wide">
      <form onSubmit={submit} noValidate>
        <fieldset>
          <legend>L’entreprise</legend>
          <label>
            Nom de l’entreprise
            <input value={form.name} onChange={(e) => set('name', e.target.value)} maxLength={200} required aria-required="true" />
          </label>
          <label>
            Secteur d’activité
            <input value={form.sector} onChange={(e) => set('sector', e.target.value)} maxLength={100} />
          </label>
          <label>
            E-mail de l’entreprise
            <input type="email" value={form.email} onChange={(e) => set('email', e.target.value)} maxLength={200} autoComplete="off" />
          </label>
          <label>
            Téléphone de l’entreprise
            <input type="tel" value={form.phone} onChange={(e) => set('phone', e.target.value)} maxLength={40} autoComplete="off" />
          </label>
        </fieldset>

        {(canPickFacilitator || canCreateFacilitator) && (
          <fieldset>
            <legend>Mise en relation</legend>
            <p className="m-0 mb-3 text-ink-2">Personne qui a présenté l’entreprise ou facilité le premier contact (elle peut en être un employé).</p>
            <label>
              Facilitateur
              <select value={form.facilitatorMode} onChange={(e) => set('facilitatorMode', e.target.value as CompanyForm['facilitatorMode'])}>
                <option value="none">Aucun facilitateur</option>
                {canPickFacilitator && <option value="existing">Un facilitateur déjà enregistré</option>}
                {canCreateFacilitator && <option value="new">Un nouveau facilitateur</option>}
              </select>
            </label>

            {form.facilitatorMode === 'existing' && (
              <label>
                Facilitateur enregistré
                <select value={form.facilitatorId} onChange={(e) => set('facilitatorId', e.target.value)}>
                  <option value="">— Choisir —</option>
                  {facilitators.map((f) => (
                    <option key={f.id} value={f.id}>{f.firstName} {f.lastName} · {f.phone}</option>
                  ))}
                </select>
              </label>
            )}

            {form.facilitatorMode === 'new' && (
              <>
                <label>
                  Nom du facilitateur
                  <input value={form.facilitatorLastName} onChange={(e) => set('facilitatorLastName', e.target.value)} maxLength={100} required aria-required="true" />
                </label>
                <label>
                  Prénom du facilitateur
                  <input value={form.facilitatorFirstName} onChange={(e) => set('facilitatorFirstName', e.target.value)} maxLength={100} required aria-required="true" />
                </label>
                <label>
                  Téléphone du facilitateur
                  <input type="tel" value={form.facilitatorPhone} onChange={(e) => set('facilitatorPhone', e.target.value)} maxLength={40} required aria-required="true" autoComplete="off" />
                </label>
                <label>
                  Commentaire sur le facilitateur
                  <textarea value={form.facilitatorComment} onChange={(e) => set('facilitatorComment', e.target.value)} maxLength={2000} rows={3} />
                </label>
              </>
            )}

            {facilitated && (
              <>
                <label>
                  Méthode de prise de contact avec l’entreprise
                  <select value={form.contactMethod} onChange={(e) => set('contactMethod', e.target.value)}>
                    {CONTACT_METHODS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
                  </select>
                </label>
                <label className="inline">
                  <input type="checkbox" checked={form.isCompanyEmployee} onChange={(e) => set('isCompanyEmployee', e.target.checked)} />
                  Le facilitateur est un employé de l’entreprise
                </label>

                {canSetCommission ? (
                  <>
                    <label>
                      Commission du facilitateur
                      <select value={form.commissionType} onChange={(e) => set('commissionType', e.target.value as CompanyForm['commissionType'])}>
                        <option value="">Aucune commission</option>
                        {COMMISSION_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                      </select>
                    </label>
                    {form.commissionType && (
                      <>
                        <label>
                          {form.commissionType === 'PERCENT' ? 'Pourcentage (de 0 à 100)' : 'Montant'}
                          <input value={form.commissionValue} onChange={(e) => set('commissionValue', e.target.value)} inputMode="decimal" maxLength={16} />
                        </label>
                        {form.commissionType === 'FIXED' && (
                          <label>
                            Devise (trois lettres, par exemple XAF ou EUR)
                            <input value={form.commissionCurrency} onChange={(e) => set('commissionCurrency', e.target.value)} maxLength={3} autoCapitalize="characters" />
                          </label>
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
            <p className="m-0 font-semibold">Corrigez avant d’enregistrer :</p>
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
