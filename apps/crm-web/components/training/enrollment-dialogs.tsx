'use client';

import { useEffect, useState } from 'react';
import { api, ApiError } from '../../lib/api';
import {
  type ApprovalOption, coverText, EMPTY_ENROLL_FORM, EMPTY_LEARNER_FORM, type Enrollment, type EnrollForm, enrollBody, formFromLearner, INDIVIDUAL_KINDS, isIndividual, type Learner, learnerBody,
  LEARNER_KIND_LABEL, type LearnerForm, learnerOrigin, PAYER_TYPE_OPTIONS, payerText, validateCancelEnrollment, validateEnroll, validateLearner, validateReplace,
} from '../../lib/enrollments';
import { dateText, type Session } from '../../lib/sessions';
import type { Page } from '../../lib/types';
import { FormField, fieldProps } from '../form-field';
import { Modal } from '../modal';
import { FormDialog } from './catalogue-dialogs';

/** Ce que les pages d'apprenants et d'inscriptions peuvent ouvrir. */
export type EnrollmentDialogState =
  | { kind: 'learner'; learner?: Learner; companyId?: string }
  | { kind: 'delete-learner'; learner: Learner }
  | { kind: 'enroll'; learner?: Learner; session?: Session }
  | { kind: 'confirm'; enrollment: Enrollment }
  | { kind: 'cancel'; enrollment: Enrollment }
  | { kind: 'replace'; enrollment: Enrollment };

const PREFIX = 'catalogue';

/** Toutes les fenêtres des apprenants et des inscriptions, rendues UNE fois par la page hôte, hors des tableaux. */
export function EnrollmentDialogs({ dialog, onClose, onDone }: { dialog: EnrollmentDialogState | null; onClose: () => void; onDone: () => Promise<void> }) {
  if (!dialog) return null;
  switch (dialog.kind) {
    case 'learner': return <LearnerDialog learner={dialog.learner} companyId={dialog.companyId} onClose={onClose} onDone={onDone} />;
    case 'delete-learner': return <DeleteLearnerDialog learner={dialog.learner} onClose={onClose} onDone={onDone} />;
    case 'enroll': return <EnrollDialog learner={dialog.learner} session={dialog.session} onClose={onClose} onDone={onDone} />;
    case 'confirm': return <ConfirmDialog enrollment={dialog.enrollment} onClose={onClose} onDone={onDone} />;
    case 'cancel': return <CancelDialog enrollment={dialog.enrollment} onClose={onClose} onDone={onDone} />;
    case 'replace': return <ReplaceDialog enrollment={dialog.enrollment} onClose={onClose} onDone={onDone} />;
  }
}

interface CompanyOption { id: string; name: string }
interface ContactOption { id: string; firstName: string; lastName: string }

