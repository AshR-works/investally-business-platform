import { AggregateRoot, DomainError } from '../../../shared-kernel';
import { LeavePeriod, dayOrdinal, isIsoDate } from './leave-calendar';

/**
 * Présence DÉCLARATIVE d'un employé pour un jour (RH-4a, D69). Une valeur parmi trois, aucune heure, aucun lieu, aucun retard, aucun texte libre : l'employé dit où il
 * travaille ce jour-là, il n'est pas surveillé. Au plus une déclaration par employé et par jour.
 */
export enum PresenceMode {
  OnSite = 'ON_SITE',
  Remote = 'REMOTE',
  Travel = 'TRAVEL',
}

/** Doit rester identique à la liste de l'interface de programmation (vérifié par `presence.spec.ts`). */
export const PRESENCE_MODES: readonly PresenceMode[] = [PresenceMode.OnSite, PresenceMode.Remote, PresenceMode.Travel];

/** Fenêtre de saisie autorisée, en jours autour d'aujourd'hui : l'employé corrige peu en arrière et planifie peu en avant ; la RH a plus de marge. */
export const SELF_WINDOW = { past: 7, future: 30 } as const;
export const HR_WINDOW = { past: 90, future: 90 } as const;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function parseMode(raw: string): PresenceMode {
  if (!PRESENCE_MODES.includes(raw as PresenceMode)) throw new DomainError('VALIDATION', 'Le mode de présence doit être : sur site, télétravail ou déplacement');
  return raw as PresenceMode;
}

export function assertDay(day: string): void {
  if (!isIsoDate(day)) throw new DomainError('VALIDATION', 'Le jour doit être une date valide (AAAA-MM-JJ)');
}

/** Vrai si la période d'absence couvre la journée ENTIÈRE : une demi-journée de congé ne l'interdit pas (on peut déclarer l'autre moitié). */
export function coversWholeDay(period: LeavePeriod, day: string): boolean {
  const ordinal = dayOrdinal(day);
  const first = dayOrdinal(period.start);
  const last = dayOrdinal(period.end);
  if (ordinal < first || ordinal > last) return false;
  if (ordinal === first && period.startHalf) return false;
  if (ordinal === last && period.endHalf) return false;
  return true;
}

export interface PresenceProps {
  id: string;
  employeeId: string;
  day: string;
  mode: PresenceMode;
  /** Compte qui a saisi (l'employé, ou la RH pour lui). */
  declaredByUserId: string;
  createdAt: Date;
  updatedAt: Date;
  version: number;
}

export class PresenceDeclaration extends AggregateRoot {
  private constructor(private props: PresenceProps) {
    super();
  }

  static declare(input: { id: string; employeeId: string; day: string; mode: string; declaredByUserId: string; now: Date }): PresenceDeclaration {
    if (!UUID.test(input.employeeId)) throw new DomainError('VALIDATION', "L'employé doit être un identifiant valide");
    assertDay(input.day);
    return new PresenceDeclaration({
      id: input.id, employeeId: input.employeeId, day: input.day, mode: parseMode(input.mode), declaredByUserId: input.declaredByUserId,
      createdAt: input.now, updatedAt: input.now, version: 1,
    });
  }

  static rehydrate(props: PresenceProps): PresenceDeclaration {
    return new PresenceDeclaration(props);
  }

  /** Change le mode du jour ; l'auteur de la dernière saisie est conservé. */
  change(input: { mode: string; by: string; now: Date }): void {
    this.props = { ...this.props, mode: parseMode(input.mode), declaredByUserId: input.by, updatedAt: input.now };
  }

  get id(): string { return this.props.id; }
  get employeeId(): string { return this.props.employeeId; }
  get day(): string { return this.props.day; }
  get mode(): PresenceMode { return this.props.mode; }
  get declaredByUserId(): string { return this.props.declaredByUserId; }
  get createdAt(): Date { return this.props.createdAt; }
  get updatedAt(): Date { return this.props.updatedAt; }
  get version(): number { return this.props.version; }
}
