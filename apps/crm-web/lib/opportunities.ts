import type { Tone } from '../components/data/badge';
import type { Opportunity } from './types';

/** Étapes du pipeline dans l'ordre (codes de l'API → libellés ; noms du prototype, à confirmer). */
export const OPPORTUNITY_STAGES = [
  { value: 'QUALIFICATION', label: 'Qualification' },
  { value: 'PROPOSAL', label: 'Proposition' },
  { value: 'NEGOTIATION', label: 'Négociation' },
  { value: 'AGREEMENT_IN_PRINCIPLE', label: 'Accord de principe' },
  { value: 'ACCREDITATION', label: 'Agrément' },
] as const;

export const stageLabel = (value: string | null | undefined): string => OPPORTUNITY_STAGES.find((s) => s.value === value)?.label ?? value ?? '—';

/** États d'une opportunité, avec le libellé et la teinte (le sens reste porté par le texte). */
export const OPPORTUNITY_STATUS: Record<string, { label: string; tone: Tone }> = {
  OPEN: { label: 'Ouverte', tone: 'info' },
  WON: { label: 'Gagnée', tone: 'ok' },
  LOST: { label: 'Perdue', tone: 'bad' },
};

export const OPPORTUNITY_SOURCES = [
  { value: 'PROSPECTING', label: 'Prospection' },
  { value: 'REFERRAL', label: 'Recommandation ou facilitateur' },
  { value: 'EVENT', label: 'Événement' },
  { value: 'INBOUND', label: 'Demande entrante' },
  { value: 'OTHER', label: 'Autre' },
] as const;

export const sourceLabel = (value: string): string => OPPORTUNITY_SOURCES.find((s) => s.value === value)?.label ?? value;

export const LOSS_REASONS = [
  { value: 'PRICE', label: 'Prix' },
  { value: 'COMPETITOR', label: 'Concurrent retenu' },
  { value: 'NO_BUDGET', label: 'Pas de budget' },
  { value: 'NO_RESPONSE', label: 'Plus de réponse' },
  { value: 'NOT_INTERESTED', label: 'Plus intéressé' },
  { value: 'OTHER', label: 'Autre (à préciser)' },
] as const;

export const lossReasonLabel = (value: string | null): string => LOSS_REASONS.find((r) => r.value === value)?.label ?? value ?? '—';

/** Ce que l'utilisateur saisit pour créer ou modifier une opportunité. */
export interface OpportunityForm {
  companyId: string;
  title: string;
  amount: string;
  currency: string;
  source: string;
}

export type OpportunityField = keyof OpportunityForm;
export type OpportunityErrors = Partial<Record<OpportunityField, string>>;

export const EMPTY_OPPORTUNITY_FORM = (companyId = ''): OpportunityForm => ({ companyId, title: '', amount: '', currency: 'XAF', source: 'PROSPECTING' });

export function formFromOpportunity(o: Opportunity): OpportunityForm {
  return { companyId: o.companyId, title: o.title, amount: o.amount, currency: o.currency, source: o.source };
}

/**
 * Contrôles de saisie rapides, champ par champ (le serveur refait tous les contrôles) : entreprise choisie (à la création),
 * intitulé de 200 caractères au plus, montant positif à deux décimales au plus, devise de trois lettres, source connue.
 */
export function validateOpportunityFields(form: OpportunityForm, context: { needsCompany: boolean }): OpportunityErrors {
  const errors: OpportunityErrors = {};
  if (context.needsCompany && !form.companyId) errors.companyId = 'Choisissez l’entreprise.';
  const title = form.title.trim();
  if (!title) errors.title = 'L’intitulé est obligatoire.';
  else if (title.replace(/\s+/g, ' ').length > 200) errors.title = 'L’intitulé ne peut dépasser 200 caractères.';
  const amount = form.amount.trim().replace(/\s/g, '').replace(',', '.');
  if (!/^\d{1,12}(\.\d{1,2})?$/.test(amount) || Number(amount) <= 0) errors.amount = 'Le montant estimé doit être un nombre positif (deux décimales au plus).';
  const currency = form.currency.trim().toUpperCase();
  if (currency !== '' && currency !== 'FCFA' && !/^[A-Z]{3}$/.test(currency)) errors.currency = 'La devise comporte trois lettres (ex. XAF, EUR).';
  if (!OPPORTUNITY_SOURCES.some((s) => s.value === form.source)) errors.source = 'Choisissez la source.';
  return errors;
}

/** Corps de la création (l'entreprise est incluse) ou de la modification (la version lue, jamais l'entreprise). */
export function buildOpportunityBody(form: OpportunityForm, options: { version?: number } = {}): Record<string, unknown> {
  const body: Record<string, unknown> = { title: form.title.trim(), amount: form.amount.trim(), source: form.source };
  const currency = form.currency.trim();
  if (currency) body.currency = currency;
  if (options.version === undefined) body.companyId = form.companyId;
  else body.version = options.version;
  return body;
}

/** Motif ou justification obligatoire : trois caractères au moins, la limite donnée au plus. */
export function validateRequiredText(text: string, max: number): string | null {
  const t = text.trim();
  if (t.length < 3) return 'Ce champ est obligatoire (3 caractères au moins).';
  if (t.length > max) return `Ce champ ne peut dépasser ${max} caractères.`;
  return null;
}

