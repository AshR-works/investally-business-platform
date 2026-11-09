import { phoneProblem, cleanPhone } from './phone';

/** Catalogue Investudy (S5.1) : types de lecture, états, règles de saisie (identiques à celles du serveur) et corps des requêtes. */

export type CatalogueStatus = 'ACTIVE' | 'ARCHIVED';

export interface Program {
  id: string;
  name: string;
  description: string | null;
  audience: string | null;
  status: CatalogueStatus;
  /** Nombre de certificats actifs du programme. */
  activeTrainings: number;
  version: number;
  createdAt: string;
}

export interface CourseModule {
  id: string;
  title: string;
  description: string | null;
  /** Pratique sur poste de travail : ne se donne pas dans une salle de cours. */
  requiresWorkstations: boolean;
  status: CatalogueStatus;
  version: number;
  createdAt: string;
}

/** Un certificat (« formation » côté serveur) : formation vendable et planifiable, avec ses modules ordonnés. */
export interface Training {
  id: string;
  programId: string;
  programName: string;
  title: string;
  objectives: string | null;
  prerequisites: string | null;
  pricing: { currency: string; full: string | null; perModule: string | null } | null;
  modules: { id: string; title: string; position: number; status: CatalogueStatus }[];
  status: CatalogueStatus;
  version: number;
  createdAt: string;
}

/** Salle avec postes de travail (salle de marchés) ou salle de cours (places assises). */
export type RoomKind = 'WORKSTATIONS' | 'CLASSROOM';

export interface Room {
  id: string;
  name: string;
  kind: RoomKind;
  learnerSeats: number;
  unavailableSeats: number;
  trainerSeats: number;
  usableSeats: number;
  equipment: string | null;
  status: CatalogueStatus;
  version: number;
  createdAt: string;
}

export interface Trainer {
  id: string;
  lastName: string;
  firstName: string;
  specialties: string | null;
  email: string | null;
  phone: string | null;
  userId: string | null;
  internal: boolean;
  status: CatalogueStatus;
  version: number;
  createdAt: string;
}

/** Rythme de session (valeur de référence, lecture seule). */
export interface Rhythm {
  code: string;
  label: string;
  weeks: number;
  daysPerWeek: number;
  slots: string[];
  hoursPerDay: number;
  open: boolean;
  totalHours: number;
}

export const CATALOGUE_STATUS: Record<CatalogueStatus, { label: string; tone: 'ok' | 'neutral' }> = {
  ACTIVE: { label: 'Actif', tone: 'ok' },
  ARCHIVED: { label: 'Archivé', tone: 'neutral' },
};
export const CATALOGUE_STATUS_OPTIONS = [{ value: 'ACTIVE', label: 'Actifs' }, { value: 'ARCHIVED', label: 'Archivés' }] as const;

/** Rubriques du catalogue, dans l'ordre où elles sont présentées, avec le droit de lecture qui les ouvre (`write` absent = lecture seule). */
export type CatalogueSection = 'programs' | 'trainings' | 'modules' | 'rooms' | 'trainers' | 'rhythms';
export const CATALOGUE_SECTIONS: readonly { id: CatalogueSection; label: string; read: string; write?: string }[] = [
  { id: 'programs', label: 'Programmes', read: 'training.program.read', write: 'training.program.create' },
  { id: 'trainings', label: 'Certificats', read: 'training.training.read', write: 'training.training.create' },
  { id: 'modules', label: 'Modules', read: 'training.training.read', write: 'training.training.create' },
  { id: 'rooms', label: 'Salles', read: 'training.room.read', write: 'training.room.manage' },
  { id: 'trainers', label: 'Formateurs', read: 'training.trainer.read', write: 'training.trainer.manage' },
  { id: 'rhythms', label: 'Rythmes', read: 'training.program.read' },
];

/** Adresse d'une rubrique du catalogue : `/training?rubrique=rooms` (partageable, retour arrière du navigateur). */
export const catalogueHref = (section: CatalogueSection): string => `/training?rubrique=${section}`;

/**
 * Rubrique ouverte selon l'adresse : celle de `?rubrique=` si elle existe ET si l'utilisateur peut la lire, sinon la première rubrique
 * qu'il peut lire (une valeur inconnue ou interdite n'ouvre jamais rien d'autre). `undefined` si aucune n'est lisible.
 */
export function sectionFromQuery<T extends { id: string }>(raw: string | null, allowed: readonly T[]): T | undefined {
  return allowed.find((s) => s.id === raw) ?? allowed[0];
}

