export type DomainErrorCode =
  | 'VALIDATION'
  | 'UNAUTHENTICATED'
  | 'MFA_REQUIRED'
  | 'MFA_STEP_UP_REQUIRED'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'FORBIDDEN'
  | 'INVARIANT_VIOLATION';

/** Erreur métier typée. La couche Presentation la traduit en réponse HTTP. */
export class DomainError extends Error {
  constructor(
    readonly code: DomainErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'DomainError';
  }
}
