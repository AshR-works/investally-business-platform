export enum RiskLevel {
  Low = 'LOW',
  Medium = 'MEDIUM',
  High = 'HIGH',
  Critical = 'CRITICAL',
}

export interface RiskSignals {
  /** Appareil/navigateur jamais vu pour ce compte. */
  newDevice: boolean;
  /** Plage réseau jamais vue pour ce compte. */
  newNetwork: boolean;
  /** Échecs de connexion récents avant ce succès. */
  recentFailures: number;
  /** Rôle privilégié (SuperAdmin, Direction, Finance). */
  privilegedRole: boolean;
  /** Réutilisation d'un jeton de rafraîchissement : vol probable. */
  tokenReuse?: boolean;
}

/**
 * Niveau de risque d'une session (SECURITY.md §3). Score additif :
 * nouvel appareil +1, nouveau réseau +1, 1–2 échecs récents +1 (3 et plus : +2), rôle privilégié +1.
 * 0–1 LOW · 2 MEDIUM · 3 HIGH (step-up MFA exigé) · ≥4 CRITICAL ; réutilisation de jeton = CRITICAL immédiat.
 * Les « horaires inhabituels » de la spécification (H) ne sont pas encore pris en compte.
 */
export function assessRisk(signals: RiskSignals): RiskLevel {
  if (signals.tokenReuse) return RiskLevel.Critical;
  let score = 0;
  if (signals.newDevice) score += 1;
  if (signals.newNetwork) score += 1;
  if (signals.recentFailures >= 3) score += 2;
  else if (signals.recentFailures >= 1) score += 1;
  if (signals.privilegedRole) score += 1;

  if (score >= 4) return RiskLevel.Critical;
  if (score === 3) return RiskLevel.High;
  if (score === 2) return RiskLevel.Medium;
  return RiskLevel.Low;
}
