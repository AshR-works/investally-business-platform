import { DomainError } from '../../../shared-kernel';

const MAX_LENGTH = 200;

export class CompanyName {
  private constructor(readonly value: string) {}

  static of(raw: string): CompanyName {
    const value = (raw ?? '').trim().replace(/\s+/g, ' ');
    if (value.length === 0) {
      throw new DomainError('VALIDATION', 'Le nom de l\'entreprise est obligatoire');
    }
    if (value.length > MAX_LENGTH) {
      throw new DomainError('VALIDATION', `Le nom ne peut dépasser ${MAX_LENGTH} caractères`);
    }
    return new CompanyName(value);
  }

  /** Clé de comparaison pour la détection de doublons. */
  get normalized(): string {
    return this.value.toLocaleLowerCase('fr');
  }
}
