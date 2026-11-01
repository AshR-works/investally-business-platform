'use client';

import { FormEvent, useEffect, useState } from 'react';
import { api, ApiError } from '../../lib/api';
import { formatDate } from '../../lib/format';
import { formatAmount } from '../../lib/offers';
import {
  advanceLabel, buildOpportunityBody, EMPTY_OPPORTUNITY_FORM, formFromOpportunity, LOSS_REASONS, lossReasonLabel, OPPORTUNITY_ACTION_LABEL, OPPORTUNITY_SOURCES, OPPORTUNITY_STATUS,
  type OpportunityAction, type OpportunityField, type OpportunityForm, type OpportunityRights, opportunityActions, sourceLabel, stageLabel, validateLoss, validateOpportunityFields,
  validateRequiredText,
} from '../../lib/opportunities';
import { statusStyle } from '../../lib/status';
import type { Company, Opportunity, Page } from '../../lib/types';
import { Badge } from '../data/badge';
import { FormField, fieldProps } from '../form-field';
import { Modal } from '../modal';

const PREFIX = 'opportunity';

/** Fenêtre ouverte sur une opportunité, ou pour en créer une (éventuellement pour une entreprise imposée). */
export type OpportunityDialogState =
  | { kind: 'create'; company?: { id: string; name: string } }
  | { kind: 'details'; opportunity: Opportunity }
  | { kind: 'edit'; opportunity: Opportunity }
  | { kind: 'advance'; opportunity: Opportunity }
  | { kind: 'waiver'; opportunity: Opportunity }
  | { kind: 'close-lost'; opportunity: Opportunity }
  | { kind: 'close-won'; opportunity: Opportunity };

/**
 * Toutes les fenêtres du cycle d'une opportunité (fiche, créer, modifier, avancer, dérogation, clôtures), rendues UNE fois par
 * l'écran hôte, hors des cartes (un clic dans une fenêtre ne doit pas déclencher une carte).
 */
export function OpportunityDialogs({ dialog, rights, onOpen, onClose, onDone }: {
  dialog: OpportunityDialogState | null;
  rights: OpportunityRights;
  onOpen: (dialog: OpportunityDialogState) => void;
  onClose: () => void;
  onDone: () => Promise<void>;
}) {
  if (!dialog) return null;
  if (dialog.kind === 'details') return <DetailDialog opportunity={dialog.opportunity} rights={rights} onOpen={onOpen} onClose={onClose} />;
  if (dialog.kind === 'create') return <OpportunityFormDialog company={dialog.company} onClose={onClose} onDone={onDone} />;
  if (dialog.kind === 'edit') return <OpportunityFormDialog opportunity={dialog.opportunity} onClose={onClose} onDone={onDone} />;
  if (dialog.kind === 'advance') return <AdvanceDialog opportunity={dialog.opportunity} rights={rights} onOpen={onOpen} onClose={onClose} onDone={onDone} />;
  if (dialog.kind === 'waiver') return <WaiverDialog opportunity={dialog.opportunity} onClose={onClose} onDone={onDone} />;
  if (dialog.kind === 'close-lost') return <CloseLostDialog opportunity={dialog.opportunity} onClose={onClose} onDone={onDone} />;
  return <CloseWonDialog opportunity={dialog.opportunity} onClose={onClose} onDone={onDone} />;
}

