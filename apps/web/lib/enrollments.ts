import { cleanPhone, phoneProblem } from './phone';

/** Apprenants et inscriptions (S5.2b) : types de lecture, états, règles de saisie (identiques à celles du serveur) et corps des requêtes. */

/**
 * Nature d'un apprenant : d'une entreprise, ou **étudiant** / **particulier** sans entreprise (Lot B). Les apprenants n'ont pas accès à la plateforme :
 * ce sont des fiches saisies par les employés.
 */
export type LearnerKind = 'COMPANY' | 'STUDENT' | 'INDIVIDUAL';
export const LEARNER_KIND_LABEL: Record<LearnerKind, string> = { COMPANY: 'Entreprise', STUDENT: 'Étudiant', INDIVIDUAL: 'Particulier' };
/** Les natures « sans entreprise » proposées à la saisie, dans l'ordre de la liste. */
export const INDIVIDUAL_KINDS = [{ value: 'STUDENT', label: 'Étudiant' }, { value: 'INDIVIDUAL', label: 'Particulier' }] as const;
export const LEARNER_KIND_FILTERS = [
  { value: '', label: 'Tous' },
  { value: 'COMPANY', label: 'Entreprises' },
  { value: 'STUDENT', label: 'Étudiants' },
  { value: 'INDIVIDUAL', label: 'Particuliers' },
] as const;
export const isIndividual = (l: { kind: LearnerKind }): boolean => l.kind !== 'COMPANY';

/** Ce qu'une liste montre à la place de l'entreprise : son nom, ou la nature de l'apprenant sans entreprise. */
export const learnerOrigin = (l: Pick<Learner, 'kind' | 'companyName'>): string => (l.kind === 'COMPANY' ? l.companyName : LEARNER_KIND_LABEL[l.kind]);

export interface Learner {
  id: string;
  kind: LearnerKind;
  /** Absent pour un étudiant ou un particulier. */
  companyId: string | null;
  companyName: string;
  contactId: string | null;
  lastName: string;
  firstName: string;
  email: string | null;
  phone: string | null;
  version: number;
  createdAt: string;
}

export type EnrollmentStatus = 'PENDING' | 'CONFIRMED' | 'CANCELLED' | 'TO_REPLACE';

export type PayerKind = 'SELF' | 'THIRD_PARTY';
export type PayerType = 'EMPLOYER' | 'ORGANISM' | 'LANDLORD' | 'FAMILY';
export const PAYER_TYPE_OPTIONS = [
  { value: 'EMPLOYER', label: 'Employeur' },
  { value: 'ORGANISM', label: 'Organisme' },
  { value: 'LANDLORD', label: 'Bailleur' },
  { value: 'FAMILY', label: 'Famille ou proche' },
] as const;

/** Qui règle les frais d'un apprenant sans entreprise. */
export interface Payer { kind: PayerKind; name: string | null; type: PayerType | null }

/** « Lui-même » ou « Famille Ndongo (famille ou proche) ». */
export function payerText(payer: Payer | null): string {
  if (!payer) return '';
  if (payer.kind === 'SELF') return 'Lui-même';
  const type = PAYER_TYPE_OPTIONS.find((o) => o.value === payer.type)?.label.toLowerCase();
  return `${payer.name ?? ''}${type ? ` (${type})` : ''}`;
}

export interface Enrollment {
  id: string;
  sessionId: string;
  learnerId: string;
  companyId: string | null;
  approvalId: string | null;
  /** Étudiant ou particulier : qui règle les frais ; absent quand un agrément couvre l'inscription. */
  payer: Payer | null;
  learnerKind: LearnerKind;
  /** Prix complet : compté sur l'agrément, ou montant dû d'un apprenant sans entreprise. */
  chargedAmount: string | null;
  status: EnrollmentStatus;
  comment: string | null;
  cancelReason: string | null;
  confirmedAt: string | null;
  replacedById: string | null;
  trainingTitle: string;
  sessionStart: string;
  sessionEnd: string;
  sessionStatus: string;
  roomName: string;
  learnerName: string;
  companyName: string;
  approvalLabel: string;
  version: number;
  createdAt: string;
}

export interface ApprovalOption {
  id: string;
  label: string;
  status: string;
  places: number | null;
  amount: string | null;
  currency: string;
  validUntil: string | null;
  receivedOn: string | null;
  payerName: string | null;
  eligible: boolean;
  reason: string | null;
}

