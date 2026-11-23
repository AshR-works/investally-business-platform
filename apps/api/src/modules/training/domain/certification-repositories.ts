import { AmbassadorSuggestion } from './ambassador-suggestion';
import { Certification } from './certification';

/** Port de persistance des certifications (au plus une par inscription). */
export interface CertificationRepository {
  save(certification: Certification): Promise<void>;
  find(enrollmentId: string): Promise<Certification | null>;
  bySession(enrollmentIds: readonly string[]): Promise<Certification[]>;
  /** Numéro de référence suivant, attribué de façon atomique (une séquence de la base). */
  nextReferenceNumber(): Promise<string>;
}

export const CERTIFICATION_REPOSITORY = Symbol('CertificationRepository');

/** Port de persistance des suggestions d'ambassadeur (S8 : jamais de lecture des certifications depuis ce port). */
export interface AmbassadorSuggestionRepository {
  save(suggestion: AmbassadorSuggestion): Promise<void>;
  /** Les suggestions de ces propriétaires (chargés de compte), les plus récentes d'abord ; `'all'` = toutes (portée Tous). */
  forOwners(ownerUserIds: readonly string[] | 'all'): Promise<AmbassadorSuggestion[]>;
}

export const AMBASSADOR_SUGGESTION_REPOSITORY = Symbol('AmbassadorSuggestionRepository');
