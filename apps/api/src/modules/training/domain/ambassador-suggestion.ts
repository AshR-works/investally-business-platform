import { AggregateRoot } from '../../../shared-kernel';

/**
 * Suggestion d'ambassadeur au chargé de compte (CU-I-62, S8) : créée automatiquement quand une certification est délivrée à un
 * apprenant d'une entreprise (jamais pour un étudiant ou un particulier, sans entreprise). **Une suggestion, jamais une création
 * automatique** : le chargé de compte décide seul de créer l'ambassadeur depuis la fiche de l'apprenant. Elle ne donne **aucun accès
 * aux certifications elles-mêmes** (S8) : seules les données nécessaires à la suggestion sont copiées ici, pas la certification.
 */
export interface AmbassadorSuggestionProps {
  id: string;
  enrollmentId: string;
  learnerId: string;
  companyId: string;
  /** Chargé de compte propriétaire de l'entreprise au moment de la délivrance (copié : l'entreprise peut changer de propriétaire ensuite). */
  ownerUserId: string;
  createdAt: Date;
}

export class AmbassadorSuggestion extends AggregateRoot {
  private constructor(private props: AmbassadorSuggestionProps) {
    super();
  }

  static create(input: { id: string; enrollmentId: string; learnerId: string; companyId: string; ownerUserId: string; now: Date }): AmbassadorSuggestion {
    return new AmbassadorSuggestion({
      id: input.id, enrollmentId: input.enrollmentId, learnerId: input.learnerId, companyId: input.companyId, ownerUserId: input.ownerUserId, createdAt: input.now,
    });
  }

  static rehydrate(props: AmbassadorSuggestionProps): AmbassadorSuggestion {
    return new AmbassadorSuggestion(props);
  }

  get id(): string { return this.props.id; }
  get enrollmentId(): string { return this.props.enrollmentId; }
  get learnerId(): string { return this.props.learnerId; }
  get companyId(): string { return this.props.companyId; }
  get ownerUserId(): string { return this.props.ownerUserId; }
  get createdAt(): Date { return this.props.createdAt; }
}
