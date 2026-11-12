'use client';

import { useEffect, useState } from 'react';
import { api, ApiError } from '../../lib/api';
import {
  adjustBody, adjustFormOf, type AdjustForm, type Contract, contractBody, type ContractForm, type ContractType, EMPTY_CONTRACT_FORM, EMPTY_TYPE_FORM, END_REASONS, type EndForm,
  type TypeForm, typeFormOf, validateAdjust, validateContractForm, validateEnd, validateTypeForm,
} from '../../lib/contracts';
import { type Employee, fullName } from '../../lib/hr';
import { todayIso } from '../../lib/receipts';
import { FormField, fieldProps } from '../form-field';
import { Modal } from '../modal';

const failure = (e: unknown, fallback: string): string => (e instanceof ApiError || e instanceof Error ? e.message : fallback);

// ───────────────────────────── Nouveau contrat ─────────────────────────────

const NEW = 'contract-new';

/**
 * Nouveau contrat (RH). Un seul contrat peut être en cours par employé : le serveur refuse un second, et un contrat qui recouvre un contrat terminé. Aucun salaire,
 * aucun document : un type, des dates, une fin de période d'essai. La date de fin n'existe que pour un type à durée déterminée.
 */
export function ContractDialog({ types, onClose, onDone }: { types: ContractType[]; onClose: () => void; onDone: () => Promise<void> }) {
  const today = todayIso();
  const [form, setForm] = useState<ContractForm>(EMPTY_CONTRACT_FORM(today));
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [submitted, setSubmitted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const type = types.find((t) => t.id === form.contractTypeId) ?? null;
  const problems = validateContractForm(form, type);
  const shown = submitted ? problems : {};
  const set = <K extends keyof ContractForm>(key: K, value: ContractForm[K]) => setForm((f) => ({ ...f, [key]: value }));

  useEffect(() => {
    api<{ items: Employee[] }>('/hr/employees?status=ACTIVE&pageSize=100').then((page) => setEmployees(page.items)).catch(() => setError('La liste du personnel est indisponible.'));
  }, []);

  async function send() {
    setSubmitted(true);
    if (Object.keys(problems).length > 0) return;
    setBusy(true);
    setError(null);
    try {
      await api('/hr/contracts', { method: 'POST', body: contractBody(form) });
      await onDone();
    } catch (e) {
      setBusy(false);
      setError(failure(e, 'Enregistrement impossible'));
    }
  }

  return (
    <Modal title="Nouveau contrat" onClose={onClose}>
      <FormField prefix={NEW} name="employeeId" label="Employé" error={shown.employeeId}>
        <select {...fieldProps(NEW, 'employeeId', shown.employeeId)} value={form.employeeId} onChange={(e) => set('employeeId', e.target.value)} required aria-required="true">
          <option value="">Choisir…</option>
          {employees.map((e) => <option key={e.id} value={e.id}>{fullName(e)}</option>)}
        </select>
      </FormField>
      <FormField prefix={NEW} name="contractTypeId" label="Type de contrat" error={shown.contractTypeId}>
        <select
          {...fieldProps(NEW, 'contractTypeId', shown.contractTypeId)}
          value={form.contractTypeId}
          onChange={(e) => { const next = types.find((t) => t.id === e.target.value); setForm((f) => ({ ...f, contractTypeId: e.target.value, end: next && !next.fixedTerm ? '' : f.end })); }}
          required
          aria-required="true"
        >
          <option value="">Choisir…</option>
          {types.filter((t) => t.active).map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
        </select>
      </FormField>
      <div className="grid gap-x-4 sm:grid-cols-2">
        <FormField prefix={NEW} name="start" label="Début" error={shown.start}>
          <input {...fieldProps(NEW, 'start', shown.start)} type="date" value={form.start} onChange={(e) => set('start', e.target.value)} required aria-required="true" />
        </FormField>
        {type?.fixedTerm !== false && (
          <FormField prefix={NEW} name="end" label={type?.fixedTerm ? 'Fin' : 'Fin (durée déterminée seulement)'} error={shown.end}>
            <input {...fieldProps(NEW, 'end', shown.end)} type="date" value={form.end} min={form.start || undefined} onChange={(e) => set('end', e.target.value)} required={type?.fixedTerm} aria-required={type?.fixedTerm} />
          </FormField>
        )}
      </div>
      <FormField prefix={NEW} name="probationEnd" label="Fin de la période d’essai (facultatif)" error={shown.probationEnd}>
        <input {...fieldProps(NEW, 'probationEnd', shown.probationEnd)} type="date" value={form.probationEnd} min={form.start || undefined} onChange={(e) => set('probationEnd', e.target.value)} />
      </FormField>
      <p className="m-0 mb-3 text-ink-2">Un seul contrat peut être en cours par employé. Ni salaire ni document ne sont enregistrés ici.</p>
      {error && <p role="alert" className="error">{error}</p>}
      <div className="row end">
        <button type="button" className="secondary" onClick={onClose}>Annuler</button>
        <button type="button" disabled={busy} onClick={() => void send()}>Enregistrer</button>
      </div>
    </Modal>
  );
}

// ───────────────────────────── Ajuster ─────────────────────────────

const ADJUST = 'contract-adjust';

/** Ajuster un contrat en cours : prolonger la fin (durée déterminée) ou déplacer la fin de la période d'essai. Le début ne change jamais. */
export function AdjustContractDialog({ contract, onClose, onDone }: { contract: Contract; onClose: () => void; onDone: () => Promise<void> }) {
  const [form, setForm] = useState<AdjustForm>(adjustFormOf(contract));
  const [submitted, setSubmitted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const problems = validateAdjust(form, contract);
  const shown = submitted ? problems : {};

  async function send() {
    setSubmitted(true);
    if (Object.keys(problems).length > 0) return;
    setBusy(true);
    setError(null);
    try {
      await api(`/hr/contracts/${contract.id}`, { method: 'PUT', body: adjustBody(form, contract) });
      await onDone();
    } catch (e) {
      setBusy(false);
      setError(failure(e, 'Enregistrement impossible'));
    }
  }

  return (
    <Modal title="Ajuster le contrat" onClose={onClose}>
      <p className="m-0 mb-3"><strong>{contract.employeeName}</strong> : {contract.contractTypeLabel}, depuis le {new Date(`${contract.start}T00:00:00Z`).toLocaleDateString('fr-FR', { timeZone: 'UTC' })}.</p>
      {contract.fixedTerm && (
        <FormField prefix={ADJUST} name="end" label="Fin du contrat" error={shown.end}>
          <input {...fieldProps(ADJUST, 'end', shown.end)} type="date" value={form.end} min={contract.start} onChange={(e) => setForm({ ...form, end: e.target.value })} required aria-required="true" />
        </FormField>
      )}
      <FormField prefix={ADJUST} name="probationEnd" label="Fin de la période d’essai (vide : aucune)" error={shown.probationEnd}>
        <input {...fieldProps(ADJUST, 'probationEnd', shown.probationEnd)} type="date" value={form.probationEnd} min={contract.start} onChange={(e) => setForm({ ...form, probationEnd: e.target.value })} />
      </FormField>
      <p className="m-0 mb-3 text-ink-2">Le changement est enregistré dans l’audit avec l’ancienne et la nouvelle valeur.</p>
      {error && <p role="alert" className="error">{error}</p>}
      <div className="row end">
        <button type="button" className="secondary" onClick={onClose}>Annuler</button>
        <button type="button" disabled={busy} onClick={() => void send()}>Enregistrer</button>
      </div>
    </Modal>
  );
}

// ───────────────────────────── Terminer ─────────────────────────────

const END = 'contract-end';

/** Mettre fin à un contrat : une date et un motif choisi dans une liste fermée (jamais un texte libre). Le contrat est conservé, terminé. */
export function EndContractDialog({ contract, onClose, onDone }: { contract: Contract; onClose: () => void; onDone: () => Promise<void> }) {
  const [form, setForm] = useState<EndForm>({ endedOn: contract.end && contract.end < todayIso() ? contract.end : todayIso(), reason: '' });
  const [submitted, setSubmitted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const problems = validateEnd(form, contract);
  const shown = submitted ? problems : {};

  async function send() {
    setSubmitted(true);
    if (Object.keys(problems).length > 0) return;
    setBusy(true);
    setError(null);
    try {
      await api(`/hr/contracts/${contract.id}/end`, { method: 'POST', body: { version: contract.version, endedOn: form.endedOn, reason: form.reason } });
      await onDone();
    } catch (e) {
      setBusy(false);
      setError(failure(e, 'Fin de contrat impossible'));
    }
  }

  return (
    <Modal title="Mettre fin au contrat" onClose={onClose}>
      <p className="m-0 mb-3"><strong>{contract.employeeName}</strong> : {contract.contractTypeLabel}.</p>
      <FormField prefix={END} name="endedOn" label="Date de fin effective" error={shown.endedOn}>
        <input {...fieldProps(END, 'endedOn', shown.endedOn)} type="date" value={form.endedOn} min={contract.start} max={contract.end ?? undefined} onChange={(e) => setForm({ ...form, endedOn: e.target.value })} required aria-required="true" />
      </FormField>
      <FormField prefix={END} name="reason" label="Motif" error={shown.reason}>
        <select {...fieldProps(END, 'reason', shown.reason)} value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} required aria-required="true">
          <option value="">Choisir…</option>
          {END_REASONS.map((r) => <option key={r.code} value={r.code}>{r.label}</option>)}
        </select>
      </FormField>
      <p className="m-0 mb-3 text-ink-2">Le contrat est conservé, marqué terminé, et ne pourra plus être modifié. Le motif se choisit dans une liste : aucun texte libre n’est enregistré.</p>
      {error && <p role="alert" className="error">{error}</p>}
      <div className="row end">
        <button type="button" className="secondary" onClick={onClose}>Annuler</button>
        <button type="button" className="danger" disabled={busy} onClick={() => void send()}>Terminer le contrat</button>
      </div>
    </Modal>
  );
}

// ───────────────────────────── Types de contrat ─────────────────────────────

const TYPE = 'contract-type';

/** Créer ou modifier un type de contrat (RH). Le code et la nature (durée déterminée ou non) ne changent plus après la création ; un type se désactive, il ne se supprime pas. */
export function ContractTypeDialog({ type, onClose, onDone }: { type?: ContractType; onClose: () => void; onDone: () => Promise<void> }) {
  const [form, setForm] = useState<TypeForm>(type ? typeFormOf(type) : EMPTY_TYPE_FORM);
  const [active, setActive] = useState(type?.active ?? true);
  const [submitted, setSubmitted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const problems = validateTypeForm(form, { creating: !type });
  const shown = submitted ? problems : {};

  async function send() {
    setSubmitted(true);
    if (Object.keys(problems).length > 0) return;
    setBusy(true);
    setError(null);
    try {
      const sortOrder = Number(form.sortOrder);
      if (type) await api(`/hr/contracts/types/${type.id}`, { method: 'PUT', body: { version: type.version, label: form.label.trim(), active, sortOrder } });
      else await api('/hr/contracts/types', { method: 'POST', body: { code: form.code.trim().toUpperCase(), label: form.label.trim(), fixedTerm: form.fixedTerm, sortOrder } });
      await onDone();
    } catch (e) {
      setBusy(false);
      setError(failure(e, 'Enregistrement impossible'));
    }
  }

  return (
    <Modal title={type ? 'Modifier le type de contrat' : 'Nouveau type de contrat'} onClose={onClose}>
      <FormField prefix={TYPE} name="code" label="Code" error={shown.code}>
        <input {...fieldProps(TYPE, 'code', shown.code)} value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} maxLength={30} disabled={!!type} placeholder="APPRENTI" />
      </FormField>
      <FormField prefix={TYPE} name="label" label="Libellé" error={shown.label}>
        <input {...fieldProps(TYPE, 'label', shown.label)} value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} maxLength={100} required aria-required="true" />
      </FormField>
      <label className="mb-3 flex items-center gap-2 font-normal">
        <input type="checkbox" checked={form.fixedTerm} disabled={!!type} onChange={(e) => setForm({ ...form, fixedTerm: e.target.checked })} style={{ width: 'auto', margin: 0 }} />
        Durée déterminée : la date de fin est obligatoire
      </label>
      <FormField prefix={TYPE} name="sortOrder" label="Ordre d’affichage" error={shown.sortOrder}>
        <input {...fieldProps(TYPE, 'sortOrder', shown.sortOrder)} inputMode="numeric" value={form.sortOrder} onChange={(e) => setForm({ ...form, sortOrder: e.target.value })} style={{ maxWidth: '8rem' }} />
      </FormField>
      {type && (
        <label className="mb-3 flex items-center gap-2 font-normal">
          <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} style={{ width: 'auto', margin: 0 }} />
          Actif : proposé pour les nouveaux contrats
        </label>
      )}
      <p className="m-0 mb-3 text-ink-2">Aucune règle légale n’est appliquée par la plateforme (durée maximale, essai, renouvellement) : elles relèvent de votre règlement et du droit applicable.</p>
      {error && <p role="alert" className="error">{error}</p>}
      <div className="row end">
        <button type="button" className="secondary" onClick={onClose}>Annuler</button>
        <button type="button" disabled={busy} onClick={() => void send()}>Enregistrer</button>
      </div>
    </Modal>
  );
}