function LearnerDialog({ learner, companyId, onClose, onDone }: { learner?: Learner; companyId?: string; onClose: () => void; onDone: () => Promise<void> }) {
  const [form, setForm] = useState<LearnerForm>(() => (learner ? formFromLearner(learner) : EMPTY_LEARNER_FORM(companyId)));
  const [companies, setCompanies] = useState<CompanyOption[]>([]);
  const [contacts, setContacts] = useState<ContactOption[]>([]);
  const [duplicate, setDuplicate] = useState<string | null>(null);
  const [forcing, setForcing] = useState(false);
  const [forceError, setForceError] = useState<string | null>(null);
  const set = (key: keyof LearnerForm, value: string) => setForm((f) => ({ ...f, [key]: value }));
  const errors = validateLearner(form, Boolean(learner));
  const noCompany = form.withoutCompany;

  useEffect(() => {
    if (learner) return;
    api<Page<CompanyOption>>('/companies?pageSize=100').then((p) => setCompanies(p.items)).catch(() => setCompanies([]));
  }, [learner]);
  useEffect(() => {
    if (!form.companyId || form.withoutCompany) {
      setContacts([]);
      return;
    }
    api<Page<ContactOption>>(`/contacts?companyId=${form.companyId}&pageSize=100`).then((p) => setContacts(p.items)).catch(() => setContacts([]));
  }, [form.companyId, form.withoutCompany]);

  async function save(allowDuplicate: boolean) {
    if (learner) await api(`/learners/${learner.id}`, { method: 'PUT', body: learnerBody(form, { version: learner.version, allowDuplicate }) });
    else await api('/learners', { method: 'POST', body: learnerBody(form, { allowDuplicate }) });
    await onDone();
  }
  async function force() {
    setForcing(true);
    setForceError(null);
    try {
      await save(true);
    } catch (e) {
      setForcing(false);
      setForceError(e instanceof ApiError ? e.message : "Échec de l'enregistrement");
    }
  }

  return (
    <FormDialog
      title={learner ? "Modifier l'apprenant" : 'Nouvel apprenant'}
      intro="Un apprenant est une personne inscrite à une formation, pour le compte d’une entreprise ou, sans entreprise, comme étudiant ou particulier. Il n’a pas accès à la plateforme : c’est une fiche que vous tenez à jour."
      errors={errors}
      onClose={onClose}
      submit={async () => {
        try {
          await save(false);
        } catch (e) {
          setDuplicate(e instanceof ApiError && e.status === 409 && e.message.includes('existe déjà') ? e.message : null);
          throw e;
        }
      }}
    >
      {({ submitted }) => {
        const shown = (name: keyof LearnerForm) => (submitted ? errors[name] : undefined);
        return (
          <fieldset>
            <legend>L’apprenant</legend>
            {!learner && (
              <>
                <label className="mb-3 flex items-center gap-2 font-normal">
                  <input type="checkbox" checked={noCompany} onChange={(e) => setForm((f) => ({ ...f, withoutCompany: e.target.checked, companyId: e.target.checked ? '' : f.companyId, contactId: '' }))} style={{ width: 'auto', margin: 0 }} />
                  Sans entreprise (étudiant ou particulier)
                </label>
                <FormField prefix={PREFIX} name="companyId" label="Entreprise" error={shown('companyId')}>
                  <select {...fieldProps(PREFIX, 'companyId', shown('companyId'))} value={form.companyId} disabled={noCompany} onChange={(e) => { set('companyId', e.target.value); set('contactId', ''); }} required={!noCompany} aria-required={!noCompany}>
                    <option value="">Choisir…</option>
                    {companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </FormField>
                {noCompany && (
                  <FormField prefix={PREFIX} name="kind" label="Nature">
                    <select id={`${PREFIX}-kind`} value={form.kind} onChange={(e) => set('kind', e.target.value)}>
                      {INDIVIDUAL_KINDS.map((k) => <option key={k.value} value={k.value}>{k.label}</option>)}
                    </select>
                  </FormField>
                )}
              </>
            )}
            {learner && (
              <p className="m-0 mb-3 text-ink-2">
                {isIndividual(learner) ? <>Nature : <strong>{learnerOrigin(learner)}</strong>, sans entreprise.</> : <>Entreprise : <strong>{learner.companyName}</strong> (elle ne change pas).</>}
              </p>
            )}
            <FormField prefix={PREFIX} name="lastName" label="Nom" error={shown('lastName')}>
              <input {...fieldProps(PREFIX, 'lastName', shown('lastName'))} value={form.lastName} onChange={(e) => set('lastName', e.target.value)} maxLength={100} required aria-required="true" />
            </FormField>
            <FormField prefix={PREFIX} name="firstName" label="Prénom" error={shown('firstName')}>
              <input {...fieldProps(PREFIX, 'firstName', shown('firstName'))} value={form.firstName} onChange={(e) => set('firstName', e.target.value)} maxLength={100} required aria-required="true" />
            </FormField>
            <FormField prefix={PREFIX} name="email" label="E-mail (facultatif)" error={shown('email')}>
              <input {...fieldProps(PREFIX, 'email', shown('email'))} type="email" value={form.email} onChange={(e) => set('email', e.target.value)} maxLength={200} />
            </FormField>
            <FormField prefix={PREFIX} name="phone" label="Téléphone (facultatif, avec l’indicatif du pays)" error={shown('phone')}>
              <input {...fieldProps(PREFIX, 'phone', shown('phone'))} type="tel" inputMode="tel" value={form.phone} onChange={(e) => set('phone', e.target.value)} placeholder="+237 699 12 34 56" />
            </FormField>
            <FormField prefix={PREFIX} name="contactId" label="Contact de l’entreprise (facultatif)">
              <select id={`${PREFIX}-contactId`} value={form.contactId} onChange={(e) => set('contactId', e.target.value)} disabled={!form.companyId || noCompany}>
                <option value="">Aucun</option>
                {contacts.map((c) => <option key={c.id} value={c.id}>{c.firstName} {c.lastName}</option>)}
              </select>
            </FormField>
            {duplicate && (
              <div role="status" className="m-0 mb-3">
                <p className="m-0 mb-2">Un apprenant semblable existe déjà : vérifiez avant de créer un doublon.</p>
                <button type="button" className="secondary" disabled={forcing} onClick={() => void force()}>{learner ? 'Enregistrer quand même' : 'Créer quand même'}</button>
                {forceError && <p role="alert" className="error">{forceError}</p>}
              </div>
            )}
          </fieldset>
        );
      }}
    </FormDialog>
  );
}

function DeleteLearnerDialog({ learner, onClose, onDone }: { learner: Learner; onClose: () => void; onDone: () => Promise<void> }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function confirm() {
    setBusy(true);
    setError(null);
    try {
      await api(`/learners/${learner.id}`, { method: 'DELETE', body: { version: learner.version } });
      await onDone();
    } catch (e) {
      setBusy(false);
      setError(e instanceof ApiError ? e.message : 'Action impossible');
    }
  }
  return (
    <Modal title="Supprimer l’apprenant" onClose={onClose}>
      <p className="m-0 mb-3">
        « {learner.firstName} {learner.lastName} » ({learnerOrigin(learner)}) disparaîtra des listes. Ses inscriptions passées restent lisibles. La suppression est refusée s’il a une inscription confirmée.
      </p>
      {error && <p role="alert" className="error">{error}</p>}
      <div className="row end">
        <button type="button" className="secondary" onClick={onClose}>Retour</button>
        <button type="button" disabled={busy} onClick={() => void confirm()}>Supprimer l’apprenant</button>
      </div>
    </Modal>
  );
}

const sessionLabel = (s: Session) => `${s.trainingTitle} : ${dateText(s.startDate)} → ${dateText(s.endDate)} (${s.roomName}, ${s.enrolled}/${s.capacity} inscrits)`;

/** Les choix d'agrément pour cet apprenant et cette session : lus à chaque changement de l'un ou de l'autre. */
function useApprovalOptions(learnerId: string, sessionId: string): { options: ApprovalOption[]; loading: boolean; error: string | null } {
  const [options, setOptions] = useState<ApprovalOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (!learnerId || !sessionId) {
      setOptions([]);
      return;
    }
    let live = true;
    setLoading(true);
    setError(null);
    api<ApprovalOption[]>(`/enrollments/approval-options?learnerId=${learnerId}&sessionId=${sessionId}`)
      .then((o) => live && setOptions(o))
      .catch((e) => live && setError(e instanceof ApiError ? e.message : 'Les agréments sont indisponibles'))
      .finally(() => live && setLoading(false));
    return () => { live = false; };
  }, [learnerId, sessionId]);
  return { options, loading, error };
}

