'use client';

import { useEffect, useState } from 'react';
import { api, ApiError } from '../../lib/api';
import { type Employee, fullName } from '../../lib/hr';
import {
  type Adjustment, type AdjustmentForm, daysText, dayText, EMPTY_LEAVE_FORM, EMPTY_TYPE_FORM, type LeaveForm, leaveBody, type LeaveRequest, type LeaveType, parseDays, periodLabel,
  type TypeForm, typeForm, validateAdjustment, validateHoliday, validateLeaveForm, validateReason, validateTypeForm,
} from '../../lib/leave';
import { todayIso } from '../../lib/receipts';
import { FormField, fieldProps } from '../form-field';
import { Modal } from '../modal';

const failure = (e: unknown, fallback: string): string => (e instanceof ApiError || e instanceof Error ? e.message : fallback);

// ───────────────────────────── Demander une absence ─────────────────────────────

const REQUEST = 'leave-request';

/**
 * Demande d'absence. L'employé du compte demande pour lui ; la RH peut choisir un autre employé (la demande est alors validée d'emblée). Aucun diagnostic, aucune pièce :
 * le motif est libre et facultatif. Le serveur reste juge du solde, des chevauchements, des jours fériés et du plafond du type.
 */
export function LeaveRequestDialog({ types, allowHalfDays, canBackdate, canPickEmployee, onClose, onDone }: {
  types: LeaveType[]; allowHalfDays: boolean; canBackdate: boolean; canPickEmployee: boolean; onClose: () => void; onDone: () => Promise<void>;
}) {
  const today = todayIso();
  const [form, setForm] = useState<LeaveForm>(EMPTY_LEAVE_FORM(today));
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [submitted, setSubmitted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const problems = validateLeaveForm(form, { today, allowHalfDays, canBackdate });
  const shown = submitted ? problems : {};
  const set = <K extends keyof LeaveForm>(key: K, value: LeaveForm[K]) => setForm((f) => ({ ...f, [key]: value }));

  useEffect(() => {
    if (!canPickEmployee) return;
    api<{ items: Employee[] }>('/hr/employees?status=ACTIVE&pageSize=100').then((page) => setEmployees(page.items)).catch(() => setEmployees([]));
  }, [canPickEmployee]);

  async function send() {
    setSubmitted(true);
    if (Object.keys(problems).length > 0) return;
    setBusy(true);
    setError(null);
    try {
      await api('/hr/leave/requests', { method: 'POST', body: leaveBody(form) });
      await onDone();
    } catch (e) {
      setBusy(false);
      setError(failure(e, 'Demande impossible'));
    }
  }

  return (
    <Modal title="Demander une absence" onClose={onClose}>
      {canPickEmployee && (
        <FormField prefix={REQUEST} name="employeeId" label="Employé">
          <select {...fieldProps(REQUEST, 'employeeId')} value={form.employeeId} onChange={(e) => set('employeeId', e.target.value)}>
            <option value="">Moi-même</option>
            {employees.map((e) => <option key={e.id} value={e.id}>{fullName(e)}</option>)}
          </select>
        </FormField>
      )}
      {canPickEmployee && form.employeeId && <p className="m-0 mb-3 text-ink-2">Saisie pour un autre employé : l’absence est validée d’emblée.</p>}
      <FormField prefix={REQUEST} name="leaveTypeId" label="Type d’absence" error={shown.leaveTypeId}>
        <select {...fieldProps(REQUEST, 'leaveTypeId', shown.leaveTypeId)} value={form.leaveTypeId} onChange={(e) => set('leaveTypeId', e.target.value)} required aria-required="true">
          <option value="">Choisir…</option>
          {types.map((t) => <option key={t.id} value={t.id}>{t.label}{t.requiresApproval ? '' : ' (sans validation)'}</option>)}
        </select>
      </FormField>
      <div className="grid gap-x-4 sm:grid-cols-2">
        <FormField prefix={REQUEST} name="start" label="Du" error={shown.start}>
          <input {...fieldProps(REQUEST, 'start', shown.start)} type="date" value={form.start} min={canBackdate ? undefined : today} onChange={(e) => { set('start', e.target.value); if (form.end < e.target.value) set('end', e.target.value); }} required aria-required="true" />
        </FormField>
        <FormField prefix={REQUEST} name="end" label="Au (inclus)" error={shown.end}>
          <input {...fieldProps(REQUEST, 'end', shown.end)} type="date" value={form.end} min={form.start || undefined} onChange={(e) => set('end', e.target.value)} required aria-required="true" />
        </FormField>
      </div>
      {allowHalfDays && (
        <fieldset className="mb-3 border-0 p-0">
          <legend className="mb-1 text-[length:var(--text-sm)] font-semibold">Demi-journées</legend>
          <label className="mb-1 flex items-center gap-2 font-normal"><input type="checkbox" checked={form.startHalf} onChange={(e) => set('startHalf', e.target.checked)} style={{ width: 'auto', margin: 0 }} />La première journée commence l’après-midi</label>
          <label className="flex items-center gap-2 font-normal"><input type="checkbox" checked={form.endHalf} onChange={(e) => set('endHalf', e.target.checked)} style={{ width: 'auto', margin: 0 }} />La dernière journée s’arrête à midi</label>
          {shown.half && <p className="field-error">{shown.half}</p>}
        </fieldset>
      )}
      <FormField prefix={REQUEST} name="note" label="Motif (facultatif)" error={shown.note}>
        <textarea {...fieldProps(REQUEST, 'note', shown.note)} value={form.note} onChange={(e) => set('note', e.target.value)} rows={3} maxLength={500} />
      </FormField>
      <p className="m-0 mb-3 text-ink-2">Les week-ends et les jours fériés ne sont pas décomptés. N’indiquez aucune information de santé : un motif libre suffit.</p>
      {error && <p role="alert" className="error">{error}</p>}
      <div className="row end">
        <button type="button" className="secondary" onClick={onClose}>Retour</button>
        <button type="button" disabled={busy} onClick={() => void send()}>Envoyer la demande</button>
      </div>
    </Modal>
  );
}

// ───────────────────────────── Valider, refuser, annuler ─────────────────────────────

const DECISION = 'leave-decision';

/** Valider ou refuser une demande en attente. Un refus exige un motif, que l'employé verra. */
export function LeaveDecisionDialog({ request, decision, onClose, onDone }: { request: LeaveRequest; decision: 'APPROVE' | 'REJECT'; onClose: () => void; onDone: () => Promise<void> }) {
  const reject = decision === 'REJECT';
  const [note, setNote] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const problem = validateReason(note, reject);

  async function confirm() {
    setSubmitted(true);
    if (problem) return;
    setBusy(true);
    setError(null);
    try {
      await api(`/hr/leave/requests/${request.id}/decision`, { method: 'POST', body: { decision, version: request.version, ...(note.trim() ? { note: note.trim() } : {}) } });
      await onDone();
    } catch (e) {
      setBusy(false);
      setError(failure(e, 'Décision impossible'));
    }
  }

  return (
    <Modal title={reject ? 'Refuser la demande' : 'Valider la demande'} onClose={onClose}>
      <p className="m-0 mb-3"><strong>{request.employeeName}</strong> : {request.leaveTypeLabel}, {periodLabel(request)} ({daysText(request.days)}).</p>
      {request.note && <p className="m-0 mb-3 text-ink-2">Motif indiqué : {request.note}</p>}
      <FormField prefix={DECISION} name="note" label={reject ? 'Motif du refus' : 'Commentaire (facultatif)'} error={submitted ? problem : undefined}>
        <textarea {...fieldProps(DECISION, 'note', submitted ? problem : undefined)} value={note} onChange={(e) => setNote(e.target.value)} rows={3} maxLength={500} required={reject} aria-required={reject} />
      </FormField>
      <p className="m-0 mb-3 text-ink-2">La décision est enregistrée dans l’audit. {reject ? 'Le solde n’est pas touché.' : 'Le solde est vérifié de nouveau à la validation.'}</p>
      {error && <p role="alert" className="error">{error}</p>}
      <div className="row end">
        <button type="button" className="secondary" onClick={onClose}>Retour</button>
        <button type="button" disabled={busy} onClick={() => void confirm()}>{reject ? 'Refuser' : 'Valider'}</button>
      </div>
    </Modal>
  );
}

const CANCEL = 'leave-cancel';

/** Annuler sa demande. Le motif n'est exigé que pour une absence déjà validée. */
export function LeaveCancelDialog({ request, onClose, onDone }: { request: LeaveRequest; onClose: () => void; onDone: () => Promise<void> }) {
  const needsReason = request.status === 'APPROVED';
  const [reason, setReason] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const problem = validateReason(reason, needsReason);

  async function confirm() {
    setSubmitted(true);
    if (problem) return;
    setBusy(true);
    setError(null);
    try {
      await api(`/hr/leave/requests/${request.id}/cancel`, { method: 'POST', body: { version: request.version, ...(reason.trim() ? { reason: reason.trim() } : {}) } });
      await onDone();
    } catch (e) {
      setBusy(false);
      setError(failure(e, 'Annulation impossible'));
    }
  }

  return (
    <Modal title="Annuler la demande" onClose={onClose}>
      <p className="m-0 mb-3">{request.leaveTypeLabel}, {periodLabel(request)} ({daysText(request.days)}). Les jours sont rendus au solde.</p>
      <FormField prefix={CANCEL} name="reason" label={needsReason ? 'Motif de l’annulation' : 'Motif (facultatif)'} error={submitted ? problem : undefined}>
        <textarea {...fieldProps(CANCEL, 'reason', submitted ? problem : undefined)} value={reason} onChange={(e) => setReason(e.target.value)} rows={3} maxLength={500} required={needsReason} aria-required={needsReason} />
      </FormField>
      {error && <p role="alert" className="error">{error}</p>}
      <div className="row end">
        <button type="button" className="secondary" onClick={onClose}>Retour</button>
        <button type="button" disabled={busy} onClick={() => void confirm()}>Annuler la demande</button>
      </div>
    </Modal>
  );
}

// ───────────────────────────── Ajuster un solde (RH) ─────────────────────────────

const ADJUST = 'leave-adjust';

/** Ajustement de solde : report, correction. Ajout seul (jamais de modification d'un ajustement passé), motif obligatoire ; l'historique de l'année est affiché. */
export function AdjustmentDialog({ employeeId, employeeName, year, onClose, onDone }: { employeeId: string; employeeName: string; year: number; onClose: () => void; onDone: () => Promise<void> }) {
  const [form, setForm] = useState<AdjustmentForm>({ days: '', reason: '' });
  const [history, setHistory] = useState<Adjustment[] | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const problems = validateAdjustment(form);
  const shown = submitted ? problems : {};

  useEffect(() => {
    api<Adjustment[]>(`/hr/leave/adjustments?employeeId=${employeeId}&year=${year}`).then(setHistory).catch(() => setHistory([]));
  }, [employeeId, year]);

  async function send() {
    setSubmitted(true);
    if (Object.keys(problems).length > 0) return;
    setBusy(true);
    setError(null);
    try {
      await api('/hr/leave/adjustments', { method: 'POST', body: { employeeId, year, days: parseDays(form.days), reason: form.reason.trim() } });
      await onDone();
    } catch (e) {
      setBusy(false);
      setError(failure(e, 'Ajustement impossible'));
    }
  }

  return (
    <Modal title={`Ajuster le solde ${year}`} onClose={onClose}>
      <p className="m-0 mb-3"><strong>{employeeName}</strong>. Un nombre positif ajoute des jours (report, geste), un nombre négatif en retire. Un ajustement n’est jamais modifié ni supprimé : on en ajoute un autre pour corriger.</p>
      <FormField prefix={ADJUST} name="days" label="Jours (par demi-journée)" error={shown.days}>
        <input {...fieldProps(ADJUST, 'days', shown.days)} inputMode="decimal" value={form.days} onChange={(e) => setForm((f) => ({ ...f, days: e.target.value }))} placeholder="par exemple 5 ou -1,5" required aria-required="true" />
      </FormField>
      <FormField prefix={ADJUST} name="reason" label="Motif" error={shown.reason}>
        <textarea {...fieldProps(ADJUST, 'reason', shown.reason)} value={form.reason} onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))} rows={3} maxLength={500} required aria-required="true" />
      </FormField>
      {history && history.length > 0 && (
        <section aria-label={`Ajustements ${year}`} className="mb-3">
          <h3 className="m-0 mb-1 text-[length:var(--text-sm)]">Déjà enregistrés en {year}</h3>
          <ul className="m-0 list-none p-0 text-[length:var(--text-sm)]">
            {history.map((a) => <li key={a.id} className="border-b border-line py-1 last:border-0"><strong>{a.days > 0 ? '+' : ''}{daysText(a.days)}</strong> le {dayText(a.createdAt.slice(0, 10))} : {a.reason}</li>)}
          </ul>
        </section>
      )}
      {error && <p role="alert" className="error">{error}</p>}
      <div className="row end">
        <button type="button" className="secondary" onClick={onClose}>Retour</button>
        <button type="button" disabled={busy} onClick={() => void send()}>Enregistrer l’ajustement</button>
      </div>
    </Modal>
  );
}

