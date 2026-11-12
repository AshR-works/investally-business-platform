import { Inject, Injectable } from '@nestjs/common';
import { CLOCK, Clock } from '../../../shared-kernel';
import { AuditAction, AuditEntry } from '../domain/audit-entry';
import { AUDIT_REPOSITORY, AuditRepository } from '../domain/audit-repository';

/** Profondeur de l'historique des connexions affiché à l'utilisateur (jours). */
export const LOGIN_HISTORY_WINDOW_DAYS = 90;
/** Nombre d'événements par page (par défaut et au maximum). */
export const LOGIN_HISTORY_DEFAULT_LIMIT = 25;
export const LOGIN_HISTORY_MAX_LIMIT = 100;

/**
 * Une connexion telle que l'intéressé la voit. Volontairement grossière : réussite ou échec, et à quelle étape. Jamais le
 * motif précis (compte inconnu, verrouillé, inactif…) ni de localisation.
 */
export interface LoginEvent {
  id: string;
  at: string;
  result: 'SUCCESS' | 'FAILED';
  /** Étape de l'échec : mot de passe (ou compte) ou second facteur ; absent pour une réussite. */
  stage?: 'PASSWORD' | 'SECOND_FACTOR';
  ipAddress: string;
  device: string;
}

/** Page de l'historique : `nextBefore` est le curseur de la page suivante (nul s'il n'y en a pas). */
export interface LoginHistoryPage {
  items: LoginEvent[];
  nextBefore: string | null;
  windowDays: number;
}

/** API publique de lecture du journal pour les autres modules (lecture seule, jamais d'écriture). */
export interface AuditReader {
  /** Historique des connexions d'UN utilisateur, borné dans le temps, du plus récent au plus ancien. */
  loginHistory(query: { userId: string; before?: Date; limit?: number }): Promise<LoginHistoryPage>;
}

export const AUDIT_READER = Symbol('AuditReader');

/** Entrée d'audit → événement de connexion affichable (aucun détail interne : motif, valeurs avant/après). */
export function toLoginEvent(entry: AuditEntry): LoginEvent {
  const failed = entry.action === AuditAction.LoginFailed;
  const reason = typeof entry.newValue?.reason === 'string' ? entry.newValue.reason : '';
  return {
    id: entry.id,
    at: entry.createdAt.toISOString(),
    result: failed ? 'FAILED' : 'SUCCESS',
    ...(failed ? { stage: reason.startsWith('MFA_') ? ('SECOND_FACTOR' as const) : ('PASSWORD' as const) } : {}),
    ipAddress: entry.actor.ipAddress,
    device: entry.actor.device,
  };
}

/** Lecture de l'historique des connexions dans le journal d'audit (aucune table supplémentaire). */
@Injectable()
export class DefaultAuditReader implements AuditReader {
  constructor(
    @Inject(AUDIT_REPOSITORY) private readonly repository: AuditRepository,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  /**
   * Lit une page : fenêtre de 90 jours, taille bornée (25 par défaut, 100 au plus). On demande une ligne de plus que la
   * page pour savoir s'il en reste, sans compter toute la table.
   */
  async loginHistory(query: { userId: string; before?: Date; limit?: number }): Promise<LoginHistoryPage> {
    const limit = Math.min(LOGIN_HISTORY_MAX_LIMIT, Math.max(1, Math.floor(query.limit ?? LOGIN_HISTORY_DEFAULT_LIMIT)));
    const since = new Date(this.clock.now().getTime() - LOGIN_HISTORY_WINDOW_DAYS * 24 * 60 * 60 * 1000);
    const rows = await this.repository.listLoginEvents({ userId: query.userId, since, before: query.before, limit: limit + 1 });
    const page = rows.slice(0, limit);
    return {
      items: page.map(toLoginEvent),
      nextBefore: rows.length > limit ? page[page.length - 1].createdAt.toISOString() : null,
      windowDays: LOGIN_HISTORY_WINDOW_DAYS,
    };
  }
}