function ApprovalChoice({ form, setForm, options, loading, error, shown }: {
  form: { approvalId: string }; setForm: (approvalId: string) => void; options: ApprovalOption[]; loading: boolean; error: string | null; shown?: string;
}) {
  const chosen = options.find((o) => o.id === form.approvalId);
  return (
    <>
      <FormField prefix={PREFIX} name="approvalId" label="Agrément qui couvre l’inscription" error={shown}>
        <select {...fieldProps(PREFIX, 'approvalId', shown)} value={form.approvalId} onChange={(e) => setForm(e.target.value)} disabled={loading || options.length === 0} required aria-required="true">
          <option value="">{loading ? 'Chargement…' : options.length === 0 ? 'Aucun agrément' : 'Choisir…'}</option>
          {options.map((o) => <option key={o.id} value={o.id}>{o.label}{o.eligible ? '' : ' (indisponible)'}</option>)}
        </select>
      </FormField>
      {error && <p role="alert" className="error">{error}</p>}
      {chosen && (
        <p className="m-0 mb-3 text-ink-2" aria-live="polite">
          {chosen.eligible ? <>Couvre : <strong>{coverText(chosen)}</strong>{chosen.payerName ? ` · payeur : ${chosen.payerName}` : ''}</> : <>Cet agrément ne peut pas couvrir l’inscription : {chosen.reason}</>}
        </p>
      )}
      {!loading && !error && options.length === 0 && <p className="m-0 mb-3 text-ink-2">L’entreprise de l’apprenant n’a aucun agrément : une inscription en exige un (reçu ou honoré).</p>}
    </>
  );
}

