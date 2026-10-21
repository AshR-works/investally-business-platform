import { DomainError } from '../../../shared-kernel';

const MAX_LENGTH = 254;
// Volontairement simple : la vraie validation est l'envoi d'un e-mail de confirmation.
const SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** Objet-valeur : adresse e-mail validée et normalisée ; la clé en minuscules sert à l'unicité et à la recherche. */
export class Email {
  private constructor(
    readonly value: string,
    /** Forme normalisée (minuscules) : clé d'unicité et de recherche. */
    readonly key: string,
  ) {}

  static of(raw: string): Email {
    const value = (raw ?? '').trim();
    if (value.length === 0 || value.length > MAX_LENGTH || !SHAPE.test(value)) {
      throw new DomainError('VALIDATION', "Adresse e-mail invalide");
    }
    return new Email(value, value.toLowerCase());
  }

  /** Clé de recherche sans lever d'erreur (connexion : une adresse invalide = identifiants invalides). */
  static keyOf(raw: string): string {
    return (raw ?? '').trim().toLowerCase().slice(0, MAX_LENGTH);
  }
}
