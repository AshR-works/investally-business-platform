import { DomainError } from '../../../shared-kernel';
import { Commission } from './commission';

/** Façons de prendre contact avec l'entreprise via le facilitateur. */
export enum ContactMethod {
  WhatsappMessage = 'WHATSAPP_MESSAGE',
  PhoneCall = 'PHONE_CALL',
  Email = 'EMAIL',
  Meeting = 'MEETING',
  Other = 'OTHER',
}

const METHODS: readonly string[] = Object.values(ContactMethod);

/** Lien entre une entreprise et son facilitateur : méthode de contact, appartenance, commission éventuelle. */
export class Facilitation {
  private constructor(
    readonly facilitatorId: string,
    readonly contactMethod: ContactMethod,
    readonly isCompanyEmployee: boolean,
    readonly commission: Commission | null,
  ) {}

  /** Refuse une méthode inconnue ; appelable avant toute écriture. */
  static assertMethod(method: string): void {
    if (!METHODS.includes(method)) throw new DomainError('VALIDATION', 'La méthode de prise de contact est inconnue');
  }

  static of(input: { facilitatorId: string; contactMethod: string; isCompanyEmployee?: boolean; commission?: Commission | null }): Facilitation {
    if (!input.facilitatorId) throw new DomainError('VALIDATION', 'Le facilitateur est obligatoire');
    Facilitation.assertMethod(input.contactMethod);
    return new Facilitation(input.facilitatorId, input.contactMethod as ContactMethod, input.isCompanyEmployee === true, input.commission ?? null);
  }
}
