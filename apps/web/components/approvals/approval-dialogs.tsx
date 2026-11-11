'use client';

import { FormEvent, useEffect, useState } from 'react';
import { api, ApiError } from '../../lib/api';
import { APPROVAL_ACTION_LABEL, type ApprovalAction, type ApprovalPanelAction, PAYER_TYPES, type ApprovalField, type ApprovalForm, buildApprovalBody, coverageText, eligibleOpportunities, EMPTY_APPROVAL_FORM, validateApprovalFields, validateReason, validateReceivedOn } from '../../lib/approvals';
import { formatDate, precheckFile } from '../../lib/format';
import { todayIso } from '../../lib/receipts';
import type { Approval, Opportunity, Page, UploadRules } from '../../lib/types';
import { DocumentsPanel } from '../documents/documents-panel';
import { FormField, fieldProps } from '../form-field';
import { Modal } from '../modal';

const PREFIX = 'approval';

/** Fenêtre ouverte sur un agrément, ou pour en enregistrer un. */
export type ApprovalDialogState =
  | { kind: 'register'; company: { id: string; name: string } }
  | { kind: 'document'; approval: Approval }
  | { kind: ApprovalPanelAction; approval: Approval };

/** Toutes les fenêtres du cycle d'un agrément, rendues UNE fois par le panneau hôte, hors du tableau. */
export function ApprovalDialogs({ dialog, onClose, onDone }: { dialog: ApprovalDialogState | null; onClose: () => void; onDone: () => Promise<void> }) {
  if (!dialog) return null;
  if (dialog.kind === 'register') return <RegisterApprovalDialog company={dialog.company} onClose={onClose} onDone={onDone} />;
  if (dialog.kind === 'document') return <DocumentDialog approval={dialog.approval} onClose={onClose} />;
  if (dialog.kind === 'receive') return <ReceiveApprovalDialog approval={dialog.approval} onClose={onClose} onDone={onDone} />;
  return <CloseApprovalDialog approval={dialog.approval} action={dialog.kind} onClose={onClose} onDone={onDone} />;
}

/** Le document signé de l'agrément : consultation (liste, téléchargement) et ajout si l'envoi initial a échoué. */
function DocumentDialog({ approval, onClose }: { approval: Approval; onClose: () => void }) {
  return (
    <Modal title="Document signé de l’agrément" onClose={onClose} size="wide">
      <p className="m-0 mb-3 text-ink-2">{approval.opportunityTitle} · {coverageText(approval)}</p>
      <DocumentsPanel ownerType="approval" ownerId={approval.id} />
    </Modal>
  );
}

/**
 * Enregistrement d'un agrément : l'opportunité (accord de principe obtenu), le montant et/ou les places, la devise, les dates, le
 * payeur s'il est un tiers et le document signé. Une promesse pas encore signée s'enregistre comme « demandée » (sans date ni fichier).
 * Le document signé Le fichier est un document rattaché à l'agrément : envoyé juste après l'enregistrement ; si l'envoi échoue,
 * l'agrément reste enregistré et le fichier peut être ajouté depuis « Document ».
 */
