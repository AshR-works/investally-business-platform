/** Certificats, attestations et suggestions d'ambassadeur (S5.3c) : délivrance suggérée puis à la main, jamais automatique. */

export const CERTIFICATION_PERMISSIONS = {
  read: 'training.certification.read', issue: 'training.certification.issue', revoke: 'training.certification.revoke',
} as const;

export type CertificationKind = 'CERTIFICATE' | 'ATTESTATION';

export const CERTIFICATION_KIND_LABEL: Record<CertificationKind, string> = { CERTIFICATE: 'Certificat', ATTESTATION: 'Attestation' };

export interface CertificationView {
  id: string;
  enrollmentId: string;
  kind: CertificationKind;
  referenceNumber: string;
  status: 'ISSUED' | 'REVOKED';
  issuedByUserId: string;
  issuedAt: string;
  revokedByUserId: string | null;
  revokedAt: string | null;
  revokeReason: string | null;
}

export interface CertificationSheetRow {
  enrollmentId: string;
  learnerId: string;
  learnerName: string;
  certification: CertificationView | null;
}

export interface CertificationSheet {
  sessionId: string;
  sessionStatus: string;
  rows: CertificationSheetRow[];
  /** La session est clôturée : seule condition pour délivrer (CU-I-60). */
  canIssue: boolean;
}

export interface AmbassadorSuggestion {
  id: string;
  learnerId: string;
  learnerName: string;
  companyId: string;
  companyName: string;
  createdAt: string;
}
