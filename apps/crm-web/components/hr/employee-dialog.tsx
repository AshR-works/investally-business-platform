'use client';

import { FormEvent, useEffect, useState } from 'react';
import { api, ApiError } from '../../lib/api';
import {
  buildEmployeeBody, type DirectoryEntry, EMPTY_EMPLOYEE_FORM, type Employee, type EmployeeField, type EmployeeForm, formFromEmployee, fullName, type LinkableUser, validateEmployeeFields,
} from '../../lib/hr';
import { PHONE_HINT } from '../../lib/phone';
import { FormField, fieldProps } from '../form-field';
import { Modal } from '../modal';

const PREFIX = 'employee';

/**
 * Fenêtre de création OU de modification d'une fiche du personnel (`employee` fourni = modification, préremplie). **Identité professionnelle seulement** :
 * aucun champ de salaire, d'adresse personnelle ni de date de naissance n'existe (D57). Le responsable se choisit parmi les employés en poste, le compte
 * parmi ceux qui ne sont pas déjà liés ; le serveur reste seul juge (boucle dans la hiérarchie, unicités). Champs non conformes en surbrillance après
 * une première tentative d'envoi (EXD-16).
 */
export function EmployeeDialog({ employee, onClose, onDone }: { employee?: Employee; onClose: () => void; onDone: () => Promise<void> }) {
  const [form, setForm] = useState<EmployeeForm>(() => (employee ? formFromEmployee(employee) : EMPTY_EMPLOYEE_FORM()));
  const [people, setPeople] = useState<DirectoryEntry[]>([]);
  const [accounts, setAccounts] = useState<LinkableUser[]>([]);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const set = <K extends keyof EmployeeForm>(key: K, value: EmployeeForm[K]) => setForm((f) => ({ ...f, [key]: value }));
  const errors = submitted ? validateEmployeeFields(form) : {};
  const props = (name: EmployeeField) => fieldProps(PREFIX, name, errors[name]);

  useEffect(() => {
    api<DirectoryEntry[]>('/hr/org-chart').then(setPeople).catch(() => setError('La liste du personnel est indisponible.'));
    api<LinkableUser[]>('/hr/linkable-users').then(setAccounts).catch(() => setAccounts([]));
  }, []);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSubmitted(true);
    const first = Object.keys(validateEmployeeFields(form))[0];
    if (first) {
      setTimeout(() => document.getElementById(`${PREFIX}-${first}`)?.focus(), 0);
      return;
    }
    setBusy(true);
    try {
      if (employee) await api(`/hr/employees/${employee.id}`, { method: 'PUT', body: buildEmployeeBody(form, { version: employee.version }) });
      else await api('/hr/employees', { method: 'POST', body: buildEmployeeBody(form) });
      await onDone();
    } catch (e) {
      setBusy(false);
      setError(e instanceof ApiError ? e.message : "Échec de l'enregistrement");
    }
  }

  const departments = [...new Set(people.map((p) => p.department))].sort((a, b) => a.localeCompare(b, 'fr'));
  const managers = people.filter((p) => p.id !== employee?.id);
  const problems = Object.values(errors);
  return (
    <Modal title={employee ? 'Modifier la fiche' : 'Nouvel employé'} onClose={onClose} size="wide">
      <form onSubmit={(e) => void submit(e)} noValidate>
        <p className="m-0 mb-3 text-ink-2">Seules les informations professionnelles sont enregistrées ici. Salaire, pièces d’identité, adresse personnelle et date de naissance n’ont pas leur place dans cette application.</p>
        <fieldset>
          <legend>L’employé</legend>
          <FormField prefix={PREFIX} name="lastName" label="Nom" error={errors.lastName}>
            <input {...props('lastName')} value={form.lastName} onChange={(e) => set('lastName', e.target.value)} maxLength={100} required aria-required="true" />
          </FormField>
          <FormField prefix={PREFIX} name="firstName" label="Prénom" error={errors.firstName}>
            <input {...props('firstName')} value={form.firstName} onChange={(e) => set('firstName', e.target.value)} maxLength={100} required aria-required="true" />
          </FormField>
          <FormField prefix={PREFIX} name="matricule" label="Matricule (facultatif)" error={errors.matricule}>
            <input {...props('matricule')} value={form.matricule} onChange={(e) => set('matricule', e.target.value)} maxLength={30} autoComplete="off" />
          </FormField>
          <FormField prefix={PREFIX} name="hiredOn" label="Date d’entrée" error={errors.hiredOn}>
            <input {...props('hiredOn')} type="date" value={form.hiredOn} onChange={(e) => set('hiredOn', e.target.value)} required aria-required="true" />
          </FormField>
        </fieldset>
        <fieldset>
          <legend>Poste et organisation</legend>
          <FormField prefix={PREFIX} name="jobTitle" label="Poste" error={errors.jobTitle}>
            <input {...props('jobTitle')} value={form.jobTitle} onChange={(e) => set('jobTitle', e.target.value)} maxLength={150} required aria-required="true" />
          </FormField>
          <FormField prefix={PREFIX} name="department" label="Service" error={errors.department}>
            <input {...props('department')} list="employee-departments" value={form.department} onChange={(e) => set('department', e.target.value)} maxLength={100} required aria-required="true" />
            <datalist id="employee-departments">{departments.map((d) => <option key={d} value={d} />)}</datalist>
          </FormField>
          <FormField prefix={PREFIX} name="managerEmployeeId" label="Responsable (facultatif)" error={errors.managerEmployeeId}>
            <select {...props('managerEmployeeId')} value={form.managerEmployeeId} onChange={(e) => set('managerEmployeeId', e.target.value)}>
              <option value="">— Aucun —</option>
              {managers.map((p) => <option key={p.id} value={p.id}>{fullName(p)} · {p.jobTitle}</option>)}
              {employee?.managerEmployeeId && !managers.some((p) => p.id === employee.managerEmployeeId) && <option value={employee.managerEmployeeId}>{employee.managerName}</option>}
            </select>
          </FormField>
          <p className="m-0 mb-3 text-[length:var(--text-sm)] text-ink-2">Le responsable est une information de l’annuaire : il ne change pas les droits d’accès de la personne.</p>
        </fieldset>
        <fieldset>
          <legend>Contacts professionnels</legend>
          <FormField prefix={PREFIX} name="workEmail" label="E-mail professionnel (facultatif)" error={errors.workEmail}>
            <input {...props('workEmail')} type="email" value={form.workEmail} onChange={(e) => set('workEmail', e.target.value)} maxLength={200} autoComplete="off" />
          </FormField>
          <FormField prefix={PREFIX} name="workPhone" label={`Téléphone professionnel (facultatif, ${PHONE_HINT})`} error={errors.workPhone}>
            <input {...props('workPhone')} type="tel" inputMode="tel" value={form.workPhone} onChange={(e) => set('workPhone', e.target.value)} maxLength={40} autoComplete="off" />
          </FormField>
          <FormField prefix={PREFIX} name="userId" label="Compte d’accès (facultatif)" error={errors.userId}>
            <select {...props('userId')} value={form.userId} onChange={(e) => set('userId', e.target.value)}>
              <option value="">— Aucun compte —</option>
              {accounts.map((a) => <option key={a.id} value={a.id}>{a.displayName}</option>)}
              {employee?.userId && !accounts.some((a) => a.id === employee.userId) && <option value={employee.userId}>{employee.userName ?? 'Compte lié'}</option>}
            </select>
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