function RegisterApprovalDialog({ company, onClose, onDone }: { company: { id: string; name: string }; onClose: () => void; onDone: () => Promise<void> }) {
  const [opportunities, setOpportunities] = useState<Opportunity[] | null>(null);
  const [rules, setRules] = useState<UploadRules | null>(null);
  const [form, setForm] = useState<ApprovalForm>(() => EMPTY_APPROVAL_FORM());
  const [file, setFile] = useState<File | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<Page<Opportunity>>(`/opportunities?companyId=${company.id}&pageSize=100`)
      .then((page) => setOpportunities(eligibleOpportunities(page.items)))
      .catch(() => setError('La liste des opportunités est indisponible.'));
    api<UploadRules>('/documents/meta').then(setRules).catch(() => setRules(null));
  }, [company.id]);

  const errors = submitted ? validateApprovalFields(form, { today: todayIso() }) : {};
  const fileProblem = submitted && !form.requested ? (file ? (rules ? precheckFile(file, rules) : null) : 'Joignez l’agrément signé (PDF, image ou document).') : null;
  const props = (name: ApprovalField) => fieldProps(PREFIX, name, errors[name]);
  const set = <K extends keyof ApprovalForm>(key: K, value: ApprovalForm[K]) => setForm((f) => ({ ...f, [key]: value }));

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSubmitted(true);
    const problems = validateApprovalFields(form, { today: todayIso() });
    const first = Object.keys(problems)[0];
    const noFile = !form.requested && (!file || (rules ? precheckFile(file, rules) : null));
    if (first || noFile) {
      setTimeout(() => document.getElementById(first ? `${PREFIX}-${first}` : `${PREFIX}-file`)?.focus(), 0);
      return;
    }
    setBusy(true);
    let created: Approval;
    try {
      created = await api<Approval>('/approvals', { method: 'POST', body: buildApprovalBody(form) });
    } catch (e) {
      setBusy(false);
      setError(e instanceof ApiError ? e.message : "Échec de l'enregistrement");
      return;
    }
    if (form.requested || !file) {
      await onDone();
      return;
    }
    try {
      const params = new URLSearchParams({ ownerType: 'approval', ownerId: created.id, title: `Agrément ${created.opportunityTitle}`, category: 'AGREMENT', fileName: file.name });
      await api(`/documents?${params}`, { method: 'POST', raw: { type: 'application/octet-stream', data: file } });
    } catch (e) {
      setError(`L’agrément est enregistré, mais le fichier n’a pas été envoyé (${e instanceof ApiError ? e.message : 'échec de l’envoi'}). Ajoutez-le depuis « Document » dans la liste des agréments.`);
      setBusy(false);
      await onDone();
      return;
    }
    await onDone();
  }

  const problems = Object.values(errors);
  return (
    <Modal title="Enregistrer un agrément" onClose={onClose} size="wide">
      <form onSubmit={(e) => void submit(e)} noValidate>
        <p className="m-0 mb-3 text-ink-2">Entreprise : <strong>{company.name}</strong>. {form.requested ? 'L’entreprise deviendra « Cliente » à la réception de la promesse signée.' : 'L’entreprise devient « Cliente » à l’enregistrement.'}</p>
        {submitted && (problems.length > 0 || fileProblem) && (
          <div role="alert" className="error">
            <p className="m-0 font-semibold">Corrigez les champs suivants :</p>
            <ul className="m-0 mt-1 pl-5">{problems.map((m) => <li key={m}>{m}</li>)}{fileProblem && <li>{fileProblem}</li>}</ul>
          </div>
        )}
        {error && <p role="alert" className="error">{error}</p>}
        {opportunities?.length === 0 && <p className="m-0 mb-3 text-ink-2">Aucune opportunité n’a franchi l’accord de principe : faites d’abord avancer l’opportunité.</p>}
        <FormField prefix={PREFIX} name="opportunityId" label="Opportunité" error={errors.opportunityId}>
          <select {...props('opportunityId')} value={form.opportunityId} onChange={(e) => set('opportunityId', e.target.value)} required aria-required="true">
            <option value="">Choisir…</option>
            {(opportunities ?? []).map((o) => <option key={o.id} value={o.id}>{o.title}</option>)}
          </select>
        </FormField>
        <FormField prefix={PREFIX} name="amount" label="Montant couvert (facultatif si des places sont indiquées)" error={errors.amount}>
          <input {...props('amount')} inputMode="decimal" value={form.amount} onChange={(e) => set('amount', e.target.value)} placeholder="12 500 000" />
        </FormField>
        <FormField prefix={PREFIX} name="places" label="Nombre de places couvertes (facultatif si un montant est indiqué)" error={errors.places}>
          <input {...props('places')} inputMode="numeric" value={form.places} onChange={(e) => set('places', e.target.value)} />
        </FormField>
        <FormField prefix={PREFIX} name="currency" label="Devise" error={errors.currency}>
          <input {...props('currency')} value={form.currency} onChange={(e) => set('currency', e.target.value)} maxLength={5} />
        </FormField>
        <div className="field">
          <label><input type="checkbox" checked={form.requested} onChange={(e) => set('requested', e.target.checked)} /> La promesse n’est pas encore signée (agrément demandé)</label>
        </div>
        {!form.requested && (
          <FormField prefix={PREFIX} name="receivedOn" label="Date de réception" error={errors.receivedOn}>
            <input {...props('receivedOn')} type="date" value={form.receivedOn} max={todayIso()} onChange={(e) => set('receivedOn', e.target.value)} required aria-required="true" />
          </FormField>
        )}
        <FormField prefix={PREFIX} name="validUntil" label="Valide jusqu’au (facultatif)" error={errors.validUntil}>
          <input {...props('validUntil')} type="date" value={form.validUntil} onChange={(e) => set('validUntil', e.target.value)} />
        </FormField>
        <FormField prefix={PREFIX} name="payerName" label="Payeur tiers (laisser vide si le client paie)" error={errors.payerName}>
          <input {...props('payerName')} value={form.payerName} onChange={(e) => set('payerName', e.target.value)} maxLength={200} />
        </FormField>
        <div className="field">
          <label htmlFor={`${PREFIX}-payerType`}>Type du payeur tiers</label>
          <select id={`${PREFIX}-payerType`} value={form.payerType} onChange={(e) => set('payerType', e.target.value)}>
            <option value="">—</option>
            {Object.entries(PAYER_TYPES).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </div>
        {!form.requested && (
          <div className="field">
            <label htmlFor={`${PREFIX}-file`}>Agrément signé (PDF, image ou document)</label>
            <input id={`${PREFIX}-file`} type="file" aria-invalid={fileProblem ? true : undefined} aria-describedby={fileProblem ? `${PREFIX}-file-error` : undefined} onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
            {fileProblem && <p id={`${PREFIX}-file-error`} className="field-error">{fileProblem}</p>}
          </div>
        )}
        <div className="row end">
          <button type="button" className="secondary" onClick={onClose}>Retour</button>
          <button type="submit" disabled={busy}>Enregistrer l’agrément</button>
        </div>
      </form>
    </Modal>
  );
}

