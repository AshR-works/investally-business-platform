import { Page } from '../../../shared-kernel';
import { Contact, ContactRole } from './contact';

/** Un contact et le nom de son entreprise (pour les listes). */
export interface ContactListItem {
  contact: Contact;
  companyName: string;
}

/**
 * Port de persistance des contacts. La visibilité d'un contact suit celle de son entreprise : `ownerIds` restreint aux
 * contacts dont l'entreprise appartient à l'un de ces propriétaires (liste vide = aucun) ; absent = pas de restriction.
 */
export interface ContactRepository {
  save(contact: Contact): Promise<void>;
  findById(id: string): Promise<Contact | null>;
  /** Suppression logique : le contact disparaît partout. */
  remove(id: string): Promise<void>;
  /** Contacts non supprimés de la même entreprise portant le même nom OU le même e-mail (hors `excludeId`). */
  findDuplicates(query: { companyId: string; nameKey: string; emailKey: string | null; excludeId?: string }): Promise<Contact[]>;
  list(query: { page: number; pageSize: number; search?: string; companyId?: string; role?: ContactRole; ownerIds?: readonly string[] }): Promise<Page<ContactListItem>>;
}

export const CONTACT_REPOSITORY = Symbol('ContactRepository');
