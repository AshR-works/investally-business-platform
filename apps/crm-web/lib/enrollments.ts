import { cleanPhone, phoneProblem } from './phone';

/** Apprenants et inscriptions (S5.2b) : types de lecture, états, règles de saisie (identiques à celles du serveur) et corps des requêtes. */

export interface Learner {
  id: string;
  companyId: string;
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

export interface Enrollment {
  id: string;
  sessionId: string;
  learnerId: string;
  companyId: string;
  approvalId: string;
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

export interface LearnerForm { companyId: string; lastName: string; firstName: string; email: string; phone: string; contactId: string }
export const EMPTY_LEARNER_FORM = (companyId = ''): LearnerForm => ({ companyId, lastName: '', firstName: '', email: '', phone: '', contactId: '' });
export const formFromLearner = (l: Learner): LearnerForm => ({ companyId: l.companyId, lastName: l.lastName, firstName: l.firstName, email: l.email ?? '', phone: l.phone ?? '', contactId: l.contactId ?? '' });

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Règles de saisie d'un apprenant, dans l'ordre des champs ; une absence de clé = champ conforme. */
export function validateLearner(form: LearnerForm, editing: boolean): Partial<Record<keyof LearnerForm, string>> {
  const errors: Partial<Record<keyof LearnerForm, string>> = {};
  if (!editing && !form.companyId) errors.companyId = "Choisissez l'entreprise de l'apprenant";
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
    lastName: form.lastName.trim(), firstName: form.firstName.trim(), email: form.email.trim(), phone: form.phone.trim() ? cleanPhone(form.phone) : '', contactId: form.contactId || null,
  };
  if (extra.version === undefined) body.companyId = form.companyId;
  else body.version = extra.version;
  if (extra.allowDuplicate) body.allowDuplicate = true;
  return body;
}

// ───────────────────────────── Inscription ─────────────────────────────

export interface EnrollForm { learnerId: string; sessionId: string; approvalId: string; comment: string }
export const EMPTY_ENROLL_FORM = (learnerId = '', sessionId = ''): EnrollForm => ({ learnerId, sessionId, approvalId: '', comment: '' });

export function validateEnroll(form: EnrollForm, options: readonly ApprovalOption[]): Partial<Record<keyof EnrollForm, string>> {
  const errors: Partial<Record<keyof EnrollForm, string>> = {};
  if (!form.learnerId) errors.learnerId = "Choisissez l'apprenant";
  if (!form.sessionId) errors.sessionId = 'Choisissez la session';
  if (!form.approvalId) errors.approvalId = "Choisissez l'agrément qui couvre l'inscription";
  else {
    const option = options.find((o) => o.id === form.approvalId);
    if (option && !option.eligible) errors.approvalId = option.reason ?? 'Cet agrément ne peut pas couvrir cette inscription';
  }
  if (form.comment.trim().length > 500) errors.comment = 'Le commentaire ne peut dépasser 500 caractères';
  return errors;
}

export const enrollBody = (form: EnrollForm) => ({ learnerId: form.learnerId, sessionId: form.sessionId, approvalId: form.approvalId, ...(form.comment.trim() ? { comment: form.comment.trim() } : {}) });

export interface ReplaceForm { sessionId: string; approvalId: string }
export function validateReplace(form: ReplaceForm, current: Pick<Enrollment, 'sessionId'>, options: readonly ApprovalOption[]): Partial<Record<keyof ReplaceForm, string>> {
  const errors: Partial<Record<keyof ReplaceForm, string>> = {};
  if (!form.sessionId) errors.sessionId = 'Choisissez la nouvelle session';
  else if (form.sessionId === current.sessionId) errors.sessionId = "Choisissez une autre session que celle de l'inscription actuelle";
  const option = options.find((o) => o.id === form.approvalId);
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