/** Le droit qui archive ou réactive un élément de chaque rubrique (D46). */
export const ARCHIVE_PERMISSION: Partial<Record<CatalogueSection, string>> = {
  programs: 'training.program.archive',
  trainings: 'training.training.update',
  modules: 'training.training.update',
  rooms: 'training.room.manage',
  trainers: 'training.trainer.manage',
};
export const UPDATE_PERMISSION: Partial<Record<CatalogueSection, string>> = {
  programs: 'training.program.update',
  trainings: 'training.training.update',
  modules: 'training.training.update',
  rooms: 'training.room.manage',
  trainers: 'training.trainer.manage',
};

export const ARCHIVE_LABEL: Record<Exclude<CatalogueSection, 'rhythms'>, { archive: string; reactivate: string }> = {
  programs: { archive: 'Archiver le programme', reactivate: 'Réactiver le programme' },
  trainings: { archive: 'Archiver le certificat', reactivate: 'Réactiver le certificat' },
  modules: { archive: 'Archiver le module', reactivate: 'Réactiver le module' },
  rooms: { archive: 'Désactiver la salle', reactivate: 'Réactiver la salle' },
  trainers: { archive: 'Désactiver le formateur', reactivate: 'Réactiver le formateur' },
};

export const DEFAULT_CURRENCY = 'XAF';
export const MAX_MODULES_PER_TRAINING = 20;

const groupThousands = (whole: string) => whole.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');

/** Montant décimal du serveur (« 750000.00 ») affiché « 750 000 FCFA » (XAF) ou avec sa devise. */
export function amountText(amount: string | null, currency: string): string {
  if (amount === null) return '—';
  const [whole, cents] = amount.split('.');
  return `${groupThousands(whole!)}${cents && cents !== '00' ? `,${cents}` : ''} ${currency === 'XAF' ? 'FCFA' : currency}`;
}

/** Tarifs d'un certificat : « 750 000 FCFA » et, s'il y en a un, « 125 000 FCFA par module ». */
export function pricingText(pricing: Training['pricing']): string {
  if (!pricing) return '—';
  const parts = [] as string[];
  if (pricing.full !== null) parts.push(amountText(pricing.full, pricing.currency));
  if (pricing.perModule !== null) parts.push(`${amountText(pricing.perModule, pricing.currency)} par module`);
  return parts.join(' ou ');
}

export const ROOM_KIND_LABEL: Record<RoomKind, string> = { WORKSTATIONS: 'Avec postes de travail', CLASSROOM: 'Salle de cours' };
export const ROOM_KIND_OPTIONS = (Object.keys(ROOM_KIND_LABEL) as RoomKind[]).map((value) => ({ value, label: ROOM_KIND_LABEL[value] }));

/** Mot employé pour compter les apprenants : des postes dans une salle équipée, des places dans une salle de cours. */
export const seatWord = (kind: RoomKind): string => (kind === 'CLASSROOM' ? 'places' : 'postes');

/** Places d'une salle : « 13 places utiles (14 postes, 1 hors service) » ; sans panne : « 16 places utiles ». */
export function seatsText(room: Pick<Room, 'kind' | 'learnerSeats' | 'unavailableSeats' | 'usableSeats'>): string {
  return room.unavailableSeats > 0
    ? `${room.usableSeats} places utiles (${room.learnerSeats} ${seatWord(room.kind)}, ${room.unavailableSeats} hors service)`
    : `${room.usableSeats} places utiles`;
}

/** Durée d'un rythme : « 1 semaine », « 2 semaines ». */
export const weeksText = (weeks: number): string => `${weeks} semaine${weeks > 1 ? 's' : ''}`;

/** Créneaux d'un jour de cours : « 09:00-12:00, 13:00-17:00 » écrit « 9h–12h, 13h–17h ». */
export const slotsText = (slots: readonly string[]): string =>
  slots.map((s) => s.split('-').map((hhmm) => `${Number(hhmm.slice(0, 2))}h${hhmm.slice(3) === '00' ? '' : hhmm.slice(3)}`).join('–')).join(', ');

const text = (value: string) => value.trim();
const amountInput = (value: string) => text(value).replace(/\s/g, '').replace(',', '.');
const validAmount = (value: string) => /^\d{1,10}(\.\d{1,2})?$/.test(value) && Number(value) > 0;

// ───────────────────────────── Saisies ─────────────────────────────

