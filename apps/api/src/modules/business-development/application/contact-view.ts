import { Contact } from '../domain/contact';

/** Modèle de lecture d'un contact (jamais l'entité). */
export interface ContactView {
  id: string;
  companyId: string;
  companyName: string;
  lastName: string;
  firstName: string;
  role: string;
  email: string | null;
  phone: string | null;
  createdAt: string;
  /** Verrou optimiste : à renvoyer tel quel pour modifier le contact. */
  version: number;
}

export function toContactView(contact: Contact, companyName: string): ContactView {
  return {
    id: contact.id,
    companyId: contact.companyId,
    companyName,
    lastName: contact.lastName,
    firstName: contact.firstName,
    role: contact.role,
    email: contact.email,
    phone: contact.phone,
    createdAt: contact.createdAt.toISOString(),
    version: contact.version,
  };
}
