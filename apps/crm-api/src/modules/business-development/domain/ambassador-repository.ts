import { Page } from '../../../shared-kernel';
import { Ambassador, AmbassadorOrigin } from './ambassador';

/** Un ambassadeur avec le nom de son entreprise d'origine, s'il en a une (pour les listes). */
export interface AmbassadorListItem {
  ambassador: Ambassador;
  companyName: string | null;
}

export interface AmbassadorListQuery {
  page: number;
  pageSize: number;
  search?: string;
  origin?: AmbassadorOrigin;
  /** Restreint aux ambassadeurs créés par ces utilisateurs (liste vide = aucun) ; absent = pas de restriction (portée Tous). */
  ownerIds?: readonly string[];
}

/**
 * Port de persistance des ambassadeurs. Leur visibilité suit celle de leur créateur : `ownerIds` restreint aux ambassadeurs dont le
 * responsable est l'un de ces utilisateurs.
 */
export interface AmbassadorRepository {
  /** Crée ou met à jour ; une version périmée est un conflit ; un e-mail déjà pris par un autre ambassadeur aussi. */
  save(ambassador: Ambassador): Promise<void>;
  findById(id: string): Promise<Ambassador | null>;
  /** Un ambassadeur portant cet e-mail (hors `excludeId`), s'il existe. */
  findByEmail(emailKey: string, excludeId?: string): Promise<Ambassador | null>;
  /** Tri : nom, prénom. */
  list(query: AmbassadorListQuery): Promise<Page<AmbassadorListItem>>;
}

export const AMBASSADOR_REPOSITORY = Symbol('AmbassadorRepository');