export interface ProgramForm { name: string; description: string; audience: string }
export const EMPTY_PROGRAM_FORM = (): ProgramForm => ({ name: '', description: '', audience: '' });
export const formFromProgram = (p: Program): ProgramForm => ({ name: p.name, description: p.description ?? '', audience: p.audience ?? '' });
export function validateProgram(form: ProgramForm): Partial<Record<keyof ProgramForm, string>> {
  const errors: Partial<Record<keyof ProgramForm, string>> = {};
  if (!text(form.name)) errors.name = 'Le nom du programme est obligatoire.';
  else if (text(form.name).length > 150) errors.name = 'Le nom ne peut dépasser 150 caractères.';
  if (text(form.description).length > 2000) errors.description = 'La description ne peut dépasser 2000 caractères.';
  if (text(form.audience).length > 500) errors.audience = 'Le public visé ne peut dépasser 500 caractères.';
  return errors;
}
export const programBody = (form: ProgramForm, version?: number) => ({ ...(version ? { version } : {}), name: text(form.name), description: text(form.description), audience: text(form.audience) });

export interface ModuleForm { title: string; description: string; requiresWorkstations: boolean }
export const EMPTY_MODULE_FORM = (): ModuleForm => ({ title: '', description: '', requiresWorkstations: false });
export const formFromModule = (m: CourseModule): ModuleForm => ({ title: m.title, description: m.description ?? '', requiresWorkstations: m.requiresWorkstations });
export function validateModule(form: ModuleForm): Partial<Record<'title' | 'description', string>> {
  const errors: Partial<Record<'title' | 'description', string>> = {};
  if (!text(form.title)) errors.title = 'Le titre du module est obligatoire.';
  else if (text(form.title).length > 150) errors.title = 'Le titre ne peut dépasser 150 caractères.';
  if (text(form.description).length > 1000) errors.description = 'La description ne peut dépasser 1000 caractères.';
  return errors;
}
export const moduleBody = (form: ModuleForm, version?: number) => ({ ...(version ? { version } : {}), title: text(form.title), description: text(form.description), requiresWorkstations: form.requiresWorkstations });

/** Saisie d'un certificat : `moduleIds` est la liste ORDONNÉE des modules retenus. */
export interface TrainingForm {
  programId: string; title: string; objectives: string; prerequisites: string; priceAmount: string; modulePriceAmount: string; priceCurrency: string; moduleIds: string[];
}
export const EMPTY_TRAINING_FORM = (programId = ''): TrainingForm => ({
  programId, title: '', objectives: '', prerequisites: '', priceAmount: '', modulePriceAmount: '', priceCurrency: DEFAULT_CURRENCY, moduleIds: [],
});
export const formFromTraining = (t: Training): TrainingForm => ({
  programId: t.programId, title: t.title, objectives: t.objectives ?? '', prerequisites: t.prerequisites ?? '',
  priceAmount: t.pricing?.full ?? '', modulePriceAmount: t.pricing?.perModule ?? '', priceCurrency: t.pricing?.currency ?? DEFAULT_CURRENCY,
  moduleIds: t.modules.map((m) => m.id),
});
export function validateTraining(form: TrainingForm, options: { creating: boolean }): Partial<Record<Exclude<keyof TrainingForm, 'moduleIds'>, string>> {
  const errors: Partial<Record<Exclude<keyof TrainingForm, 'moduleIds'>, string>> = {};
  if (options.creating && !form.programId) errors.programId = 'Choisissez le programme.';
  if (!text(form.title)) errors.title = 'Le titre du certificat est obligatoire.';
  else if (text(form.title).length > 150) errors.title = 'Le titre ne peut dépasser 150 caractères.';
  if (text(form.objectives).length > 2000) errors.objectives = 'Les objectifs ne peuvent dépasser 2000 caractères.';
  if (text(form.prerequisites).length > 1000) errors.prerequisites = 'Les prérequis ne peuvent dépasser 1000 caractères.';
  const full = amountInput(form.priceAmount);
  const perModule = amountInput(form.modulePriceAmount);
  if (full && !validAmount(full)) errors.priceAmount = 'Le prix complet doit être un montant positif (deux décimales au plus).';
  if (perModule && !validAmount(perModule)) errors.modulePriceAmount = 'Le prix par module doit être un montant positif (deux décimales au plus).';
  if ((full || perModule) && !/^[A-Za-z]{3}$/.test(text(form.priceCurrency))) errors.priceCurrency = 'La devise comporte trois lettres (ex. XAF).';
  return errors;
}
export function trainingBody(form: TrainingForm, version?: number) {
  const full = amountInput(form.priceAmount);
  const perModule = amountInput(form.modulePriceAmount);
  const prices = full || perModule
    ? { priceAmount: full || (version ? null : undefined), modulePriceAmount: perModule || (version ? null : undefined), priceCurrency: text(form.priceCurrency).toUpperCase() }
    // À la modification, des prix vidés sont retirés (`null`) ; à la création, ils sont simplement absents.
    : version ? { priceAmount: null, modulePriceAmount: null } : {};
  return {
    ...(version ? { version } : { programId: form.programId }),
    title: text(form.title), objectives: text(form.objectives), prerequisites: text(form.prerequisites), moduleIds: form.moduleIds, ...prices,
  };
}

