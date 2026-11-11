import type { Tone } from '../components/data/badge';
import type { LoginEvent } from './types';

/** Texte et teinte d'une ligne de l'historique : réussite, ou échec avec l'étape où il s'est produit (sans motif précis). */
export function describeLoginEvent(event: LoginEvent): { label: string; detail: string; tone: Tone } {
  if (event.result === 'SUCCESS') return { label: 'Connexion réussie', detail: '', tone: 'ok' };
  return {
    label: 'Échec de connexion',
    detail: event.stage === 'SECOND_FACTOR' ? 'Second facteur refusé' : 'Identifiants refusés',
    tone: 'bad',
  };
}

/** Date et heure en français (heure locale de l'utilisateur) ; « — » si la date est illisible. */
export function formatDateTime(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString('fr-FR');
}
