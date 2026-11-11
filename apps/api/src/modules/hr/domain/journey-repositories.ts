import { Page } from '../../../shared-kernel';
import { Journey, JourneyKind, JourneyStatus, JourneyTemplate } from './journey';

export interface JourneyListQuery {
  page: number;
  pageSize: number;
  /** Restreint à ces employés (liste vide = aucun) ; absent = pas de restriction (portée Tous). */
  employeeIds?: readonly string[];
  kind?: JourneyKind;
  status?: JourneyStatus;
}

/** Port de persistance des parcours (tâches comprises). Tri : création décroissante. */
export interface JourneyRepository {
  /** Crée ou met à jour (état des tâches comprises) ; une version périmée est un conflit ; un second parcours en cours (même employé, même nature) aussi. */
  save(journey: Journey): Promise<void>;
  findById(id: string): Promise<Journey | null>;
  /** Le parcours en cours d'un employé pour une nature, s'il existe. */
  activeOf(employeeId: string, kind: JourneyKind): Promise<Journey | null>;
  list(query: JourneyListQuery): Promise<Page<Journey>>;
  /** Verrouille la fiche de l'employé jusqu'à la fin de la transaction (deux lancements simultanés se suivent). */
  lockEmployee(employeeId: string): Promise<void>;
}

export interface JourneyTemplateRepository {
  /** Les deux modèles (un par nature). */
  all(): Promise<JourneyTemplate[]>;
  get(kind: JourneyKind): Promise<JourneyTemplate | null>;
  /** Remplace les tâches ; une version périmée est un conflit. */
  save(template: JourneyTemplate): Promise<void>;
}

export const JOURNEY_REPOSITORY = Symbol('JourneyRepository');
export const JOURNEY_TEMPLATE_REPOSITORY = Symbol('JourneyTemplateRepository');