/** Déplace le module d'un cran (`-1` vers le haut, `1` vers le bas) ; hors limites, la liste est rendue telle quelle. */
export function moveModule(ids: readonly string[], index: number, step: -1 | 1): string[] {
  const target = index + step;
  if (index < 0 || index >= ids.length || target < 0 || target >= ids.length) return [...ids];
  const next = [...ids];
  [next[index], next[target]] = [next[target]!, next[index]!];
  return next;
}

export interface RoomForm { name: string; kind: RoomKind; learnerSeats: string; unavailableSeats: string; trainerSeats: string; equipment: string }
export const EMPTY_ROOM_FORM = (): RoomForm => ({ name: '', kind: 'WORKSTATIONS', learnerSeats: '', unavailableSeats: '0', trainerSeats: '1', equipment: '' });
export const formFromRoom = (r: Room): RoomForm => ({
  name: r.name, kind: r.kind, learnerSeats: String(r.learnerSeats), unavailableSeats: String(r.unavailableSeats), trainerSeats: String(r.trainerSeats), equipment: r.equipment ?? '',
});
const wholeIn = (value: string, min: number, max: number) => {
  const n = Number(text(value));
  return text(value) !== '' && Number.isInteger(n) && n >= min && n <= max;
};
export function validateRoom(form: RoomForm): Partial<Record<Exclude<keyof RoomForm, 'kind'>, string>> {
  const errors: Partial<Record<Exclude<keyof RoomForm, 'kind'>, string>> = {};
  if (!text(form.name)) errors.name = 'Le nom de la salle est obligatoire.';
  else if (text(form.name).length > 100) errors.name = 'Le nom ne peut dépasser 100 caractères.';
  if (!wholeIn(form.learnerSeats, 1, 1000)) errors.learnerSeats = 'Les postes apprenants doivent être un nombre entier entre 1 et 1000.';
  if (!wholeIn(form.unavailableSeats, 0, 1000)) errors.unavailableSeats = 'Les postes hors service doivent être un nombre entier positif ou nul.';
  else if (!errors.learnerSeats && Number(form.unavailableSeats) > Number(form.learnerSeats)) errors.unavailableSeats = 'Les postes hors service ne peuvent pas dépasser les postes apprenants.';
  if (!wholeIn(form.trainerSeats, 0, 10)) errors.trainerSeats = 'Les postes formateur doivent être un nombre entier entre 0 et 10.';
  if (text(form.equipment).length > 1000) errors.equipment = 'Les équipements ne peuvent dépasser 1000 caractères.';
  return errors;
}
export const roomBody = (form: RoomForm, version?: number) => ({
  ...(version ? { version } : {}), name: text(form.name), kind: form.kind, learnerSeats: Number(text(form.learnerSeats)), unavailableSeats: Number(text(form.unavailableSeats)),
  trainerSeats: Number(text(form.trainerSeats)), equipment: text(form.equipment),
});

export interface TrainerForm { lastName: string; firstName: string; specialties: string; email: string; phone: string }
export const EMPTY_TRAINER_FORM = (): TrainerForm => ({ lastName: '', firstName: '', specialties: '', email: '', phone: '' });
export const formFromTrainer = (t: Trainer): TrainerForm => ({ lastName: t.lastName, firstName: t.firstName, specialties: t.specialties ?? '', email: t.email ?? '', phone: t.phone ?? '' });
export function validateTrainer(form: TrainerForm): Partial<Record<keyof TrainerForm, string>> {
  const errors: Partial<Record<keyof TrainerForm, string>> = {};
  if (!text(form.lastName)) errors.lastName = 'Le nom est obligatoire.';
  else if (text(form.lastName).length > 100) errors.lastName = 'Le nom ne peut dépasser 100 caractères.';
  if (!text(form.firstName)) errors.firstName = 'Le prénom est obligatoire.';
  else if (text(form.firstName).length > 100) errors.firstName = 'Le prénom ne peut dépasser 100 caractères.';
  if (text(form.specialties).length > 500) errors.specialties = 'Les spécialités ne peuvent dépasser 500 caractères.';
  if (text(form.email) && (text(form.email).length > 200 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text(form.email)))) errors.email = 'L’adresse e-mail n’est pas valide.';
  if (text(form.phone)) {
    const problem = phoneProblem(form.phone);
    if (problem) errors.phone = problem;
  }
  return errors;
}
export const trainerBody = (form: TrainerForm, version?: number) => ({
  ...(version ? { version } : {}), lastName: text(form.lastName), firstName: text(form.firstName), specialties: text(form.specialties), email: text(form.email),
  phone: text(form.phone) ? cleanPhone(form.phone) : '',
});
