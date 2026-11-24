import { AmbassadorSuggestion } from '../domain/ambassador-suggestion';
import { Certification } from '../domain/certification';

export interface CertificationView {
  id: string;
  enrollmentId: string;
  kind: 'CERTIFICATE' | 'ATTESTATION';
  referenceNumber: string;
  status: 'ISSUED' | 'REVOKED';
  issuedByUserId: string;
  issuedAt: string;
  revokedByUserId: string | null;
  revokedAt: string | null;
  revokeReason: string | null;
}

export const toCertificationView = (c: Certification): CertificationView => ({
  id: c.id, enrollmentId: c.enrollmentId, kind: c.kind, referenceNumber: c.referenceNumber, status: c.status,
  issuedByUserId: c.issuedByUserId, issuedAt: c.issuedAt.toISOString(),
  revokedByUserId: c.revokedByUserId, revokedAt: c.revokedAt?.toISOString() ?? null, revokeReason: c.revokeReason,
});

/** Une ligne par inscrit confirmé : sa certification, si elle existe (jamais de suggestion ici, juste ce qui a été délivré). */
export interface CertificationSheetRow {
  enrollmentId: string;
  learnerId: string;
  learnerName: string;
  certification: CertificationView | null;
}

export interface CertificationSheetView {
  sessionId: string;
  sessionStatus: string;
  rows: CertificationSheetRow[];
  /** La session est clôturée : seule condition pour délivrer (CU-I-60). */
  canIssue: boolean;
}

/** Le nom de l'apprenant et celui de l'entreprise sont résolus à la lecture (jamais stockés ici : ils peuvent changer après la suggestion). */
export interface AmbassadorSuggestionView {
  id: string;
  learnerId: string;
  learnerName: string;
  companyId: string;
  companyName: string;
  createdAt: string;
}

export const toAmbassadorSuggestionView = (s: AmbassadorSuggestion, learnerName: string, companyName: string): AmbassadorSuggestionView => ({
  id: s.id, learnerId: s.learnerId, learnerName, companyId: s.companyId, companyName, createdAt: s.createdAt.toISOString(),
});
