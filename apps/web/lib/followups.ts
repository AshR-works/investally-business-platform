import type { Tone } from '../components/data/badge';
import type { Followup } from './types';
import { isRealDate, todayIso } from './receipts';

/** Canaux d'une relance (codes de l'API → libellés). */
export const FOLLOWUP_CHANNELS = [
  { value: 'CALL', label: 'Appel' },
  { value: 'EMAIL', label: 'E-mail' },
  { value: 'WHATSAPP', label: 'WhatsApp' },
  { value: 'MEETING', label: 'Rencontre' },
  { value: 'OTHER', label: 'Autre' },
] as const;

export const channelLabel = (value: string): string => FOLLOWUP_CHANNELS.find((c) => c.value === value)?.label ?? value;

/** États d'une relance, avec le libellé et la teinte (le sens reste porté par le texte). */
export const FOLLOWUP_STATUS: Record<string, { label: string; tone: Tone }> = {
  PLANNED: { label: 'À faire', tone: 'info' },
  DONE: { label: 'Terminée', tone: 'ok' },
  CANCELLED: { label: 'Annulée', tone: 'neutral' },
};

/** Délai proposé par défaut pour la première relance (valeur proposée, à confirmer) et nombre maximum par offre. */
export const DEFAULT_FOLLOWUP_DELAY_DAYS = 7;
export const MAX_FOLLOWUPS_PER_OFFER = 3;

/** Date « AAAA-MM-JJ » à `days` jours de `from` (UTC). */
export function addDays(from: string, days: number): string {
  return new Date(Date.parse(`${from}T00:00:00Z`) + days * 86400000).toISOString().slice(0, 10);
}

/** Ce que l'utilisateur saisit pour planifier ou modifier une relance. */
export interface FollowupForm {
  offerId: string;
  dueOn: string;
  channel: string;
  note: string;
}

export type FollowupField = keyof FollowupForm;
export type FollowupErrors = Partial<Record<FollowupField, string>>;

export const EMPTY_FOLLOWUP_FORM = (offerId = '', now: Date = new Date()): FollowupForm => ({
  offerId, dueOn: addDays(todayIso(now), DEFAULT_FOLLOWUP_DELAY_DAYS), channel: 'CALL', note: '',
});

export function formFromFollowup(followup: Followup): FollowupForm {
  return { offerId: followup.offerId, dueOn: followup.dueOn, channel: followup.channel, note: followup.note ?? '' };
}

/**
 * Contrôles de saisie rapides, champ par champ (le serveur refait tous les contrôles) : offre choisie, échéance réelle et non
 * passée (sauf si on garde l'échéance déjà passée d'une relance en retard), canal connu, note de 500 caractères au plus.
 */
export function validateFollowupFields(form: FollowupForm, context: { today: string; keepDueOn?: string; needsOffer: boolean }): FollowupErrors {
  const errors: FollowupErrors = {};
  if (context.needsOffer && !form.offerId) errors.offerId = 'Choisissez l’offre à relancer.';
  const due = form.dueOn.trim();
  if (!due) errors.dueOn = 'L’échéance est obligatoire.';
  else if (!isRealDate(due)) errors.dueOn = 'L’échéance n’est pas une date valide.';
  else if (due < context.today && due !== context.keepDueOn) errors.dueOn = 'L’échéance ne peut pas être dans le passé.';
  if (!FOLLOWUP_CHANNELS.some((c) => c.value === form.channel)) errors.channel = 'Choisissez le canal de la relance.';
  if (form.note.length > 500) errors.note = 'La note ne peut dépasser 500 caractères.';
  return errors;
}

/** Corps de la planification (l'offre est incluse) ou de la modification (la version lue, jamais l'offre). */
export function buildFollowupBody(form: FollowupForm, options: { version?: number } = {}): Record<string, unknown> {
  const body: Record<string, unknown> = { dueOn: form.dueOn.trim(), channel: form.channel, note: form.note.trim() };
  if (options.version === undefined) {
    body.offerId = form.offerId;
    if (!form.note.trim()) delete body.note;
  } else {
    body.version = options.version;
  }
  return body;
}

/** Texte obligatoire d'une clôture (résultat ou motif) : 3 caractères au moins, la limite donnée au plus. */
export function validateClosingText(text: string, max: number): string | null {
  const t = text.trim();
  if (t.length < 3) return 'Ce champ est obligatoire (3 caractères au moins).';
  if (t.length > max) return `Ce champ ne peut dépasser ${max} caractères.`;
  return null;
}

export type FollowupAction = 'complete' | 'edit' | 'cancel';
export const FOLLOWUP_ACTION_LABEL: Record<FollowupAction, string> = { complete: 'Terminer', edit: 'Modifier', cancel: 'Annuler la relance' };

/** Actions proposées : seulement sur une relance À FAIRE, selon les droits de l'utilisateur (le serveur re-contrôle tout). */
export function followupActions(status: string, rights: { complete: boolean; update: boolean }): FollowupAction[] {
  if (status !== 'PLANNED') return [];
  const actions: FollowupAction[] = [];
  if (rights.complete) actions.push('complete');
  if (rights.update) actions.push('edit', 'cancel');
  return actions;
}

/** Filtres rapides de la liste : un seul actif, chacun traduit en paramètres de requête. */
export const FOLLOWUP_FILTERS = [
  { value: 'todo', label: 'À faire', params: { status: 'PLANNED' } },
  { value: 'overdue', label: 'En retard', params: { due: 'overdue' } },
  { value: 'today', label: 'Aujourd’hui', params: { due: 'today' } },
  { value: 'upcoming', label: 'À venir', params: { due: 'upcoming' } },
  { value: 'done', label: 'Terminées', params: { status: 'DONE' } },
  { value: 'cancelled', label: 'Annulées', params: { status: 'CANCELLED' } },
] as const;

export type FollowupFilter = (typeof FOLLOWUP_FILTERS)[number]['value'];

/** Paramètres de la liste : page, taille, filtre rapide et offre éventuelle. */
export function followupListParams(filter: FollowupFilter, page: number, pageSize: number, offerId?: string, companyId?: string): URLSearchParams {
  const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
  for (const [key, value] of Object.entries(FOLLOWUP_FILTERS.find((f) => f.value === filter)?.params ?? {})) params.set(key, value);
  if (offerId) params.set('offerId', offerId);
  if (companyId) params.set('companyId', companyId);
  return params;
}
