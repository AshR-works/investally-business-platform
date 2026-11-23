import { AmbassadorSuggestion } from '../../src/modules/training/domain/ambassador-suggestion';
import { Certification } from '../../src/modules/training/domain/certification';
import { AmbassadorSuggestionRepository, CertificationRepository } from '../../src/modules/training/domain/certification-repositories';
import { DomainError } from '../../src/shared-kernel';

/** Certifications en mémoire : au plus une par inscription ; numéros de référence simulés (suite simple). */
export class InMemoryCertifications implements CertificationRepository {
  readonly items: Certification[] = [];
  private seq = 0;

  async save(certification: Certification) {
    if (this.items.includes(certification)) return;
    if (this.items.some((c) => c.enrollmentId === certification.enrollmentId)) throw new DomainError('CONFLICT', 'Une délivrance est déjà enregistrée pour cette inscription : rechargez la page');
    this.items.push(certification);
  }
  async find(enrollmentId: string) { return this.items.find((c) => c.enrollmentId === enrollmentId) ?? null; }
  async bySession(enrollmentIds: readonly string[]) { return this.items.filter((c) => enrollmentIds.includes(c.enrollmentId)); }
  async nextReferenceNumber() { return `CERT-TEST-${String(++this.seq).padStart(6, '0')}`; }
}

/** Suggestions d'ambassadeur en mémoire : au plus une par inscription. */
export class InMemoryAmbassadorSuggestions implements AmbassadorSuggestionRepository {
  readonly items: AmbassadorSuggestion[] = [];

  async save(suggestion: AmbassadorSuggestion) { this.items.push(suggestion); }
  async forOwners(ownerUserIds: readonly string[] | 'all') {
    const rows = ownerUserIds === 'all' ? this.items : this.items.filter((s) => ownerUserIds.includes(s.ownerUserId));
    return [...rows].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }
}