/** Contrôle du formulaire de clôture « perdue » : motif choisi dans la liste, précision obligatoire pour « autre ». */
export function validateLoss(reason: string, note: string): { reason?: string; note?: string } {
  const errors: { reason?: string; note?: string } = {};
  if (!LOSS_REASONS.some((r) => r.value === reason)) errors.reason = 'Choisissez le motif de la perte.';
  else if (reason === 'OTHER' && note.trim().length < 3) errors.note = 'Précisez le motif « autre » (3 caractères au moins).';
  if (note.length > 500) errors.note = 'La précision ne peut dépasser 500 caractères.';
  return errors;
}

/** Droits de l'utilisateur sur les opportunités, tels que le profil les annonce (le serveur re-contrôle tout). */
export interface OpportunityRights {
  update: boolean;
  advance: boolean;
  override: boolean;
  closeLost: boolean;
  closeWon: boolean;
}

export type OpportunityAction = 'details' | 'edit' | 'advance' | 'waiver' | 'close-lost' | 'close-won';

/** Étape à partir de laquelle une opportunité peut être gagnée, et étape qui exige le rendez-vous décideur. */
export const AGREEMENT_STAGE = 'AGREEMENT_IN_PRINCIPLE';
const stageIndex = (value: string): number => OPPORTUNITY_STAGES.findIndex((s) => s.value === value);

/**
 * Actions proposées pour une opportunité : la fiche toujours ; sur une opportunité OUVERTE seulement, selon les droits : modifier,
 * passer à l'étape suivante, accorder la dérogation (avant l'accord de principe, une seule fois), clore perdue, clore gagnée
 * (une fois l'accord de principe obtenu). Une opportunité clôturée est immuable.
 */
export function opportunityActions(o: Pick<Opportunity, 'status' | 'stage' | 'nextStage' | 'waivedAt'>, rights: OpportunityRights): OpportunityAction[] {
  const actions: OpportunityAction[] = ['details'];
  if (o.status !== 'OPEN') return actions;
  if (rights.update) actions.push('edit');
  if (rights.advance && o.nextStage) actions.push('advance');
  if (rights.override && !o.waivedAt && stageIndex(o.stage) < stageIndex(AGREEMENT_STAGE)) actions.push('waiver');
  if (rights.closeLost) actions.push('close-lost');
  if (rights.closeWon && stageIndex(o.stage) >= stageIndex(AGREEMENT_STAGE)) actions.push('close-won');
  return actions;
}

export const OPPORTUNITY_ACTION_LABEL: Record<OpportunityAction, string> = {
  details: 'Voir la fiche',
  edit: 'Modifier',
  advance: 'Passer à l’étape suivante',
  waiver: 'Accorder une dérogation',
  'close-lost': 'Clore : perdue',
  'close-won': 'Clore : gagnée',
};

/** Libellé de l'action « avancer » avec l'étape visée (alternative au glisser-déposer : « Déplacer vers… »). */
export const advanceLabel = (nextStage: string | null): string => `Déplacer vers « ${stageLabel(nextStage)} »`;

/** Opportunités regroupées par étape, dans l'ordre du pipeline ; l'ordre reçu du serveur est conservé dans chaque colonne. */
export function groupByStage(items: readonly Opportunity[]): { stage: string; label: string; items: Opportunity[] }[] {
  return OPPORTUNITY_STAGES.map((s) => ({ stage: s.value, label: s.label, items: items.filter((o) => o.stage === s.value) }));
}

/** Total des montants (une seule devise à la fois) : « — » si les devises diffèrent. */
export function totalAmount(items: readonly Opportunity[]): { amount: string; currency: string } | null {
  if (items.length === 0) return null;
  const currency = items[0]!.currency;
  if (items.some((o) => o.currency !== currency)) return null;
  const cents = items.reduce((sum, o) => sum + Math.round(Number(o.amount) * 100), 0);
  return { amount: (cents / 100).toFixed(2), currency };
}

/** Filtres rapides sur l'état : un seul actif, chacun traduit en paramètres de requête. */
export const OPPORTUNITY_FILTERS = [
  { value: 'open', label: 'Ouvertes', params: { status: 'OPEN' } },
  { value: 'won', label: 'Gagnées', params: { status: 'WON' } },
  { value: 'lost', label: 'Perdues', params: { status: 'LOST' } },
  { value: 'all', label: 'Toutes', params: {} },
] as const;

export type OpportunityFilter = (typeof OPPORTUNITY_FILTERS)[number]['value'];

/** Paramètres de la liste : taille maximale (le pipeline s'affiche en entier), filtre rapide et recherche. */
export function opportunityListParams(filter: OpportunityFilter, search: string): URLSearchParams {
  const params = new URLSearchParams({ page: '1', pageSize: '200' });
  for (const [key, value] of Object.entries(OPPORTUNITY_FILTERS.find((f) => f.value === filter)?.params ?? {}) as [string, string][]) params.set(key, value);
  if (search.trim()) params.set('search', search.trim());
  return params;
}
