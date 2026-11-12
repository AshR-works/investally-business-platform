'use client';

import { useEffect, useState } from 'react';
import { api, ApiError } from '../../lib/api';
import { type Employee, fullName } from '../../lib/hr';
import { EMPTY_LAUNCH_FORM, type Journey, KIND_LABEL, type LaunchForm, launchBody, validateLaunch } from '../../lib/journeys';
import { ConfirmDialog } from '../confirm-dialog';
import { FormField, fieldProps } from '../form-field';
import { Modal } from '../modal';

const failure = (e: unknown, fallback: string): string => (e instanceof ApiError || e instanceof Error ? e.message : fallback);

const LAUNCH = 'journey-launch';

/**
 * Lancer un parcours (RH), à la main : pour un employé en poste, une nature (intégration ou départ) et, si besoin, une date de référence (par défaut la date d'entrée
 * pour une intégration, aujourd'hui pour un départ). Les tâches sont copiées du modèle : le modifier ensuite ne change pas ce parcours. Un seul parcours est en cours
 * par employé et par nature.
 */
export function LaunchJourneyDialog({ onClose, onDone }: { onClose: () => void; onDone: (journey: Journey) => Promise<void> }) {
  const [form, setForm] = useState<LaunchForm>(EMPTY_LAUNCH_FORM);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [submitted, setSubmitted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const problems = validateLaunch(form);
  const shown = submitted ? problems : {};

  useEffect(() => {
    api<{ items: Employee[] }>('/hr/employees?status=ACTIVE&pageSize=100').then((page) => setEmployees(page.items)).catch(() => setError('La liste du personnel est indisponible.'));
  }, []);

  async function send() {
    setSubmitted(true);
    if (Object.keys(problems).length > 0) return;
    setBusy(true);
    setError(null);
    try {
      await onDone(await api<Journey>('/hr/journeys', { method: 'POST', body: launchBody(form) }));
    } catch (e) {
      setBusy(false);
      setError(failure(e, 'Lancement impossible'));
    }
  }

  return (
    <Modal title="Lancer un parcours" onClose={onClose}>
      <FormField prefix={LAUNCH} name="employeeId" label="Employé" error={shown.employeeId}>
        <select {...fieldProps(LAUNCH, 'employeeId', shown.employeeId)} value={form.employeeId} onChange={(e) => setForm({ ...form, employeeId: e.target.value })} required aria-required="true">
          <option value="">Choisir…</option>
          {employees.map((e) => <option key={e.id} value={e.id}>{fullName(e)}</option>)}
        </select>
      </FormField>
      <FormField prefix={LAUNCH} name="kind" label="Nature" error={shown.kind}>
        <select {...fieldProps(LAUNCH, 'kind', shown.kind)} value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value as LaunchForm['kind'] })} required aria-required="true">
          <option value="">Choisir…</option>
          <option value="ONBOARDING">{KIND_LABEL.ONBOARDING}</option>
          <option value="OFFBOARDING">{KIND_LABEL.OFFBOARDING}</option>
        </select>
      </FormField>
      <FormField prefix={LAUNCH} name="referenceDate" label="Date de référence (facultatif)" error={shown.referenceDate}>
        <input {...fieldProps(LAUNCH, 'referenceDate', shown.referenceDate)} type="date" value={form.referenceDate} onChange={(e) => setForm({ ...form, referenceDate: e.target.value })} />
      </FormField>
      <p className="m-0 mb-3 text-ink-2">Les échéances des tâches se calculent à partir de cette date. Absente : la date d’entrée de l’employé (intégration) ou aujourd’hui (départ).</p>
      {error && <p role="alert" className="error">{error}</p>}
      <div className="row end">
        <button type="button" className="secondary" onClick={onClose}>Annuler</button>
        <button type="button" disabled={busy} onClick={() => void send()}>Lancer le parcours</button>
      </div>
    </Modal>
  );
}

/** Annuler un parcours en cours : il est conservé avec ses tâches, mais ne se coche plus. */
export function CancelJourneyDialog({ journey, onClose, onDone }: { journey: Journey; onClose: () => void; onDone: () => Promise<void> }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function confirm() {
    setBusy(true);
    setError(null);
    try {
      await api(`/hr/journeys/${journey.id}/cancel`, { method: 'POST', body: { version: journey.version } });
      await onDone();
    } catch (e) {
      setBusy(false);
      setError(failure(e, 'Annulation impossible'));
    }
  }

  return (
    <ConfirmDialog title="Annuler le parcours" confirmLabel="Annuler le parcours" cancelLabel="Retour" busy={busy} onConfirm={() => void confirm()} onCancel={onClose}>
      <p className="m-0">
        Annuler le parcours « {journey.kindLabel} » de <strong>{journey.employeeName}</strong> ? Il est conservé avec ses tâches, mais elles ne pourront plus être cochées.
      </p>
      {error && <p role="alert" className="error mt-3">{error}</p>}
    </ConfirmDialog>
  );
}