export const ENROLLMENT_STATUS: Record<EnrollmentStatus, { label: string; tone: 'ok' | 'warn' | 'bad' | 'info' | 'neutral' }> = {
  PENDING: { label: 'En attente de confirmation', tone: 'info' },
  CONFIRMED: { label: 'Confirmée', tone: 'ok' },
  CANCELLED: { label: 'Annulée', tone: 'bad' },
  TO_REPLACE: { label: 'À replacer', tone: 'warn' },
};

export const ENROLLMENT_STATUS_OPTIONS = [
  { value: '', label: 'Toutes' },
  { value: 'PENDING', label: 'En attente' },
  { value: 'CONFIRMED', label: 'Confirmées' },
  { value: 'TO_REPLACE', label: 'À replacer' },
  { value: 'CANCELLED', label: 'Annulées' },
] as const;

export const ENROLLMENT_PERMISSIONS = {
  readLearners: 'training.learner.read',
  createLearner: 'training.learner.create',
  updateLearner: 'training.learner.update',
  deleteLearner: 'training.learner.delete',
  readEnrollments: 'training.enrollment.read',
  enroll: 'training.enrollment.create',
  confirm: 'training.enrollment.update',
  cancel: 'training.enrollment.cancel',
} as const;

// ───────────────────────────── Apprenant ─────────────────────────────

/** `withoutCompany` : la case « sans entreprise » (étudiant ou particulier) ; `kind` est alors la nature choisie dans la liste. */
export interface LearnerForm { companyId: string; withoutCompany: boolean; kind: 'STUDENT' | 'INDIVIDUAL'; lastName: string; firstName: string; email: string; phone: string; contactId: string }
export const EMPTY_LEARNER_FORM = (companyId = ''): LearnerForm => ({ companyId, withoutCompany: false, kind: 'STUDENT', lastName: '', firstName: '', email: '', phone: '', contactId: '' });
export const formFromLearner = (l: Learner): LearnerForm => ({
  companyId: l.companyId ?? '', withoutCompany: l.kind !== 'COMPANY', kind: l.kind === 'INDIVIDUAL' ? 'INDIVIDUAL' : 'STUDENT', lastName: l.lastName, firstName: l.firstName, email: l.email ?? '', phone: l.phone ?? '', contactId: l.contactId ?? '',
});

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Règles de saisie d'un apprenant, dans l'ordre des champs ; une absence de clé = champ conforme. */
export function validateLearner(form: LearnerForm, editing: boolean): Partial<Record<keyof LearnerForm, string>> {
  const errors: Partial<Record<keyof LearnerForm, string>> = {};
  if (!editing && !form.withoutCompany && !form.companyId) errors.companyId = "Choisissez l'entreprise de l'apprenant, ou cochez « sans entreprise »";
  const last = form.lastName.trim();
  if (!last) errors.lastName = 'Le nom est obligatoire';
  else if (last.length > 100) errors.lastName = 'Le nom ne peut dépasser 100 caractères';
  const first = form.firstName.trim();
  if (!first) errors.firstName = 'Le prénom est obligatoire';
  else if (first.length > 100) errors.firstName = 'Le prénom ne peut dépasser 100 caractères';
  if (form.email.trim() && !EMAIL.test(form.email.trim())) errors.email = "L'adresse e-mail n'est pas valide";
  if (form.phone.trim()) {
    const problem = phoneProblem(form.phone);
    if (problem) errors.phone = problem;
  }
  return errors;
}

export function learnerBody(form: LearnerForm, extra: { version?: number; allowDuplicate?: boolean } = {}) {
  const body: Record<string, unknown> = {
    lastName: form.lastName.trim(), firstName: form.firstName.trim(), email: form.email.trim(), phone: form.phone.trim() ? cleanPhone(form.phone) : '',
  };
  // Un étudiant ou un particulier n'a ni entreprise ni contact : rien de tout cela n'est envoyé.
  if (!form.withoutCompany) body.contactId = form.contactId || null;
  if (extra.version !== undefined) body.version = extra.version;
  else if (form.withoutCompany) body.kind = form.kind;
  else body.companyId = form.companyId;
  if (extra.allowDuplicate) body.allowDuplicate = true;
  return body;
}

// ───────────────────────────── Inscription ─────────────────────────────

export interface EnrollForm { learnerId: string; sessionId: string; approvalId: string; payerKind: '' | PayerKind; payerName: string; payerType: '' | PayerType; comment: string }
export const EMPTY_ENROLL_FORM = (learnerId = '', sessionId = ''): EnrollForm => ({ learnerId, sessionId, approvalId: '', payerKind: '', payerName: '', payerType: '', comment: '' });

