/** Jours entiers entre deux dates « AAAA-MM-JJ » (positif si `to` est après `from`). */
export const daysBetweenIso = (from: string, to: string): number =>
  Math.round((new Date(`${to}T00:00:00Z`).getTime() - new Date(`${from}T00:00:00Z`).getTime()) / 86_400_000);
