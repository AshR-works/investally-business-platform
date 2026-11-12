import { Facilitator } from '../domain/facilitator';

/** Modèle de lecture d'un facilitateur. */
export interface FacilitatorView {
  id: string;
  lastName: string;
  firstName: string;
  phone: string;
  comment: string | null;
  ownerUserId: string;
  createdAt: string;
}

export function toFacilitatorView(facilitator: Facilitator): FacilitatorView {
  return {
    id: facilitator.id,
    lastName: facilitator.lastName,
    firstName: facilitator.firstName,
    phone: facilitator.phone,
    comment: facilitator.comment,
    ownerUserId: facilitator.ownerUserId,
    createdAt: facilitator.createdAt.toISOString(),
  };
}