/** Fiche : tous les éléments de l'opportunité et les actions possibles selon son état et les droits. */
function DetailDialog({ opportunity: o, rights, onOpen, onClose }: { opportunity: Opportunity; rights: OpportunityRights; onOpen: (d: OpportunityDialogState) => void; onClose: () => void }) {
  const status = statusStyle(OPPORTUNITY_STATUS, o.status);
  const actions = opportunityActions(o, rights).filter((a): a is Exclude<OpportunityAction, 'details'> => a !== 'details');
  const rows: [string, string | null][] = [
    ['Entreprise', o.companyName],
    ['Étape', stageLabel(o.stage)],
    ['Montant estimé', formatAmount(o.amount, o.currency)],
    ['Source', sourceLabel(o.source)],
    ['Dernier passage d’étape', formatDate(o.stageChangedAt)],
    ['Dernière activité', formatDate(o.lastActivityAt)],
    ['Dérogation au rendez-vous décideur', o.waivedAt ? `Accordée le ${formatDate(o.waivedAt)} : ${o.waiverReason}` : null],
    ['Motif de la perte', o.status === 'LOST' ? `${lossReasonLabel(o.lossReason)}${o.closingNote ? ` — ${o.closingNote}` : ''}` : null],
    ['Clôturée le', o.closedAt ? formatDate(o.closedAt) : null],
  ];
  return (
    <Modal title={o.title} onClose={onClose}>
      <p className="m-0 mb-3 inline-flex flex-wrap items-center gap-2">
        <Badge tone={status.tone}>{status.label}</Badge>
        {o.status !== 'OPEN' && <span className="text-ink-2">Clôturée : elle ne peut plus être modifiée.</span>}
      </p>
      <dl className="m-0 mb-3 grid grid-cols-[max-content_1fr] gap-x-4 gap-y-1">
        {rows.filter(([, value]) => value).map(([label, value]) => (
          <div key={label} className="contents"><dt className="text-ink-2">{label}</dt><dd className="m-0">{value}</dd></div>
        ))}
      </dl>
      <div className="row end">
        <button type="button" className="secondary" onClick={onClose}>Fermer</button>
        {actions.map((action) => (
          <button key={action} type="button" className={action === 'close-lost' ? 'danger' : 'secondary'} onClick={() => onOpen({ kind: action, opportunity: o })}>
            {action === 'advance' ? advanceLabel(o.nextStage) : OPPORTUNITY_ACTION_LABEL[action]}
          </button>
        ))}
      </div>
    </Modal>
  );
}