// ───────────────────────────── Types d'absence (RH) ─────────────────────────────

const TYPE = 'leave-type';

/** Création ou modification d'un type d'absence. Un type ne se supprime pas : il se désactive (les demandes passées le gardent). */
export function LeaveTypeDialog({ type, onClose, onDone }: { type?: LeaveType; onClose: () => void; onDone: () => Promise<void> }) {
  const creating = !type;
  const [form, setForm] = useState<TypeForm>(type ? typeForm(type) : EMPTY_TYPE_FORM);
  const [active, setActive] = useState(type?.active ?? true);
  const [submitted, setSubmitted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const problems = validateTypeForm(form, creating);
  const shown = submitted ? problems : {};
  const set = <K extends keyof TypeForm>(key: K, value: TypeForm[K]) => setForm((f) => ({ ...f, [key]: value }));

  async function save() {
    setSubmitted(true);
    if (Object.keys(problems).length > 0) return;
    setBusy(true);
    setError(null);
    const max = form.maxDays.trim() ? parseDays(form.maxDays) : null;
    try {
      if (creating) {
        await api('/hr/leave/types', {
          method: 'POST',
          body: { code: form.code.trim(), label: form.label.trim(), deductsBalance: form.deductsBalance, requiresApproval: form.requiresApproval, ...(max !== null ? { maxDaysPerRequest: max } : {}), sortOrder: Number(form.sortOrder) },
        });
      } else {
        await api(`/hr/leave/types/${type.id}`, {
          method: 'PUT',
          body: { version: type.version, label: form.label.trim(), deductsBalance: form.deductsBalance, requiresApproval: form.requiresApproval, maxDaysPerRequest: max, active, sortOrder: Number(form.sortOrder) },
        });
      }
      await onDone();
    } catch (e) {
      setBusy(false);
      setError(failure(e, 'Enregistrement impossible'));
    }
  }

  return (
    <Modal title={creating ? 'Nouveau type d’absence' : `Modifier « ${type.label} »`} onClose={onClose}>
      {creating && (
        <FormField prefix={TYPE} name="code" label="Code (fixé à la création)" error={shown.code}>
          <input {...fieldProps(TYPE, 'code', shown.code)} value={form.code} onChange={(e) => set('code', e.target.value.toUpperCase())} maxLength={30} placeholder="par exemple STUDY" required aria-required="true" />
        </FormField>
      )}
      <FormField prefix={TYPE} name="label" label="Libellé" error={shown.label}>
        <input {...fieldProps(TYPE, 'label', shown.label)} value={form.label} onChange={(e) => set('label', e.target.value)} maxLength={100} required aria-required="true" />
      </FormField>
      <label className="mb-2 flex items-center gap-2 font-normal"><input type="checkbox" checked={form.deductsBalance} onChange={(e) => set('deductsBalance', e.target.checked)} style={{ width: 'auto', margin: 0 }} />Décompte le solde de congé annuel</label>
      <label className="mb-3 flex items-center gap-2 font-normal"><input type="checkbox" checked={form.requiresApproval} onChange={(e) => set('requiresApproval', e.target.checked)} style={{ width: 'auto', margin: 0 }} />Demande une validation</label>
      <div className="grid gap-x-4 sm:grid-cols-2">
        <FormField prefix={TYPE} name="maxDays" label="Plafond par demande (jours)" error={shown.maxDays}>
          <input {...fieldProps(TYPE, 'maxDays', shown.maxDays)} inputMode="decimal" value={form.maxDays} onChange={(e) => set('maxDays', e.target.value)} placeholder="aucun" />
        </FormField>
        <FormField prefix={TYPE} name="sortOrder" label="Ordre d’affichage" error={shown.sortOrder}>
          <input {...fieldProps(TYPE, 'sortOrder', shown.sortOrder)} inputMode="numeric" value={form.sortOrder} onChange={(e) => set('sortOrder', e.target.value)} />
        </FormField>
      </div>
      {!creating && <label className="mb-3 flex items-center gap-2 font-normal"><input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} style={{ width: 'auto', margin: 0 }} />Actif (proposé dans les demandes)</label>}
      {error && <p role="alert" className="error">{error}</p>}
      <div className="row end">
        <button type="button" className="secondary" onClick={onClose}>Retour</button>
        <button type="button" disabled={busy} onClick={() => void save()}>Enregistrer</button>
      </div>
    </Modal>
  );
}