/**
 * Règles de saisie d'une inscription. Un apprenant d'une entreprise s'inscrit sous un **agrément** ; un étudiant ou un particulier (`individual`) n'en a pas :
 * on désigne qui règle les frais, lui-même ou un tiers nommé, avec sa nature.
 */
export function validateEnroll(form: EnrollForm, options: readonly ApprovalOption[], individual = false): Partial<Record<keyof EnrollForm, string>> {
  const errors: Partial<Record<keyof EnrollForm, string>> = {};
  if (!form.learnerId) errors.learnerId = "Choisissez l'apprenant";
  if (!form.sessionId) errors.sessionId = 'Choisissez la session';
  if (individual) {
    if (!form.payerKind) errors.payerKind = "Indiquez qui règle les frais : l'apprenant lui-même ou un tiers";
    else if (form.payerKind === 'THIRD_PARTY') {
      const name = form.payerName.trim();
      if (!name) errors.payerName = 'Le nom du payeur est obligatoire';
      else if (name.length > 200) errors.payerName = 'Le nom du payeur ne peut dépasser 200 caractères';
      if (!form.payerType) errors.payerType = 'Choisissez la nature du payeur';
    }
  } else if (!form.approvalId) errors.approvalId = "Choisissez l'agrément qui couvre l'inscription";
  else {
    const option = options.find((o) => o.id === form.approvalId);
    if (option && !option.eligible) errors.approvalId = option.reason ?? 'Cet agrément ne peut pas couvrir cette inscription';
  }
  if (form.comment.trim().length > 500) errors.comment = 'Le commentaire ne peut dépasser 500 caractères';
  return errors;
}

export function enrollBody(form: EnrollForm, individual = false) {
  const payer = form.payerKind === 'THIRD_PARTY' ? { kind: 'THIRD_PARTY', name: form.payerName.trim(), type: form.payerType } : { kind: 'SELF' };
  return {
    learnerId: form.learnerId, sessionId: form.sessionId, ...(individual ? { payer } : { approvalId: form.approvalId }), ...(form.comment.trim() ? { comment: form.comment.trim() } : {}),
  };
}

export interface ReplaceForm { sessionId: string; approvalId: string }
export function validateReplace(form: ReplaceForm, current: Pick<Enrollment, 'sessionId'>, options: readonly ApprovalOption[]): Partial<Record<keyof ReplaceForm, string>> {
  const errors: Partial<Record<keyof ReplaceForm, string>> = {};
  if (!form.sessionId) errors.sessionId = 'Choisissez la nouvelle session';
  else if (form.sessionId === current.sessionId) errors.sessionId = "Choisissez une autre session que celle de l'inscription actuelle";
  const option = form.approvalId ? options.find((o) => o.id === form.approvalId) : undefined;
  if (option && !option.eligible) errors.approvalId = option.reason ?? 'Cet agrément ne peut pas couvrir cette inscription';
  return errors;
}

export function validateCancelEnrollment(reason: string): string | undefined {
  const text = reason.trim();
  if (!text) return "Le motif de l'annulation est obligatoire";
  if (text.length > 500) return 'Le motif ne peut dépasser 500 caractères';
  return undefined;
}

export interface EnrollmentActions { confirm: boolean; cancel: boolean; replace: boolean }

/** Actions possibles sur une inscription selon son état, l'état de sa session et les droits de l'utilisateur. */
export function enrollmentActions(e: Pick<Enrollment, 'status' | 'sessionStatus'>, can: { confirm: boolean; cancel: boolean }): EnrollmentActions {
  const closed = e.sessionStatus === 'CLOSED';
  return {
    confirm: can.confirm && e.status === 'PENDING' && e.sessionStatus === 'OPEN',
    cancel: can.cancel && !closed && e.status !== 'CANCELLED',
    replace: can.cancel && !closed && e.status !== 'CANCELLED',
  };
}

/** « 2 places » ou « 150 000 XAF » ou les deux : ce que couvre un agrément. */
export function coverText(option: Pick<ApprovalOption, 'places' | 'amount' | 'currency'>): string {
  const parts: string[] = [];
  if (option.places !== null) parts.push(`${option.places} place${option.places > 1 ? 's' : ''}`);
  if (option.amount !== null) parts.push(`${Number(option.amount).toLocaleString('fr-FR')} ${option.currency}`.replace(/[  ]/g, ' '));
  return parts.join(' et ');
}

/** Places occupées sur la capacité : « 5 / 13 ». */
export const seatsFill = (enrolled: number, capacity: number): string => `${enrolled} / ${capacity}`;
export const isFull = (enrolled: number, capacity: number): boolean => enrolled >= capacity;