/** Création (entreprise imposée, ou choisie dans la portée) et modification d'une opportunité ouverte. */
function OpportunityFormDialog({ opportunity, company, onClose, onDone }: {
  opportunity?: Opportunity;
  company?: { id: string; name: string };
  onClose: () => void;
  onDone: () => Promise<void>;
}) {
  const [form, setForm] = useState<OpportunityForm>(() => (opportunity ? formFromOpportunity(opportunity) : EMPTY_OPPORTUNITY_FORM(company?.id ?? '')));
  const [companies, setCompanies] = useState<Company[]>([]);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const needsCompany = !opportunity && !company;
  const errors = submitted ? validateOpportunityFields(form, { needsCompany }) : {};
  const props = (name: OpportunityField) => fieldProps(PREFIX, name, errors[name]);
  const set = <K extends keyof OpportunityForm>(key: K, value: OpportunityForm[K]) => setForm((f) => ({ ...f, [key]: value }));

  useEffect(() => {
    if (!needsCompany) return;
    api<Page<Company>>('/companies?pageSize=100').then((r) => setCompanies(r.items.filter((c) => c.status !== 'ARCHIVED'))).catch(() => setError('La liste des entreprises est indisponible.'));
  }, [needsCompany]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSubmitted(true);
    const first = Object.keys(validateOpportunityFields(form, { needsCompany }))[0];
    if (first) {
      setTimeout(() => document.getElementById(`${PREFIX}-${first}`)?.focus(), 0);
      return;
    }
    setBusy(true);
    try {
      if (opportunity) await api(`/opportunities/${opportunity.id}`, { method: 'PUT', body: buildOpportunityBody(form, { version: opportunity.version }) });
      else await api('/opportunities', { method: 'POST', body: buildOpportunityBody(form) });
      await onDone();
    } catch (e) {
      setBusy(false);
      setError(e instanceof ApiError ? e.message : "Échec de l'enregistrement");
    }
  }

  const problems = Object.values(errors);
  return (
    <Modal title={opportunity ? `Modifier l’opportunité · ${opportunity.companyName}` : 'Nouvelle opportunité'} onClose={onClose} size="wide">
      <form onSubmit={(e) => void submit(e)} noValidate>
        <fieldset>
          <legend>L’opportunité</legend>
          {opportunity ? (
            <p className="m-0 mb-3 text-ink-2">Entreprise : <strong>{opportunity.companyName}</strong> · étape <strong>{stageLabel(opportunity.stage)}</strong></p>
          ) : company ? (
            <p className="m-0 mb-3 text-ink-2">Entreprise : <strong>{company.name}</strong> · elle démarre à l’étape <strong>Qualification</strong></p>
          ) : (
            <FormField prefix={PREFIX} name="companyId" label="Entreprise" error={errors.companyId}>
              <select {...props('companyId')} value={form.companyId} onChange={(e) => set('companyId', e.target.value)} required aria-required="true">
                <option value="">— Choisir —</option>
                {companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </FormField>
          )}
          <FormField prefix={PREFIX} name="title" label="Intitulé" error={errors.title}>
            <input {...props('title')} value={form.title} onChange={(e) => set('title', e.target.value)} maxLength={200} required aria-required="true" />
          </FormField>
          <FormField prefix={PREFIX} name="amount" label="Montant estimé" error={errors.amount}>
            <input {...props('amount')} inputMode="decimal" value={form.amount} onChange={(e) => set('amount', e.target.value)} required aria-required="true" placeholder="12 500 000" />
          </FormField>
          <FormField prefix={PREFIX} name="currency" label="Devise" error={errors.currency}>
            <input {...props('currency')} value={form.currency} onChange={(e) => set('currency', e.target.value)} maxLength={4} />
          </FormField>
          <FormField prefix={PREFIX} name="source" label="Source" error={errors.source}>
            <select {...props('source')} value={form.source} onChange={(e) => set('source', e.target.value)}>
              {OPPORTUNITY_SOURCES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
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

/** Confirmation d'un passage d'étape ; un refus de la règle du rendez-vous décideur renvoie vers la dérogation. */
function AdvanceDialog({ opportunity, rights, onOpen, onClose, onDone }: {
  opportunity: Opportunity; rights: OpportunityRights; onOpen: (d: OpportunityDialogState) => void; onClose: () => void; onDone: () => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refusedByRule, setRefusedByRule] = useState(false);
  async function confirm() {
    setBusy(true);
    setError(null);
    try {
      await api(`/opportunities/${opportunity.id}/advance`, { method: 'POST', body: { version: opportunity.version } });
      await onDone();
    } catch (e) {
      setBusy(false);
      setError(e instanceof ApiError ? e.message : 'Action impossible');
      setRefusedByRule(e instanceof ApiError && /rendez-vous décideur/.test(e.message));
    }
  }
  return (
    <Modal title="Passer à l’étape suivante" onClose={onClose}>
      <p className="m-0 mb-3">« <strong>{opportunity.title}</strong> » ({opportunity.companyName}) passe de <strong>{stageLabel(opportunity.stage)}</strong> à <strong>{stageLabel(opportunity.nextStage)}</strong>. Ce passage est enregistré dans l’audit ; on ne revient pas en arrière.</p>
      {opportunity.nextStage === 'AGREEMENT_IN_PRINCIPLE' && !opportunity.waivedAt && (
        <p className="m-0 mb-3 text-ink-2">L’accord de principe exige un rendez-vous tenu avec le décideur de l’entreprise, ou une dérogation du Responsable commercial.</p>
      )}
      {error && <p role="alert" className="error">{error}</p>}
      <div className="row end">
        <button type="button" className="secondary" onClick={onClose}>Retour</button>
        {refusedByRule && rights.override && <button type="button" className="secondary" onClick={() => onOpen({ kind: 'waiver', opportunity })}>Accorder une dérogation</button>}
        <button type="button" disabled={busy} onClick={() => void confirm()}>{advanceLabel(opportunity.nextStage)}</button>
      </div>
    </Modal>
  );
}

/** Dérogation à la règle du rendez-vous décideur : justification obligatoire. */
function WaiverDialog({ opportunity, onClose, onDone }: { opportunity: Opportunity; onClose: () => void; onDone: () => Promise<void> }) {
  const [text, setText] = useState('');
  const [tried, setTried] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const problem = tried ? validateRequiredText(text, 500) : null;
  async function confirm() {
    setTried(true);
    if (validateRequiredText(text, 500)) {
      document.getElementById(`${PREFIX}-waiver-text`)?.focus();
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await api(`/opportunities/${opportunity.id}/waiver`, { method: 'POST', body: { version: opportunity.version, reason: text.trim() } });
      await onDone();
    } catch (e) {
      setBusy(false);
      setError(e instanceof ApiError ? e.message : 'Action impossible');
    }
  }
  return (
    <Modal title="Accorder une dérogation" onClose={onClose}>
      <p className="m-0 mb-3">« <strong>{opportunity.title}</strong> » ({opportunity.companyName}) pourra passer à l’accord de principe <strong>sans rendez-vous décideur tenu</strong>. La justification est enregistrée dans l’audit.</p>
      <FormField prefix={PREFIX} name="waiver-text" label="Justification" error={problem ?? undefined}>
        <textarea {...fieldProps(PREFIX, 'waiver-text', problem ?? undefined)} value={text} onChange={(e) => setText(e.target.value)} maxLength={500} rows={4} required aria-required="true" placeholder="Pourquoi le rendez-vous n’est pas nécessaire" />
      </FormField>
      {error && <p role="alert" className="error">{error}</p>}
      <div className="row end">
        <button type="button" className="secondary" onClick={onClose}>Retour</button>
        <button type="button" disabled={busy} onClick={() => void confirm()}>Accorder la dérogation</button>
      </div>
    </Modal>
  );
}

/** Clôture « perdue » : motif de la liste fermée, précision obligatoire pour « autre ». */
function CloseLostDialog({ opportunity, onClose, onDone }: { opportunity: Opportunity; onClose: () => void; onDone: () => Promise<void> }) {
  const [reason, setReason] = useState('');
  const [note, setNote] = useState('');
  const [tried, setTried] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const errors = tried ? validateLoss(reason, note) : {};
  async function confirm() {
    setTried(true);
    const found = validateLoss(reason, note);
    if (found.reason || found.note) {
      document.getElementById(`${PREFIX}-${found.reason ? 'loss-reason' : 'loss-note'}`)?.focus();
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await api(`/opportunities/${opportunity.id}/close-lost`, { method: 'POST', body: { version: opportunity.version, reason, ...(note.trim() ? { note: note.trim() } : {}) } });
      await onDone();
    } catch (e) {
      setBusy(false);
      setError(e instanceof ApiError ? e.message : 'Action impossible');
    }
  }
  return (
    <Modal title="Clore l’opportunité : perdue" onClose={onClose}>
      <p className="m-0 mb-3">« <strong>{opportunity.title}</strong> » ({opportunity.companyName}) sera clôturée comme perdue. Cette action est définitive et enregistrée dans l’audit.</p>
      <FormField prefix={PREFIX} name="loss-reason" label="Motif de la perte" error={errors.reason}>
        <select {...fieldProps(PREFIX, 'loss-reason', errors.reason)} value={reason} onChange={(e) => setReason(e.target.value)} required aria-required="true">
          <option value="">— Choisir —</option>
          {LOSS_REASONS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
        </select>
      </FormField>
      <FormField prefix={PREFIX} name="loss-note" label={reason === 'OTHER' ? 'Précision (obligatoire)' : 'Précision (facultative)'} error={errors.note}>
        <textarea {...fieldProps(PREFIX, 'loss-note', errors.note)} value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} rows={3} />
      </FormField>
      {error && <p role="alert" className="error">{error}</p>}
      <div className="row end">
        <button type="button" className="secondary" onClick={onClose}>Retour</button>
        <button type="button" className="danger" disabled={busy} onClick={() => void confirm()}>Clore : perdue</button>
      </div>
    </Modal>
  );
}

/** Clôture « gagnée » (Responsable commercial, après l'accord de principe) : confirmation. */
function CloseWonDialog({ opportunity, onClose, onDone }: { opportunity: Opportunity; onClose: () => void; onDone: () => Promise<void> }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function confirm() {
    setBusy(true);
    setError(null);
    try {
      await api(`/opportunities/${opportunity.id}/close-won`, { method: 'POST', body: { version: opportunity.version } });
      await onDone();
    } catch (e) {
      setBusy(false);
      setError(e instanceof ApiError ? e.message : 'Action impossible');
    }
  }
  return (
    <Modal title="Clore l’opportunité : gagnée" onClose={onClose}>
      <p className="m-0 mb-3">« <strong>{opportunity.title}</strong> » ({opportunity.companyName}), {formatAmount(opportunity.amount, opportunity.currency)}, sera clôturée comme <strong>gagnée</strong>. Cette action est définitive et enregistrée dans l’audit ; l’agrément et la commission suivront avec la prochaine session.</p>
      {error && <p role="alert" className="error">{error}</p>}
      <div className="row end">
        <button type="button" className="secondary" onClick={onClose}>Retour</button>
        <button type="button" disabled={busy} onClick={() => void confirm()}>Clore : gagnée</button>
      </div>
    </Modal>
  );
}
