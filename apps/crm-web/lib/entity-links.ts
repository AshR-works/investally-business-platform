/** Les entités du CRM qui ont une fiche dédiée (D-NAV-3) et l'adresse de leur fiche : un seul endroit construit ces adresses. */
export type EntityKind = 'company' | 'contact' | 'offer' | 'opportunity' | 'approval';

const BASE: Record<EntityKind, string> = {
  company: '/companies',
  contact: '/contacts',
  offer: '/offers',
  opportunity: '/opportunities',
  approval: '/approvals',
};

/** Libellé de l'entité dans les phrases d'aide (« Ouvrir la fiche de l'offre … »). */
export const ENTITY_NOUN: Record<EntityKind, string> = { company: 'l’entreprise', contact: 'le contact', offer: 'l’offre', opportunity: 'l’opportunité', approval: 'l’agrément' };

/** Adresse de la fiche d'une entité ; l'identifiant est encodé. */
export const entityHref = (kind: EntityKind, id: string): string => `${BASE[kind]}/${encodeURIComponent(id)}`;