/** La promesse est signée : l'agrément demandé devient reçu à la date saisie ; l'entreprise devient « Cliente ». */
function ReceiveApprovalDialog({ approval, onClose, onDone }: { approval: Approval; onClose: () => void; onDone: () => Promise<void> }) {
  const [receivedOn, setReceivedOn] = useState(() => todayIso());
  const [tried, setTried] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const problem = tried ? validateReceivedOn(receivedOn.trim(), { today: todayIso(), validUntil: approval.validUntil }) : null;

  async function confirm() {
    setTried(true);
    if (validateReceivedOn(receivedOn.trim(), { today: todayIso(), validUntil: approval.validUntil })) {
      document.getElementById(`${PREFIX}-receivedOn`)?.focus();
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await api(`/approvals/${approval.id}/receive`, { method: 'POST', body: { version: approval.version, receivedOn: receivedOn.trim() } });
      await onDone();
    } catch (e) {
      setBusy(false);
      setError(e instanceof ApiError ? e.message : 'Action impossible');
    }
  }

  return (
    <Modal title={APPROVAL_ACTION_LABEL.receive} onClose={onClose}>
      <p className="m-0 mb-3">La promesse de paiement de « <strong>{approval.opportunityTitle}</strong> » ({coverageText(approval)}) est signée : l’agrément devient « reçu » et l’entreprise devient « Cliente ». Pensez à joindre le document signé.</p>
      <FormField prefix={PREFIX} name="receivedOn" label="Date de réception" error={problem ?? undefined}>
        <input {...fieldProps(PREFIX, 'receivedOn', problem ?? undefined)} type="date" value={receivedOn} max={todayIso()} onChange={(e) => setReceivedOn(e.target.value)} required aria-required="true" />
      </FormField>
      {error && <p role="alert" className="error">{error}</p>}
      <div className="row end">
        <button type="button" className="secondary" onClick={onClose}>Retour</button>
        <button type="button" disabled={busy} onClick={() => void confirm()}>{APPROVAL_ACTION_LABEL.receive}</button>
      </div>
    </Modal>
  );
}

/** Honorer (confirmation, par la finance), déclarer expiré ou annuler (motif obligatoire) un agrément. */
function CloseApprovalDialog({ approval, action, onClose, onDone }: { approval: Approval; action: ApprovalAction; onClose: () => void; onDone: () => Promise<void> }) {
  const [reason, setReason] = useState('');
  const [tried, setTried] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const needsReason = action !== 'honor';
  const problem = needsReason && tried ? validateReason(reason) : null;

  async function confirm() {
    setTried(true);
    if (needsReason && validateReason(reason)) {
      document.getElementById(`${PREFIX}-reason`)?.focus();
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await api(`/approvals/${approval.id}/${action}`, { method: 'POST', body: needsReason ? { version: approval.version, reason: reason.trim() } : { version: approval.version } });
      await onDone();
    } catch (e) {
      setBusy(false);
      setError(e instanceof ApiError ? e.message : 'Action impossible');
    }
  }

  const intro = action === 'honor'
    ? 'sera constaté comme honoré : la promesse de paiement a été tenue. Cette action est définitive et enregistrée dans l’audit.'
    : action === 'expire'
      ? 'sera déclaré expiré. Cette action est définitive ; l’expiration est toujours déclarée à la main.'
      : 'sera annulé. Cette action est définitive ; une nouvelle opportunité ou un nouvel agrément pourra être enregistré.';
  return (
    <Modal title={APPROVAL_ACTION_LABEL[action]} onClose={onClose}>
      <p className="m-0 mb-3">L’agrément de « <strong>{approval.opportunityTitle}</strong> » ({coverageText(approval)}{approval.receivedOn ? `, reçu le ${formatDate(`${approval.receivedOn}T00:00:00Z`)}` : ', seulement demandé'}) {intro}</p>
      {needsReason && (
        <FormField prefix={PREFIX} name="reason" label="Motif" error={problem ?? undefined}>
          <textarea {...fieldProps(PREFIX, 'reason', problem ?? undefined)} value={reason} onChange={(e) => setReason(e.target.value)} rows={3} maxLength={500} />
        </FormField>
      )}
      {error && <p role="alert" className="error">{error}</p>}
      <div className="row end">
        <button type="button" className="secondary" onClick={onClose}>Retour</button>
        <button type="button" disabled={busy} onClick={() => void confirm()}>{APPROVAL_ACTION_LABEL[action]}</button>
      </div>
    </Modal>
  );
}