/** Qui règle les frais d'un étudiant ou d'un particulier : lui-même, ou un tiers (nom et nature). Le montant dû est le prix complet du certificat, fixé par le serveur. */
function PayerChoice({ form, setForm, shown }: { form: EnrollForm; setForm: (update: (f: EnrollForm) => EnrollForm) => void; shown: (name: keyof EnrollForm) => string | undefined }) {
  const third = form.payerKind === 'THIRD_PARTY';
  return (
    <>
      <FormField prefix={PREFIX} name="payerKind" label="Qui règle les frais ?" error={shown('payerKind')}>
        <select {...fieldProps(PREFIX, 'payerKind', shown('payerKind'))} value={form.payerKind} onChange={(e) => setForm((f) => ({ ...f, payerKind: e.target.value as EnrollForm['payerKind'], ...(e.target.value === 'THIRD_PARTY' ? {} : { payerName: '', payerType: '' as const }) }))} required aria-required="true">
          <option value="">Choisir…</option>
          <option value="SELF">L’apprenant lui-même</option>
          <option value="THIRD_PARTY">Un tiers</option>
        </select>
      </FormField>
      {third && (
        <>
          <FormField prefix={PREFIX} name="payerName" label="Nom du payeur" error={shown('payerName')}>
            <input {...fieldProps(PREFIX, 'payerName', shown('payerName'))} value={form.payerName} onChange={(e) => setForm((f) => ({ ...f, payerName: e.target.value }))} maxLength={200} required aria-required="true" />
          </FormField>
          <FormField prefix={PREFIX} name="payerType" label="Nature du payeur" error={shown('payerType')}>
            <select {...fieldProps(PREFIX, 'payerType', shown('payerType'))} value={form.payerType} onChange={(e) => setForm((f) => ({ ...f, payerType: e.target.value as EnrollForm['payerType'] }))} required aria-required="true">
              <option value="">Choisir…</option>
              {PAYER_TYPE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </FormField>
        </>
      )}
      <p className="m-0 mb-3 text-ink-2">Le montant dû est le prix complet du certificat. Le règlement lui-même n’est pas suivi ici : il le sera avec le module Facturation et paiements.</p>
    </>
  );
}

function EnrollDialog({ learner, session, onClose, onDone }: { learner?: Learner; session?: Session; onClose: () => void; onDone: () => Promise<void> }) {
  const [form, setForm] = useState<EnrollForm>(() => EMPTY_ENROLL_FORM(learner?.id, session?.id));
  const [learners, setLearners] = useState<Learner[]>(learner ? [learner] : []);
  const [sessions, setSessions] = useState<Session[]>(session ? [session] : []);
  const chosenLearner = learners.find((l) => l.id === form.learnerId) ?? learner;
  // Un étudiant ou un particulier n'a pas d'agrément : on désigne qui règle les frais.
  const individual = chosenLearner ? isIndividual(chosenLearner) : false;
  const { options, loading, error } = useApprovalOptions(individual ? '' : form.learnerId, form.sessionId);
  const set = (key: keyof EnrollForm, value: string) => setForm((f) => ({ ...f, [key]: value }));
  const errors = validateEnroll(form, options, individual);

  useEffect(() => {
    if (!learner) api<Page<Learner>>('/learners?pageSize=100').then((p) => setLearners(p.items)).catch(() => setLearners([]));
    if (!session) api<Page<Session>>('/sessions?status=OPEN&pageSize=100').then((p) => setSessions(p.items)).catch(() => setSessions([]));
  }, [learner, session]);
  // Un seul agrément qui peut couvrir l'inscription : il est choisi d'office.
  useEffect(() => {
    const eligible = options.filter((o) => o.eligible);
    if (eligible.length === 1) setForm((f) => (f.approvalId ? f : { ...f, approvalId: eligible[0].id }));
    else setForm((f) => (f.approvalId && !options.some((o) => o.id === f.approvalId) ? { ...f, approvalId: '' } : f));
  }, [options]);

  return (
    <FormDialog
      title="Inscrire un apprenant"
      intro="L’inscription prend une place de la session et consomme l’agrément choisi ; pour un étudiant ou un particulier, qui n’a pas d’agrément, on indique qui règle les frais. Elle reste « en attente » jusqu’à sa confirmation par le Responsable Investudy."
      errors={errors}
      onClose={onClose}
      submit={async () => {
        await api('/enrollments', { method: 'POST', body: enrollBody(form, individual) });
        await onDone();
      }}
    >
      {({ submitted }) => {
        const shown = (name: keyof EnrollForm) => (submitted ? errors[name] : undefined);
        return (
          <fieldset>
            <legend>L’inscription</legend>
            <FormField prefix={PREFIX} name="learnerId" label="Apprenant" error={shown('learnerId')}>
              <select {...fieldProps(PREFIX, 'learnerId', shown('learnerId'))} value={form.learnerId} disabled={Boolean(learner)} onChange={(e) => set('learnerId', e.target.value)} required aria-required="true">
                <option value="">Choisir…</option>
                {learners.map((l) => <option key={l.id} value={l.id}>{l.firstName} {l.lastName} ({learnerOrigin(l)})</option>)}
              </select>
            </FormField>
            <FormField prefix={PREFIX} name="sessionId" label="Session ouverte" error={shown('sessionId')}>
              <select {...fieldProps(PREFIX, 'sessionId', shown('sessionId'))} value={form.sessionId} disabled={Boolean(session)} onChange={(e) => set('sessionId', e.target.value)} required aria-required="true">
                <option value="">Choisir…</option>
                {sessions.map((s) => <option key={s.id} value={s.id} disabled={s.enrolled >= s.capacity}>{sessionLabel(s)}{s.enrolled >= s.capacity ? ' : complète' : ''}</option>)}
              </select>
            </FormField>
            {individual
              ? <PayerChoice form={form} setForm={setForm} shown={shown} />
              : <ApprovalChoice form={form} setForm={(approvalId) => set('approvalId', approvalId)} options={options} loading={loading} error={error} shown={shown('approvalId')} />}
            <FormField prefix={PREFIX} name="comment" label="Commentaire (facultatif)" error={shown('comment')}>
              <textarea {...fieldProps(PREFIX, 'comment', shown('comment'))} value={form.comment} onChange={(e) => set('comment', e.target.value)} rows={2} maxLength={500} />
            </FormField>
          </fieldset>
        );
      }}
    </FormDialog>
  );
}

function ConfirmDialog({ enrollment, onClose, onDone }: { enrollment: Enrollment; onClose: () => void; onDone: () => Promise<void> }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function confirm() {
    setBusy(true);
    setError(null);
    try {
      await api(`/enrollments/${enrollment.id}/confirm`, { method: 'POST', body: { version: enrollment.version } });
      await onDone();
    } catch (e) {
      setBusy(false);
      setError(e instanceof ApiError ? e.message : 'Action impossible');
    }
  }
  return (
    <Modal title="Confirmer l’inscription" onClose={onClose}>
      <p className="m-0 mb-3">
        Confirmer l’inscription de <strong>{enrollment.learnerName}</strong> ({enrollment.companyName || LEARNER_KIND_LABEL[enrollment.learnerKind]}) à « {enrollment.trainingTitle} » du {dateText(enrollment.sessionStart)} au {dateText(enrollment.sessionEnd)}.
        {enrollment.approvalId ? ' Son agrément doit rester valide.' : ` Payeur : ${payerText(enrollment.payer)}.`}
      </p>
      {error && <p role="alert" className="error">{error}</p>}
      <div className="row end">
        <button type="button" className="secondary" onClick={onClose}>Retour</button>
        <button type="button" disabled={busy} onClick={() => void confirm()}>Confirmer l’inscription</button>
      </div>
    </Modal>
  );
}

function CancelDialog({ enrollment, onClose, onDone }: { enrollment: Enrollment; onClose: () => void; onDone: () => Promise<void> }) {
  const [reason, setReason] = useState('');
  const problem = validateCancelEnrollment(reason);
  const errors = (problem ? { reason: problem } : {}) as Partial<Record<'reason', string>>;
  return (
    <FormDialog
      title="Annuler l’inscription"
      intro="L’annulation libère la place et l’agrément. Le motif est obligatoire et conservé."
      errors={errors}
      onClose={onClose}
      submit={async () => {
        await api(`/enrollments/${enrollment.id}/cancel`, { method: 'POST', body: { version: enrollment.version, reason: reason.trim() } });
        await onDone();
      }}
    >
      {({ submitted }) => (
        <fieldset>
          <legend>{enrollment.learnerName}</legend>
          <p className="m-0 mb-3 text-ink-2">{enrollment.trainingTitle} : {dateText(enrollment.sessionStart)} → {dateText(enrollment.sessionEnd)}</p>
          <FormField prefix={PREFIX} name="reason" label="Motif de l’annulation" error={submitted ? errors.reason : undefined}>
            <textarea {...fieldProps(PREFIX, 'reason', submitted ? errors.reason : undefined)} value={reason} onChange={(e) => setReason(e.target.value)} rows={3} maxLength={500} required aria-required="true" />
          </FormField>
        </fieldset>
      )}
    </FormDialog>
  );
}

function ReplaceDialog({ enrollment, onClose, onDone }: { enrollment: Enrollment; onClose: () => void; onDone: () => Promise<void> }) {
  const [form, setForm] = useState({ sessionId: '', approvalId: enrollment.approvalId ?? '' });
  const [sessions, setSessions] = useState<Session[]>([]);
  // Un étudiant ou un particulier garde son payeur : aucun agrément à choisir.
  const individual = enrollment.approvalId === null;
  const { options, loading, error } = useApprovalOptions(individual ? '' : enrollment.learnerId, form.sessionId);
  const errors = validateReplace(form, enrollment, options);
  useEffect(() => {
    api<Page<Session>>('/sessions?status=OPEN&pageSize=100').then((p) => setSessions(p.items)).catch(() => setSessions([]));
  }, []);
  return (
    <FormDialog
      title="Replacer l’inscription"
      intro="L’inscription actuelle est annulée (elle libère sa place) et une nouvelle inscription, en attente de confirmation, est créée sur la session choisie, avec les mêmes contrôles."
      errors={errors}
      onClose={onClose}
      submit={async () => {
        await api(`/enrollments/${enrollment.id}/replace`, { method: 'POST', body: { version: enrollment.version, sessionId: form.sessionId, approvalId: form.approvalId || undefined } });
        await onDone();
      }}
    >
      {({ submitted }) => (
        <fieldset>
          <legend>{enrollment.learnerName}</legend>
          <p className="m-0 mb-3 text-ink-2">Actuellement : {enrollment.trainingTitle}, {dateText(enrollment.sessionStart)} → {dateText(enrollment.sessionEnd)}</p>
          <FormField prefix={PREFIX} name="sessionId" label="Nouvelle session ouverte" error={submitted ? errors.sessionId : undefined}>
            <select {...fieldProps(PREFIX, 'sessionId', submitted ? errors.sessionId : undefined)} value={form.sessionId} onChange={(e) => setForm((f) => ({ ...f, sessionId: e.target.value }))} required aria-required="true">
              <option value="">Choisir…</option>
              {sessions.filter((s) => s.id !== enrollment.sessionId).map((s) => <option key={s.id} value={s.id} disabled={s.enrolled >= s.capacity}>{sessionLabel(s)}{s.enrolled >= s.capacity ? ' : complète' : ''}</option>)}
            </select>
          </FormField>
          {individual
            ? <p className="m-0 mb-3 text-ink-2">Le payeur est conservé : <strong>{payerText(enrollment.payer)}</strong>.</p>
            : <ApprovalChoice form={form} setForm={(approvalId) => setForm((f) => ({ ...f, approvalId }))} options={options} loading={loading} error={error} shown={submitted ? errors.approvalId : undefined} />}
        </fieldset>
      )}
    </FormDialog>
  );
}
