import { DomainError } from '../../../shared-kernel';

/**
 * Montants en centimes entiers : le cumul d'un agrément ne passe jamais par des nombres à virgule. Un montant est un texte décimal à deux
 * décimales au plus (« 750000.00 »).
 */
export function toCents(amount: string): number {
  const match = /^(\d{1,12})(?:\.(\d{1,2}))?$/.exec(amount.trim());
  if (!match) throw new DomainError('VALIDATION', `Montant illisible : « ${amount} »`);
  return Number(match[1]) * 100 + Number((match[2] ?? '').padEnd(2, '0'));
}

export function fromCents(cents: number): string {
  const whole = Math.trunc(cents / 100);
  const fraction = String(Math.abs(cents % 100)).padStart(2, '0');
  return `${whole}.${fraction}`;
}

/** Montant lisible pour un message (« 1 250 000,50 »). */
export function amountLabel(cents: number): string {
  const whole = Math.trunc(cents / 100).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  const fraction = cents % 100;
  return fraction === 0 ? whole : `${whole},${String(fraction).padStart(2, '0')}`;
}
