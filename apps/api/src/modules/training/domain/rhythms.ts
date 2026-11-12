/**
 * Rythmes de session : valeurs de référence (D46, à confirmer). Un rythme fixe la durée d'une session de certificat et ses horaires ;
 * la session (S5.2) en choisira un. Le rythme du soir est « en préparation » : il n'est pas encore ouvert aux nouvelles sessions.
 */
export interface Rhythm {
  code: 'DAY' | 'EVENING';
  label: string;
  /** Durée de la session, en semaines. */
  weeks: number;
  /** Jours de cours par semaine (du lundi au vendredi). */
  daysPerWeek: number;
  /** Créneaux d'un jour de cours, « HH:MM-HH:MM ». */
  slots: readonly string[];
  /** Heures de cours par jour. */
  hoursPerDay: number;
  /** Ouvert aux nouvelles sessions ? */
  open: boolean;
}

export const RHYTHMS: readonly Rhythm[] = [
  { code: 'DAY', label: 'Cours du jour', weeks: 1, daysPerWeek: 5, slots: ['09:00-12:00', '13:00-17:00'], hoursPerDay: 7, open: true },
  { code: 'EVENING', label: 'Cours du soir', weeks: 2, daysPerWeek: 5, slots: ['18:00-21:00'], hoursPerDay: 3, open: false },
];

/** Heures de cours d'une session selon son rythme. */
export const totalHours = (rhythm: Rhythm): number => rhythm.weeks * rhythm.daysPerWeek * rhythm.hoursPerDay;
