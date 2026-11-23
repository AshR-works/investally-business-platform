import { AggregateRoot, DomainError } from '../../../shared-kernel';

/**
 * Certificat ou attestation délivrés à un inscrit confirmé (S5.3c, lot c). Toujours **suggérés puis délivrés à la main** par le
 * responsable Investudy (S6) : jamais automatique, et seulement une fois la session **clôturée**. Un certificat n'est délivrable que si
 * les deux seuils sont atteints ; une attestation, si le taux de présence seul l'est (CU-I-60). Révocable, avec justification
 * obligatoire (CU-I-61) : le document reste consultable, marqué révoqué, jamais supprimé.
 */
export type CertificationKind = 'CERTIFICATE' | 'ATTESTATION';
export const CERTIFICATION_KINDS: readonly CertificationKind[] = ['CERTIFICATE', 'ATTESTATION'];

export function parseCertificationKind(raw: string): CertificationKind {
  if (!CERTIFICATION_KINDS.includes(raw as CertificationKind)) throw new DomainError('VALIDATION', 'Le type délivré doit être un certificat ou une attestation');
  return raw as CertificationKind;
}

export type CertificationStatus = 'ISSUED' | 'REVOKED';

export interface CertificationProps {
  id: string;
  enrollmentId: string;
  kind: CertificationKind;
  /** Numéro de référence, attribué une fois pour toutes à la délivrance (valeur de départ « à confirmer » : suite simple, sans vérification externe, CU-I-64). */
  referenceNumber: string;
  status: CertificationStatus;
  issuedByUserId: string;
  issuedAt: Date;
  revokedByUserId: string | null;
  revokedAt: Date | null;
  revokeReason: string | null;
  version: number;
}

export class Certification extends AggregateRoot {
  private constructor(private props: CertificationProps) {
    super();
  }

  static issue(input: { id: string; enrollmentId: string; kind: string; referenceNumber: string; issuedByUserId: string; now: Date }): Certification {
    return new Certification({
      id: input.id, enrollmentId: input.enrollmentId, kind: parseCertificationKind(input.kind), referenceNumber: input.referenceNumber, status: 'ISSUED',
      issuedByUserId: input.issuedByUserId, issuedAt: input.now, revokedByUserId: null, revokedAt: null, revokeReason: null, version: 1,
    });
  }

  static rehydrate(props: CertificationProps): Certification {
    return new Certification(props);
  }

  /** Révoque, avec justification obligatoire ; le document reste consultable (marqué révoqué, jamais supprimé). */
  revoke(input: { reason: string; by: string; now: Date }): void {
    if (this.props.status === 'REVOKED') throw new DomainError('INVARIANT_VIOLATION', 'Cette délivrance est déjà révoquée');
    const reason = (input.reason ?? '').trim();
    if (!reason) throw new DomainError('VALIDATION', 'La justification de la révocation est obligatoire');
    if (reason.length > 500) throw new DomainError('VALIDATION', 'La justification ne peut dépasser 500 caractères');
    this.props = { ...this.props, status: 'REVOKED', revokedByUserId: input.by, revokedAt: input.now, revokeReason: reason };
  }

  get id(): string { return this.props.id; }
  get enrollmentId(): string { return this.props.enrollmentId; }
  get kind(): CertificationKind { return this.props.kind; }
  get referenceNumber(): string { return this.props.referenceNumber; }
  get status(): CertificationStatus { return this.props.status; }
  get issuedByUserId(): string { return this.props.issuedByUserId; }
  get issuedAt(): Date { return this.props.issuedAt; }
  get revokedByUserId(): string | null { return this.props.revokedByUserId; }
  get revokedAt(): Date | null { return this.props.revokedAt; }
  get revokeReason(): string | null { return this.props.revokeReason; }
  get version(): number { return this.props.version; }
}
