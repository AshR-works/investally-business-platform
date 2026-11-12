import { Enrollment, EnrollmentStatus } from '../domain/enrollment';
import { Learner, LearnerKind } from '../domain/learner';
import { IsoDate } from '../domain/session-dates';

export interface LearnerView {
  id: string;
  /** Étudiant et particulier n'ont pas d'entreprise : `companyId` est alors absent et `companyName` vide. */
  kind: LearnerKind;
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

export const toLearnerView = (learner: Learner, companyName: string): LearnerView => ({
  id: learner.id, kind: learner.kind, companyId: learner.companyId, companyName, contactId: learner.contactId, lastName: learner.lastName, firstName: learner.firstName,
  email: learner.email, phone: learner.phone, version: learner.version, createdAt: learner.createdAt.toISOString(),
});

/** Un agrément de l'entreprise de l'apprenant, avec la réponse à « couvre-t-il cette inscription ? » (et pourquoi pas). */
export interface ApprovalOptionView {
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
  /** Pourquoi cet agrément ne peut pas couvrir l'inscription (absent s'il le peut). */
  reason: string | null;
}

export interface EnrollmentContext {
  trainingTitle: string;
  sessionStart: IsoDate;
  sessionEnd: IsoDate;
  sessionStatus: string;
  roomName: string;
  learnerName: string;
  learnerKind: LearnerKind;
  companyName: string;
  approvalLabel: string;
}

/** Qui règle les frais d'un apprenant sans entreprise : lui-même, ou un tiers (nom et nature). */
export interface EnrollmentPayerView {
  kind: 'SELF' | 'THIRD_PARTY';
  name: string | null;
  type: string | null;
}

export interface EnrollmentView extends EnrollmentContext {
  id: string;
  sessionId: string;
  learnerId: string;
  companyId: string | null;
  approvalId: string | null;
  /** Apprenant sans entreprise : qui règle les frais ; absent quand un agrément couvre l'inscription. */
  payer: EnrollmentPayerView | null;
  /** Prix complet du certificat : compté sur l'agrément (agrément en somme), ou montant dû d'un apprenant sans entreprise ; absent pour un agrément en places seulement. */
  chargedAmount: string | null;
  status: EnrollmentStatus;
  comment: string | null;
  cancelReason: string | null;
  confirmedAt: string | null;
  replacedById: string | null;
  version: number;
  createdAt: string;
}

export const toEnrollmentView = (e: Enrollment, context: EnrollmentContext): EnrollmentView => ({
  ...context,
  id: e.id, sessionId: e.sessionId, learnerId: e.learnerId, companyId: e.companyId, approvalId: e.approvalId,
  payer: e.payer ? { kind: e.payer.kind, name: e.payer.kind === 'THIRD_PARTY' ? e.payer.name : null, type: e.payer.kind === 'THIRD_PARTY' ? e.payer.type : null } : null, chargedAmount: e.chargedAmount, status: e.status,
  comment: e.comment, cancelReason: e.cancelReason, confirmedAt: e.confirmedAt ? e.confirmedAt.toISOString() : null, replacedById: e.replacedById,
  version: e.version, createdAt: e.createdAt.toISOString(),
});