// ───────────────────────────── Jour férié (RH) ─────────────────────────────

const HOLIDAY = 'leave-holiday';

export function HolidayDialog({ year, onClose, onDone }: { year: number; onClose: () => void; onDone: () => Promise<void> }) {
  const [day, setDay] = useState(`${year}-01-01`);
  const [label, setLabel] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const problems = validateHoliday(day, label);
  const shown = submitted ? problems : {};

  async function save() {
    setSubmitted(true);
    if (Object.keys(problems).length > 0) return;
    setBusy(true);
    setError(null);
    try {
      await api('/hr/leave/holidays', { method: 'POST', body: { day, label: label.trim() } });
      await onDone();
    } catch (e) {
      setBusy(false);
      setError(failure(e, 'Ajout impossible'));
    }
  }

  return (
    <Modal title="Ajouter un jour férié" onClose={onClose}>
      <FormField prefix={HOLIDAY} name="day" label="Date" error={shown.day}>
        <input {...fieldProps(HOLIDAY, 'day', shown.day)} type="date" value={day} onChange={(e) => setDay(e.target.value)} required aria-required="true" />
      </FormField>
      <FormField prefix={HOLIDAY} name="label" label="Libellé" error={shown.label}>
        <input {...fieldProps(HOLIDAY, 'label', shown.label)} value={label} onChange={(e) => setLabel(e.target.value)} maxLength={100} placeholder="par exemple Fête nationale" required aria-required="true" />
      </FormField>
      {error && <p role="alert" className="error">{error}</p>}
      <div className="row end">
        <button type="button" className="secondary" onClick={onClose}>Retour</button>
        <button type="button" disabled={busy} onClick={() => void save()}>Ajouter</button>
      </div>
    </Modal>
  );
}
