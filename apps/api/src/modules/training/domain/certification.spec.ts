import { DomainError } from '../../../shared-kernel';
import { CERTIFICATION_KINDS, Certification, parseCertificationKind } from './certification';

const NOW = new Date('2026-11-06T09:00:00.000Z');

const expectError = (fn: () => unknown, code: string, message: RegExp) => {
  try {
    fn();
  } catch (error) {
    expect(error).toBeInstanceOf(DomainError);
    expect((error as DomainError).code).toBe(code);
    expect((error as DomainError).message).toMatch(message);
    return;
  }
  throw new Error('une erreur de domaine était attendue');
};

describe('Type délivré', () => {
  it('ne connaît que le certificat et l\'attestation', () => {
    expect(CERTIFICATION_KINDS).toEqual(['CERTIFICATE', 'ATTESTATION']);
    expect(parseCertificationKind('CERTIFICATE')).toBe('CERTIFICATE');
    expectError(() => parseCertificationKind('DIPLOME'), 'VALIDATION', /certificat ou une attestation/);
  });

  it('la délivrance elle-même refuse un type invalide (pas seulement la validation d\'entrée)', () => {
    expectError(() => Certification.issue({ id: 'c1', enrollmentId: 'en1', kind: 'DIPLOME', referenceNumber: 'CERT-2026-000099', issuedByUserId: 'u1', now: NOW }), 'VALIDATION', /certificat ou une attestation/);
  });
});

describe('Délivrance', () => {
  it('se crée délivrée, version 1', () => {
    const c = Certification.issue({ id: 'c1', enrollmentId: 'en1', kind: 'CERTIFICATE', referenceNumber: 'CERT-2026-000001', issuedByUserId: 'u1', now: NOW });
    expect(c).toMatchObject({ enrollmentId: 'en1', kind: 'CERTIFICATE', referenceNumber: 'CERT-2026-000001', status: 'ISSUED', issuedByUserId: 'u1', version: 1 });
    expect(c.revokedByUserId).toBeNull();
    expect(c.revokeReason).toBeNull();
  });

  it('se révoque avec justification obligatoire, retient l\'auteur et la date de révocation', () => {
    const c = Certification.issue({ id: 'c1', enrollmentId: 'en1', kind: 'ATTESTATION', referenceNumber: 'CERT-2026-000002', issuedByUserId: 'u1', now: NOW });
    const later = new Date('2026-11-07T10:00:00Z');
    c.revoke({ reason: 'Fraude constatée', by: 'u2', now: later });
    expect(c).toMatchObject({ status: 'REVOKED', revokedByUserId: 'u2', revokedAt: later, revokeReason: 'Fraude constatée' });
  });

  it('refuse une révocation sans motif, et une seconde révocation', () => {
    const c = Certification.issue({ id: 'c1', enrollmentId: 'en1', kind: 'CERTIFICATE', referenceNumber: 'CERT-2026-000003', issuedByUserId: 'u1', now: NOW });
    expectError(() => c.revoke({ reason: '   ', by: 'u1', now: NOW }), 'VALIDATION', /justification.*obligatoire/);
    c.revoke({ reason: 'Erreur de saisie', by: 'u1', now: NOW });
    expectError(() => c.revoke({ reason: 'Encore', by: 'u1', now: NOW }), 'INVARIANT_VIOLATION', /déjà révoquée/);
  });

  it('refuse un motif de révocation de plus de 500 caractères', () => {
    const c = Certification.issue({ id: 'c1', enrollmentId: 'en1', kind: 'CERTIFICATE', referenceNumber: 'CERT-2026-000004', issuedByUserId: 'u1', now: NOW });
    expectError(() => c.revoke({ reason: 'x'.repeat(501), by: 'u1', now: NOW }), 'VALIDATION', /500 caractères/);
  });
});
