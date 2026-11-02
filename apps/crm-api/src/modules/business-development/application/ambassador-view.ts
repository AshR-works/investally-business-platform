import { Ambassador } from '../domain/ambassador';

/** Modèle de lecture d'un ambassadeur (jamais l'entité). */
export interface AmbassadorView {
  id: string;
  lastName: string;
  firstName: string;
  origin: string;
  companyId: string | null;
  companyName: string | null;
  email: string | null;
  phone: string | null;
  /** Depuis quand la personne est ambassadeur, « AAAA-MM-JJ ». */
  appointedOn: string;
  note: string | null;
  /** Le chargé de compte qui l'a créé. */
  ownerUserId: string;
  createdAt: string;
  /** Verrou optimiste : à renvoyer tel quel pour modifier l'ambassadeur. */
  version: number;
}

export function toAmbassadorView(ambassador: Ambassador, companyName: string | null): AmbassadorView {
  return {
    id: ambassador.id,
    lastName: ambassador.lastName,
    firstName: ambassador.firstName,
    origin: ambassador.origin,
    companyId: ambassador.companyId,
    companyName,
    email: ambassador.email,
    phone: ambassador.phone,
    appointedOn: ambassador.appointedOn,
    note: ambassador.note,
    ownerUserId: ambassador.ownerUserId,
    createdAt: ambassador.createdAt.toISOString(),
    version: ambassador.version,
  };
}
