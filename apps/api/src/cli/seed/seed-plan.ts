/**
 * Plan du jeu de données de démonstration : une liste d'événements datés, construite sans accès à la base (donc testable seule).
 * Les données sont ENTIÈREMENT FICTIVES : noms d'entreprises et de personnes inventés, e-mails en `.test`, numéros de téléphone du
 * motif réservé « deux zéros avant les quatre derniers chiffres ». Le plan est déterministe : mêmes entrées, mêmes événements ; les dates sont
 * relatives à `anchor` (aujourd'hui), pour que retards, échéances et graphiques restent parlants.
 */

/** Qui exécute l'événement : un chargé de compte, le Responsable commercial ou la Finance (chacun avec ses droits et sa portée). */
export type Who = 'compte1' | 'compte2' | 'compte3' | 'commercial' | 'finance' | 'investudy' | 'rh';

export type SeedOp =
  | { k: 'company'; key: string; name: string; sector: string; country: string; email: string; phone: string; facilitator?: { key: string; lastName: string; firstName: string; phone: string; comment: string; contactMethod: string; isCompanyEmployee: boolean } }
  | { k: 'companyFacilitator'; key: string; facilitatorKey: string; contactMethod: string; isCompanyEmployee: boolean }
  | { k: 'commission'; company: string; type: 'FIXED' | 'PERCENT'; value: string; currency?: string }
  | { k: 'companyStatus'; company: string; status: 'CONTACTED' | 'QUALIFIED' }
  | { k: 'contact'; key: string; company: string; lastName: string; firstName: string; role: string; email: string; phone: string }
  | { k: 'offer'; key: string; company: string; subject: string; amount: string; currency: string; note?: string }
  | { k: 'offerAction'; offer: string; action: 'submit' | 'accept' | 'refuse' | 'withdraw'; reason?: string }
  | { k: 'receipt'; offer: string; receivedBy: string }
  | { k: 'receiptCancel'; offer: string; reason: string }
  | { k: 'followupPlan'; key: string; offer: string; dueOn: string; channel: string; note: string }
  | { k: 'followupClose'; followup: string; closing: 'complete' | 'cancel'; text: string }
  | { k: 'appointment'; key: string; company: string; contact?: string; opportunity?: string; type: 'FINANCE_DIRECTOR' | 'DECISION_MAKER' | 'VISIT'; startsAt: string; durationMinutes: number; location: string; note: string }
  | { k: 'appointmentTransition'; appointment: string; transition: 'hold' | 'cancel' | 'postpone'; text: string; startsAt?: string }
  | { k: 'opportunity'; key: string; company: string; title: string; amount: string; currency: string; source: string }
  | { k: 'advance'; opportunity: string }
  | { k: 'waiver'; opportunity: string; reason: string }
  | { k: 'close'; opportunity: string; outcome: 'lost' | 'won'; reason?: string; note?: string }
  | { k: 'approval'; key: string; opportunity: string; amount?: string; places?: number; currency: string; requested?: boolean; receivedOn?: string; validUntil?: string; payerName?: string; payerType?: string }
  | { k: 'approvalReceive'; approval: string; receivedOn: string }
  | { k: 'approvalClose'; approval: string; action: 'honor' | 'expire' | 'cancel'; reason?: string }
  | { k: 'reassign'; company: string; to: Who }
  | { k: 'payout'; approval: string; action: 'release' | 'hold' | 'cancel'; reason?: string }
  | { k: 'ambassadorUpdate'; ambassador: string; note: string }
  | { k: 'trainer'; key: string; lastName: string; firstName: string; specialties: string; email: string; phone: string }
  | { k: 'program'; key: string; name: string; audience: string; description: string }
  | { k: 'module'; key: string; title: string; requiresWorkstations: boolean }
  | { k: 'training'; key: string; program: string; title: string; objectives: string; priceAmount: string; modulePriceAmount: string; modules: string[] }
  | { k: 'room'; key: string; name: string; kind: 'WORKSTATIONS' | 'CLASSROOM'; learnerSeats: number; unavailableSeats: number; trainerSeats: number; equipment: string }
  | { k: 'session'; key: string; training: string; room: string; trainer: string; startDate: string; capacity: number }
  | { k: 'individual'; key: string; kind: 'STUDENT' | 'INDIVIDUAL'; lastName: string; firstName: string; email: string; phone: string }
  | { k: 'enrollIndividual'; key: string; learner: string; session: string; payer: { kind: 'SELF' } | { kind: 'THIRD_PARTY'; name: string; type: 'EMPLOYER' | 'ORGANISM' | 'LANDLORD' | 'FAMILY' } }
  | { k: 'individualConfirm'; enrollment: string }
  | { k: 'learner'; key: string; company: string; lastName: string; firstName: string; email: string; phone: string }
  | { k: 'enroll'; key: string; learner: string; session: string }
  | { k: 'enrollConfirm'; enrollment: string }
  | { k: 'enrollCancel'; enrollment: string; reason: string }
  | { k: 'enrollReplace'; enrollment: string; session: string }
  | { k: 'sessionOpen'; session: string }
  | { k: 'sessionPostpone'; session: string; startDate: string; reason: string }
  | { k: 'sessionCancel'; session: string; reason: string }
  | { k: 'employee'; key: string; matricule: string; lastName: string; firstName: string; jobTitle: string; department: string; manager?: string; account?: Who; workEmail: string; workPhone: string; hiredOn: string }
  | { k: 'employeeLeave'; employee: string; leftOn: string; reason: string }
  | { k: 'leave'; key: string; employee: string; typeCode: string; start: string; end: string; startHalf?: boolean; endHalf?: boolean; note: string }
  | { k: 'leaveDecision'; leave: string; decision: 'APPROVE' | 'REJECT'; note?: string }
  | { k: 'ambassador'; key: string; lastName: string; firstName: string; origin: 'CLIENT' | 'LEARNER'; company?: string; email: string; phone: string; appointedOn: string; note: string };

export interface SeedEvent {
  at: Date;
  who: Who;
  op: SeedOp;
}

const DAY = 86_400_000;
const isoDay = (d: Date) => d.toISOString().slice(0, 10);

/** Générateur pseudo-aléatoire à graine fixe (mulberry32) : le plan ne dépend d'aucune source d'aléa extérieure. */
export function seededRandom(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const COUNTRY = {
  Cameroun: { cc: '237', prefix: '69', tld: 'cm' },
  "Côte d'Ivoire": { cc: '225', prefix: '07', tld: 'ci' },
  Sénégal: { cc: '221', prefix: '77', tld: 'sn' },
  Gabon: { cc: '241', prefix: '06', tld: 'ga' },
  RDC: { cc: '243', prefix: '81', tld: 'cd' },
} as const;
type CountryName = keyof typeof COUNTRY;

/** Numéro fictif valide : « +indicatif préfixe 00 nnnn » (le motif « 00 » avant les quatre derniers chiffres signale un numéro de démonstration). */
export function demoPhone(country: CountryName, n: number): string {
  const c = COUNTRY[country];
  return `+${c.cc} ${c.prefix}00${String(n % 10000).padStart(4, '0')}`;
}
/** Vrai si le numéro suit le motif fictif de démonstration. */
export const isDemoPhone = (phone: string): boolean => /^\+\d{3} \d{2}00\d{4}$/.test(phone);

interface CompanySeed { name: string; sector: string; country: CountryName }

/** Quarante entreprises fictives, tous secteurs demandés ; les noms sont inventés (toute ressemblance serait fortuite). */
export const COMPANIES: readonly CompanySeed[] = [
  { name: 'Banque du Wouri Capital', sector: 'Banque', country: 'Cameroun' },
  { name: 'Crédit Savane Afrique', sector: 'Banque', country: "Côte d'Ivoire" },
  { name: 'Banque Teranga Capital', sector: 'Banque', country: 'Sénégal' },
  { name: 'Banque Équateur Libreville', sector: 'Banque', country: 'Gabon' },
  { name: 'Banque Kasaï Développement', sector: 'Banque', country: 'RDC' },
  { name: 'Microfinance Fako Solidaire', sector: 'Microfinance', country: 'Cameroun' },
  { name: 'Sahel Fintech Pay', sector: 'Fintech', country: 'Sénégal' },
  { name: 'Mboa Mobile Wallet', sector: 'Fintech', country: 'Cameroun' },
  { name: 'Lagune Paiements Digitaux', sector: 'Fintech', country: "Côte d'Ivoire" },
  { name: 'Kivu Pay Digital', sector: 'Fintech', country: 'RDC' },
  { name: 'Ogooué Digital Pay', sector: 'Fintech', country: 'Gabon' },
  { name: 'Assurances Mont-Cameroun', sector: 'Assurance', country: 'Cameroun' },
  { name: 'Sécurité Lagune Assurances', sector: 'Assurance', country: "Côte d'Ivoire" },
  { name: 'Assurances Casamance Vie', sector: 'Assurance', country: 'Sénégal' },
  { name: 'Assurances Équateur Santé', sector: 'Assurance', country: 'Gabon' },
  { name: 'Mutuelle Kasaï Prévoyance', sector: 'Assurance', country: 'RDC' },
  { name: 'Kivu Patrimoine et Gestion', sector: 'Gestion de patrimoine', country: 'RDC' },
  { name: 'Douala Gestion Privée', sector: 'Gestion de patrimoine', country: 'Cameroun' },
  { name: 'Abidjan Patrimoine Conseil', sector: 'Gestion de patrimoine', country: "Côte d'Ivoire" },
  { name: 'Dakar Capital Gestion', sector: 'Gestion de patrimoine', country: 'Sénégal' },
  { name: "Courtage Boursier de l'Équateur", sector: 'Société de bourse', country: 'Gabon' },
  { name: 'Bourse Conseil du Littoral', sector: 'Société de bourse', country: 'Cameroun' },
  { name: 'Société de Bourse Lagune', sector: 'Société de bourse', country: "Côte d'Ivoire" },
  { name: 'Titres Sahel Courtage', sector: 'Société de bourse', country: 'Sénégal' },
  { name: 'Télécom Delta Afrique', sector: 'Télécoms', country: "Côte d'Ivoire" },
  { name: 'Mboa Télécom Services', sector: 'Télécoms', country: 'Cameroun' },
  { name: 'Sahel Mobile Réseaux', sector: 'Télécoms', country: 'Sénégal' },
  { name: 'Fibre Kasaï Télécom', sector: 'Télécoms', country: 'RDC' },
  { name: 'Fonderies Littoral Industrie', sector: 'Industrie', country: 'Cameroun' },
  { name: 'Cimenterie Mayo Nord', sector: 'Industrie', country: 'Cameroun' },
  { name: 'Agro-Industries Cacao Lagune', sector: 'Industrie', country: "Côte d'Ivoire" },
  { name: 'Brasseries du Fleuve', sector: 'Industrie', country: 'RDC' },
  { name: 'Scierie Ogooué Bois', sector: 'Industrie', country: 'Gabon' },
  { name: 'Groupe Équateur Énergie', sector: 'Énergie', country: 'Gabon' },
  { name: 'Énergie Mono Solaire', sector: 'Énergie', country: 'Cameroun' },
  { name: 'Cabinet Savane Conseil', sector: 'Services (PME)', country: "Côte d'Ivoire" },
  { name: 'Imprimerie Wouri Express', sector: 'Services (PME)', country: 'Cameroun' },
  { name: 'Transport Teranga Logistique', sector: 'Distribution (PME)', country: 'Sénégal' },
  { name: 'Pharmacie Moungo Santé', sector: 'Santé (PME)', country: 'Cameroun' },
  { name: 'Comptoir Libreville Distribution', sector: 'Distribution (PME)', country: 'Gabon' },
];

const FIRST = ['Aïcha', 'Alain', 'Brice', 'Carine', 'Désiré', 'Estelle', 'Fatou', 'Gaëlle', 'Hervé', 'Ibrahim', 'Jean-Claude', 'Kader', 'Laurette', 'Mamadou', 'Nadège', 'Olivier', 'Pascal', 'Rosine', 'Thierry', 'Yacine', 'Zita', 'Boubacar', 'Awa', 'Cheikh', 'Ndèye', 'Moussa', 'Félicité', 'Landry', 'Prisca', 'Rodrigue'];
const LAST = ['Fotso', 'Mbarga', 'Nkomo', 'Tchamba', 'Njoya', 'Kamga', 'Essomba', 'Ndiaye', 'Sow', 'Traoré', 'Koné', 'Kouassi', 'Bamba', 'Ondo', 'Obiang', 'Nzamba', 'Mukendi', 'Tshimanga', 'Ngoma', 'Kasongo', 'Mbuyi', 'Sarr', 'Fall', 'Diallo', 'Ouattara', 'Nguema', 'Mintsa', 'Tagne', 'Ekambi', 'Bilong'];
const SUBJECTS = [
  'Formation Marchés financiers et produits dérivés', 'Programme Gestion de patrimoine', 'Conformité LCB-FT et contrôle interne',
  'Certification analyste financier', 'Fintech et paiements mobiles', 'Atelier Gouvernance des risques', 'Formation Assurance et prévoyance',
  'Introduction à la bourse régionale', 'Audit interne et conformité bancaire', 'Séminaire Investissement et épargne longue',
];
const SOURCES = ['PROSPECTING', 'REFERRAL', 'EVENT', 'INBOUND', 'OTHER'];
const LOSS = ['PRICE', 'COMPETITOR', 'NO_BUDGET', 'NO_RESPONSE', 'NOT_INTERESTED'];
const CHANNELS = ['CALL', 'EMAIL', 'WHATSAPP', 'MEETING'];
const PAYERS: readonly [string, string][] = [['Groupe Meridien Holding', 'EMPLOYER'], ['Fonds Régional de Formation', 'ORGANISM'], ['SCI Les Lagunes', 'LANDLORD']];
const OWNERS: readonly Who[] = ['compte1', 'compte2', 'compte3'];

const slug = (text: string) => text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

/**
 * Catalogue de démonstration, repris du catalogue public d'Investudy : cinq certificats « Marchés financiers » bâtis sur sept modules partagés
 * (un même module revient dans plusieurs certificats, dans un ordre qui varie), avec un prix complet et un prix par module. Aucune donnée personnelle.
 */
const MODULE_TITLES: readonly [string, string][] = [
  ['m1', 'Fondations Économiques & Architecture de la Place Financière'],
  ['m2', 'Ingénierie des Instruments Financiers, Données & Acteurs de Marché'],
  ['m3', 'Asset Management, Construction & Évaluation de Portefeuille'],
  ['m4', 'Pratique du Trading, Décision d’Investissement & Analyse Quantitative'],
  ['m5', 'Ingénierie Financière, IPO & Levées de Fonds en Zone CEMAC'],
  ['m6', 'Réglementation des Marchés Financiers en Zone CEMAC & Pouvoirs de la COSUMAF'],
  ['m7', 'Portfolio Engineering, Asset Allocation & Live Trading (Capstone Project)'],
];
const CERTIFICATES: readonly { key: string; title: string; objectives: string; price: string; perModule: string; modules: string[] }[] = [
  { key: 'expert', title: 'Certificat Expert(e) Marchés financiers', objectives: 'Le parcours complet pour maîtriser l’ensemble de la chaîne de valeur des marchés de capitaux.', price: '750000', perModule: '125000', modules: ['m1', 'm2', 'm3', 'm4', 'm5', 'm6', 'm7'] },
  { key: 'etudiants', title: 'Certificat Marchés financiers Étudiants', objectives: 'Le tremplin idéal pour acquérir les compétences techniques indispensables et réussir son insertion professionnelle.', price: '250000', perModule: '75000', modules: ['m1', 'm2', 'm3', 'm4', 'm6'] },
  { key: 'dirigeants', title: 'Certificat Marchés financiers Dirigeants & cadres d’entreprise', objectives: 'Conçu pour les décideurs souhaitant optimiser la gestion de leur trésorerie et actionner les leviers du marché de capitaux.', price: '500000', perModule: '125000', modules: ['m1', 'm2', 'm4', 'm6', 'm5'] },
  { key: 'avocats', title: 'Certificat Marchés financiers Avocats & métiers du droit', objectives: 'Une formation axée sur la structuration juridique des opérations de marché et la conformité.', price: '500000', perModule: '125000', modules: ['m1', 'm2', 'm6', 'm5'] },
  { key: 'banque', title: 'Certificat Marchés financiers Banque, assurance & microfinance', objectives: 'Un parcours orienté vers les professionnels du secteur financier et institutionnel.', price: '500000', perModule: '125000', modules: ['m1', 'm2', 'm3', 'm6', 'm5'] },
];
const CATALOGUE: SeedOp[] = [
  { k: 'program', key: 'programme-marches', name: 'Certificats Marchés financiers', audience: 'Étudiants, dirigeants et cadres, juristes, professionnels de la banque, de l’assurance et de la microfinance', description: 'Parcours certifiants sur les marchés de capitaux et leur réglementation en zone CEMAC.' },
  // Les modules de pratique sur poste (trading, live trading) exigent la salle de marchés ; les autres sont magistraux.
  ...MODULE_TITLES.map(([key, title]): SeedOp => ({ k: 'module', key, title, requiresWorkstations: key === 'm4' || key === 'm7' })),
  ...CERTIFICATES.map((c): SeedOp => ({ k: 'training', key: c.key, program: 'programme-marches', title: c.title, objectives: c.objectives, priceAmount: c.price, modulePriceAmount: c.perModule, modules: c.modules })),
  { k: 'room', key: 'salle-marches', name: 'Salle de marchés', kind: 'WORKSTATIONS', learnerSeats: 14, unavailableSeats: 1, trainerSeats: 1, equipment: 'Salle de marchés : 14 postes apprenants (dont 1 en panne) et 1 poste formateur.' },
  { k: 'room', key: 'salle-reunion', name: 'Salle de réunion', kind: 'CLASSROOM', learnerSeats: 16, unavailableSeats: 0, trainerSeats: 0, equipment: 'Écran 65 pouces (pas de vidéoprojecteur).' },
];

/**
 * Formateurs de démonstration : cinq formateurs **externes** (sans compte, comme les formateurs réels d'Investudy), chacun spécialisé dans
 * un sujet des modules. Noms inventés, e-mails en `.test`, téléphones du motif réservé.
 */
const TRAINERS: readonly [string, string, string, string, 'Cameroun' | "Côte d'Ivoire" | 'Sénégal' | 'Gabon' | 'RDC'][] = [
  ['Nkoulou', 'Aïcha', 'Réglementation des marchés financiers en zone CEMAC, pouvoirs de la COSUMAF', 'aicha.nkoulou', 'Cameroun'],
  ['Essomba', 'Parfait', 'Pratique du trading et analyse quantitative', 'parfait.essomba', 'Cameroun'],
  ['Mbassi', 'Colette', 'Asset management, construction et évaluation de portefeuille', 'colette.mbassi', 'Gabon'],
  ['Sidibé', 'Adama', 'Ingénierie financière, introductions en bourse et levées de fonds', 'adama.sidibe', "Côte d'Ivoire"],
  ['Ewané', 'Landry', 'Fondations économiques et architecture de la place financière', 'landry.ewane', 'Sénégal'],
];
const FORMATEURS: SeedOp[] = TRAINERS.map(([lastName, firstName, specialties, local, country], index): SeedOp => ({
  k: 'trainer', key: `formateur-${index + 1}`, lastName, firstName, specialties, email: `${local}@formateurs.investudy.test`, phone: demoPhone(country, 4200 + index),
}));

/** Les blocs du jeu : chacun se charge seul sur une démo existante (marqueur propre), dans l'ordre des dépendances. */
export type SeedBlock = 'crm' | 'catalogue' | 'formateurs' | 'sessions' | 'inscriptions' | 'rh' | 'conges' | 'particuliers';
export const SEED_BLOCKS: readonly SeedBlock[] = ['crm', 'catalogue', 'formateurs', 'sessions', 'inscriptions', 'rh', 'conges', 'particuliers'];
/** Entreprises clientes de formation du bloc « inscriptions » : la première sert de repère au chargement par blocs. */
export const FORMATION_CLIENTS: readonly [string, 'Cameroun' | "Côte d'Ivoire" | 'Sénégal' | 'Gabon' | 'RDC'][] = [
  ['Académie Wouri Finance', 'Cameroun'], ['Cabinet Libreville Conseil', 'Gabon'], ['Institut Dakar Marchés', 'Sénégal'], ['Groupe Abidjan Capital', "Côte d'Ivoire"], ['Fonds Kinshasa Épargne', 'RDC'],
];
/** Les entreprises clientes de formation du bloc « inscriptions » (avec leur opportunité et leur agrément) portent cette racine de clé. */
export const FORMATION_CLIENT = 'client-formation-';
/** Domaine (fictif, réservé) des e-mails professionnels du personnel de démonstration : repère le bloc « rh ». */
export const RH_EMAIL_DOMAIN = '@staff.investally.test';
/** Domaine (fictif, réservé) des e-mails des étudiants et particuliers de démonstration : repère le bloc « particuliers ». */
export const INDIVIDUALS_EMAIL_DOMAIN = '@particuliers.test';
const isFormationClient = (key: string | undefined): boolean => key?.startsWith(FORMATION_CLIENT) ?? false;
export function blockOf(op: SeedOp): SeedBlock {
  if ((op.k === 'company' || op.k === 'opportunity' || op.k === 'approval') && isFormationClient(op.key)) return 'inscriptions';
  if ((op.k === 'advance' || op.k === 'waiver') && isFormationClient(op.opportunity)) return 'inscriptions';
  if (op.k === 'program' || op.k === 'module' || op.k === 'training' || op.k === 'room') return 'catalogue';
  if (op.k === 'trainer') return 'formateurs';
  if (op.k === 'employee' || op.k === 'employeeLeave') return 'rh';
  if (op.k === 'leave' || op.k === 'leaveDecision') return 'conges';
  if (op.k === 'individual' || op.k === 'enrollIndividual' || op.k === 'individualConfirm') return 'particuliers';
  if (op.k === 'learner' || op.k === 'enroll' || op.k === 'enrollConfirm' || op.k === 'enrollCancel' || op.k === 'enrollReplace') return 'inscriptions';
  if (op.k === 'session' || op.k === 'sessionOpen' || op.k === 'sessionPostpone' || op.k === 'sessionCancel') return 'sessions';
  return 'crm';
}

export interface PlanOptions {
  anchor: Date;
  seed?: number;
}

/**
 * Construit le plan : chaque entreprise vit une petite histoire commerciale (dix scénarios en rotation, des plus simples aux plus
 * avancées) répartie sur douze mois. Un événement qui tomberait après `anchor` est omis : la base ne contient rien « dans le futur »,
 * sauf les rendez-vous et relances planifiés à l'avance (leur échéance est future, leur planification passée).
 */
export function buildPlan({ anchor, seed = 2026 }: PlanOptions): SeedEvent[] {
  const rnd = seededRandom(seed);
  const pick = <T,>(items: readonly T[]): T => items[Math.floor(rnd() * items.length)]!;
  const events: SeedEvent[] = [];
  const day0 = new Date(Date.UTC(anchor.getUTCFullYear(), anchor.getUTCMonth(), anchor.getUTCDate()));
  let phoneCounter = 100;
  let facilitatorCount = 0;
  const facilitators: { key: string; owner: Who }[] = [];
  // Dernière activité de chaque entreprise (pour ne la réattribuer qu'après) et propriétaire de départ.
  const lastAt = new Map<string, number>();
  const ownerOf = new Map<string, Who>();
  const companyOfOffer = new Map<string, string>();
  const track = (companyKey: string, when: Date) => lastAt.set(companyKey, Math.max(lastAt.get(companyKey) ?? 0, when.getTime()));

  COMPANIES.forEach((company, i) => {
    const owner = OWNERS[i % OWNERS.length]!;
    const key = slug(company.name);
    const t0 = day0.getTime() - (345 - i * 8) * DAY;
    const hosts = COUNTRY[company.country];
    const at = (offsetDays: number, hour = 9): Date => new Date(t0 + offsetDays * DAY + hour * 3_600_000);
    const phone = () => demoPhone(company.country, ++phoneCounter);
    const emailFor = (first: string, last: string) => `${slug(first)}.${slug(last)}@${key}.test`;
    const person = () => [pick(FIRST), pick(LAST)] as const;
    // Ajoute un événement s'il n'est pas dans le futur ; retourne vrai s'il a été ajouté (les suites en dépendent).
    const add = (offsetDays: number, who: Who, op: SeedOp, hour = 9): boolean => {
      const when = at(offsetDays, hour);
      if (when.getTime() > anchor.getTime()) return false;
      events.push({ at: when, who, op });
      track(key, when);
      if (op.k === 'offer') companyOfOffer.set(op.key, key);
      return true;
    };
    const inDays = (offsetDays: number, hour = 9) => at(offsetDays, hour).toISOString();
    const dayOf = (offsetDays: number) => isoDay(at(offsetDays));
    const scenario = i % 10;
    ownerOf.set(key, owner);

    // L'entreprise, son éventuel facilitateur (une entreprise sur cinq) et ses contacts.
    let facilitator: Extract<SeedOp, { k: 'company' }>['facilitator'];
    let reuseFacilitator: string | undefined;
    if (i % 5 === 2 || i % 10 === 6) {
      const existing = facilitators.find((f) => f.owner === owner);
      if (existing && i > 12) reuseFacilitator = existing.key;
      else {
        facilitatorCount += 1;
        const [fFirst, fLast] = person();
        const fKey = `facilitateur-${facilitatorCount}`;
        facilitators.push({ key: fKey, owner });
        facilitator = { key: fKey, lastName: fLast, firstName: fFirst, phone: phone(), comment: 'Ancien collègue de la direction financière', contactMethod: pick(['WHATSAPP_MESSAGE', 'PHONE_CALL', 'EMAIL']), isCompanyEmployee: i % 2 === 0 };
      }
    }
    if (!add(0, owner, { k: 'company', key, name: company.name, sector: company.sector, country: company.country, email: `contact@${key}.${hosts.tld}.test`, phone: phone(), facilitator })) return;
    if (reuseFacilitator) add(0, owner, { k: 'companyFacilitator', key, facilitatorKey: reuseFacilitator, contactMethod: 'PHONE_CALL', isCompanyEmployee: false }, 10);
    if ((facilitator || reuseFacilitator) && i % 10 !== 0) add(2, 'commercial', { k: 'commission', company: key, type: i % 4 === 2 ? 'PERCENT' : 'FIXED', value: i % 4 === 2 ? '5' : String(150_000 + (i % 7) * 25_000), currency: 'XAF' }, 11);

    const [fdFirst, fdLast] = person();
    const fdKey = `${key}-fd`;
    add(1, owner, { k: 'contact', key: fdKey, company: key, lastName: fdLast, firstName: fdFirst, role: 'FINANCE_DIRECTOR', email: emailFor(fdFirst, fdLast), phone: phone() });
    const [dmFirst, dmLast] = person();
    const dmKey = `${key}-dm`;
    if (scenario >= 2) add(2, owner, { k: 'contact', key: dmKey, company: key, lastName: dmLast, firstName: dmFirst, role: 'DECISION_MAKER', email: emailFor(dmFirst, dmLast), phone: phone() }, 10);
    // Quelques doublons probables (même nom que le directeur financier, autre e-mail) : l'application les signale mais les accepte.
    if ([3, 13, 23, 33].includes(i)) add(4, owner, { k: 'contact', key: `${key}-fd-doublon`, company: key, lastName: fdLast, firstName: fdFirst, role: 'OTHER', email: `${slug(fdFirst)}.${slug(fdLast)}.bis@${key}.test`, phone: phone() }, 11);
    if (scenario % 2 === 1) {
      const [oFirst, oLast] = person();
      add(3, owner, { k: 'contact', key: `${key}-autre`, company: key, lastName: oLast, firstName: oFirst, role: 'OTHER', email: emailFor(oFirst, oLast), phone: phone() }, 14);
    }
    if (scenario === 0) return;

    // Rendez-vous avec le directeur financier (tenu).
    add(3, owner, { k: 'companyStatus', company: key, status: 'CONTACTED' }, 15);
    const apptFd = `${key}-rdv-fd`;
    const planned = add(3, owner, { k: 'appointment', key: apptFd, company: key, contact: fdKey, type: 'FINANCE_DIRECTOR', startsAt: inDays(7, 9), durationMinutes: 60, location: 'Siège du client', note: 'Présentation du catalogue de formations' }, 16);
    if (planned && i % 20 === 1) {
      // Reporté une fois à la demande du client, puis tenu.
      add(5, owner, { k: 'appointmentTransition', appointment: apptFd, transition: 'postpone', text: 'Report demandé par le client (déplacement professionnel).', startsAt: inDays(10, 9) }, 10);
      add(10, owner, { k: 'appointmentTransition', appointment: apptFd, transition: 'hold', text: 'Besoin confirmé après le report : formation de dix cadres.' }, 11);
    } else if (planned && i % 20 === 11) add(6, owner, { k: 'appointmentTransition', appointment: apptFd, transition: 'cancel', text: 'Le client est indisponible : rendez-vous annulé.' }, 18);
    else if (planned) add(7, owner, { k: 'appointmentTransition', appointment: apptFd, transition: 'hold', text: 'Besoin confirmé : formation de dix cadres, budget à valider.' }, 11);
    if (scenario === 1) return;

    add(8, owner, { k: 'companyStatus', company: key, status: 'QUALIFIED' }, 9);

    // Offre : brouillon, déposée, décharge, relances.
    const amount = String(2_000_000 + Math.floor(rnd() * 24) * 500_000);
    const currency = i % 9 === 0 ? 'EUR' : i % 13 === 0 ? 'USD' : 'XAF';
    const money = currency === 'XAF' ? amount : String(Math.round(Number(amount) / 650));
    const offerKey = `${key}-offre`;
    if (add(10, owner, { k: 'offer', key: offerKey, company: key, subject: SUBJECTS[i % SUBJECTS.length]!, amount: money, currency, note: 'Offre établie après le premier rendez-vous' }) && add(12, owner, { k: 'offerAction', offer: offerKey, action: 'submit' }, 10)) {
      // Scénario 4 : offre déposée dont la décharge n'est pas encore revenue.
      if (scenario !== 4 && add(15, owner, { k: 'receipt', offer: offerKey, receivedBy: `${dmFirst} ${dmLast}` }, 14) && scenario === 5) {
        // Mauvais fichier : la décharge est annulée puis ressaisie.
        if (add(16, owner, { k: 'receiptCancel', offer: offerKey, reason: 'Mauvais fichier joint : décharge à ressaisir.' }, 10)) add(17, owner, { k: 'receipt', offer: offerKey, receivedBy: `${dmFirst} ${dmLast}` }, 11);
      }
    }
    if (scenario === 2 || scenario === 3) {
      const fu = `${key}-relance`;
      const due = scenario === 2 ? 40 : 22;
      add(16, owner, { k: 'followupPlan', key: fu, offer: offerKey, dueOn: dayOf(due), channel: pick(CHANNELS), note: 'Relancer après la décharge pour connaître la décision' }, 9);
      if (scenario === 3) {
        // Première relance faite, deuxième restée sans suite (en retard), troisième annulée.
        if (add(due, owner, { k: 'followupClose', followup: fu, closing: 'complete', text: 'Le client demande un délai de réflexion.' }, 15)) {
          add(due + 1, owner, { k: 'followupPlan', key: `${fu}-2`, offer: offerKey, dueOn: dayOf(due + 12), channel: 'EMAIL', note: 'Deuxième relance : proposer un rendez-vous de décision' }, 9);
          if (add(due + 2, owner, { k: 'followupPlan', key: `${fu}-3`, offer: offerKey, dueOn: dayOf(due + 18), channel: 'CALL', note: 'Troisième relance si pas de réponse' }, 9)) add(due + 8, owner, { k: 'followupClose', followup: `${fu}-3`, closing: 'cancel', text: 'Le contact est injoignable : relance abandonnée.' }, 10);
        }
      }
      if (scenario === 2) {
        if (add(due, owner, { k: 'followupClose', followup: fu, closing: 'complete', text: 'Décision attendue sous quinze jours.' }, 15)) {
          add(due + 3, owner, { k: 'offerAction', offer: offerKey, action: 'withdraw', reason: 'Le client reporte son projet à l’an prochain.' }, 10);
        }
      }
      if (scenario === 3) add(18, owner, { k: 'offer', key: `${offerKey}-2`, company: key, subject: 'Atelier complémentaire (brouillon)', amount: money, currency }, 10);
      return;
    }

    // Opportunité et pipeline.
    const oppKey = `${key}-opp`;
    const oppAt = 10;
    if (!add(oppAt, owner, { k: 'opportunity', key: oppKey, company: key, title: `Plan de formation ${company.name}`, amount: money, currency, source: SOURCES[i % SOURCES.length]! }, 11)) return;
    const apptDm = `${key}-rdv-dm`;
    const needsMeeting = scenario !== 5;
    if (needsMeeting) {
      if (add(oppAt + 1, owner, { k: 'appointment', key: apptDm, company: key, contact: dmKey, opportunity: oppKey, type: 'DECISION_MAKER', startsAt: inDays(oppAt + 5, 10), durationMinutes: 90, location: 'Visioconférence', note: 'Rencontre avec le décideur' }, 9)) {
        add(oppAt + 5, owner, { k: 'appointmentTransition', appointment: apptDm, transition: 'hold', text: 'Le décideur valide le principe d’une collaboration.' }, 12);
      }
    } else {
      add(oppAt + 2, 'commercial', { k: 'waiver', opportunity: oppKey, reason: 'Le client est connu de la direction commerciale : le rendez-vous décideur est remplacé par un échange direct.' }, 10);
    }
    const advance = (offset: number) => add(offset, owner, { k: 'advance', opportunity: oppKey }, 10);

    // Une opportunité reste à « Qualification » (rendez-vous tenu, pas encore avancée).
    if (i === 17) return;
    if (scenario === 7) add(oppAt + 18, owner, { k: 'offerAction', offer: offerKey, action: 'refuse' }, 11);
    if (scenario === 7) {
      if (advance(oppAt + 6)) add(oppAt + 20, owner, { k: 'close', opportunity: oppKey, outcome: 'lost', reason: LOSS[i % LOSS.length]!, note: 'Le client retient une offre concurrente.' }, 16);
      return;
    }
    if (scenario === 4) {
      if (advance(oppAt + 6)) advance(oppAt + 14);
      return;
    }
    const reachedProposal = advance(oppAt + 6);
    const reachedNegotiation = reachedProposal && advance(oppAt + 14);
    const reachedAgreement = reachedNegotiation && advance(oppAt + 24);
    if (scenario === 5 || !reachedAgreement) return;

    // Agrément (scénarios 6, 8, 9).
    const aKey = `${key}-agrement`;
    const aAt = oppAt + 28;
    if (scenario === 6) {
      add(aAt - 2, owner, { k: 'offerAction', offer: offerKey, action: 'accept' }, 10);
      if (add(aAt, owner, { k: 'approval', key: aKey, opportunity: oppKey, amount: money, currency, receivedOn: dayOf(aAt), validUntil: dayOf(aAt + 180) }, 11)) {
        add(aAt + 1, owner, { k: 'advance', opportunity: oppKey }, 10); // étape « Agrément »
        if (add(aAt + 14, 'finance', { k: 'approvalClose', approval: aKey, action: 'honor' }, 10)) {
          // La commission du facilitateur devient due : la Finance la débloque (1re), la suspend (2e), la laisse à verser (3e) ; la 4e est annulée.
          if (i === 6) add(aAt + 16, 'finance', { k: 'payout', approval: aKey, action: 'release' }, 11);
          if (i === 16) add(aAt + 16, 'finance', { k: 'payout', approval: aKey, action: 'hold', reason: 'Virement du client attendu avant tout versement.' }, 11);
          if (i === 36) add(aAt + 18, 'commercial', { k: 'payout', approval: aKey, action: 'cancel', reason: 'Facilitateur remplacé : commission à recalculer.' }, 11);
          if (add(aAt + 40, owner, { k: 'ambassador', key: `${key}-ambassadeur`, lastName: dmLast, firstName: dmFirst, origin: 'CLIENT', company: key, email: emailFor(dmFirst, dmLast).replace('@', '.ambassadeur@'), phone: phone(), appointedOn: dayOf(aAt + 40), note: 'A recommandé deux entreprises du secteur.' }, 15) && i % 20 === 6) {
            add(aAt + 55, 'commercial', { k: 'ambassadorUpdate', ambassador: `${key}-ambassadeur`, note: 'A mis en relation deux nouveaux prospects (suivi par la direction commerciale).' }, 10);
          }
        }
      }
      return;
    }
    if (scenario === 8) {
      const [payerName, payerType] = PAYERS[i % PAYERS.length]!;
      if (add(aAt, owner, { k: 'approval', key: aKey, opportunity: oppKey, amount: money, currency, requested: true, validUntil: dayOf(aAt + 120), payerName, payerType }, 11)) {
        if (i === 18) add(aAt + 12, 'commercial', { k: 'approvalClose', approval: aKey, action: 'cancel', reason: 'Le client renonce à la formation.' }, 14);
        else add(aAt + 12, owner, { k: 'approvalReceive', approval: aKey, receivedOn: dayOf(aAt + 12) }, 14);
      }
      return;
    }
    // Scénario 9 : agrément reçu, opportunité gagnée, agrément expiré à la main.
    if (add(aAt, owner, { k: 'approval', key: aKey, opportunity: oppKey, places: 8 + (i % 6), currency, receivedOn: dayOf(aAt), validUntil: dayOf(aAt + 45) }, 11)) {
      add(aAt + 5, 'commercial', { k: 'close', opportunity: oppKey, outcome: 'won', note: 'Accord signé, inscriptions à ouvrir.' }, 15);
      add(aAt + 60, 'commercial', { k: 'approvalClose', approval: aKey, action: 'expire', reason: 'Validité dépassée sans règlement.' }, 10);
    }
  });

  // Activité récente : relances et rendez-vous planifiés à l'avance (échéances futures), sur les offres encore ouvertes les plus récentes.
  const finalActions = new Set(events.filter((e) => e.op.k === 'offerAction' && e.op.action !== 'submit').map((e) => (e.op as { offer: string }).offer));
  const seenOffers = new Set<string>(events.filter((e) => e.op.k === 'followupPlan').map((e) => (e.op as { offer: string }).offer)); // offres qui ont déjà leurs relances
  const openOffers = events.filter((e) => {
    if (e.op.k !== 'receipt' || finalActions.has(e.op.offer) || seenOffers.has(e.op.offer)) return false;
    seenOffers.add(e.op.offer);
    return true;
  }).slice(-6);
  const ownerOfOffer = (offerKey: string): Who => events.find((e) => e.op.k === 'offer' && e.op.key === offerKey)?.who ?? 'compte1';
  const pushRecent = (event: SeedEvent, companyKey: string | undefined) => {
    events.push(event);
    if (companyKey) track(companyKey, event.at);
  };
  openOffers.forEach((receiptEvent, index) => {
    const offer = (receiptEvent.op as { offer: string }).offer;
    const plannedAt = new Date(Math.max(receiptEvent.at.getTime() + DAY, day0.getTime() - DAY + 9 * 3_600_000));
    const company = companyOfOffer.get(offer);
    pushRecent({ at: plannedAt, who: ownerOfOffer(offer), op: { k: 'followupPlan', key: `${offer}-relance-recente`, offer, dueOn: isoDay(new Date(day0.getTime() + (3 + index * 4) * DAY)), channel: CHANNELS[index % CHANNELS.length]!, note: 'Prendre des nouvelles de la décision du comité' } }, company);
    // Les deux premières offres ont une seconde relance plus lointaine.
    if (index < 2) pushRecent({ at: new Date(plannedAt.getTime() + 3_600_000), who: ownerOfOffer(offer), op: { k: 'followupPlan', key: `${offer}-relance-recente-2`, offer, dueOn: isoDay(new Date(day0.getTime() + (14 + index * 7) * DAY)), channel: 'MEETING', note: 'Proposer un point d’étape avec la direction' } }, company);
  });
  const recentCompanies = events.filter((e) => e.op.k === 'contact' && e.op.role === 'FINANCE_DIRECTOR').slice(-9);
  const apptTypes = ['FINANCE_DIRECTOR', 'VISIT', 'DECISION_MAKER'] as const;
  let recentAppointments = 0;
  recentCompanies.forEach((contactEvent, index) => {
    const contact = contactEvent.op as Extract<SeedOp, { k: 'contact' }>;
    const type = apptTypes[index % apptTypes.length]!;
    const plannedAt = new Date(day0.getTime() - DAY + (8 + index) * 3_600_000);
    if (plannedAt.getTime() < contactEvent.at.getTime()) return;
    recentAppointments += 1;
    const key = `${contact.company}-rdv-a-venir`;
    const startsAt = new Date(day0.getTime() + (1 + index * 2) * DAY + (9 + (index % 5)) * 3_600_000);
    pushRecent({ at: plannedAt, who: contactEvent.who, op: { k: 'appointment', key, company: contact.company, contact: type === 'VISIT' ? undefined : contact.key, type, startsAt: startsAt.toISOString(), durationMinutes: type === 'DECISION_MAKER' ? 90 : 60, location: type === 'VISIT' ? 'Locaux du client' : 'Visioconférence', note: 'Rendez-vous planifié lors du dernier échange' } }, contact.company);
    // Un rendez-vous à venir sur trois est déjà reporté une fois.
    if (recentAppointments % 3 === 2) pushRecent({ at: new Date(plannedAt.getTime() + 2 * 3_600_000), who: contactEvent.who, op: { k: 'appointmentTransition', appointment: key, transition: 'postpone', text: 'Le client demande de décaler d’une semaine.', startsAt: new Date(startsAt.getTime() + 7 * DAY).toISOString() } }, contact.company);
  });

  // Quatre entreprises sont confiées à un autre chargé de compte par le Responsable commercial, une fois leur histoire terminée.
  [4, 14, 24, 34].forEach((index) => {
    const key = slug(COMPANIES[index]!.name);
    const last = lastAt.get(key);
    const owner = ownerOf.get(key);
    if (last === undefined || owner === undefined) return;
    const when = new Date(last + 2 * DAY + 11 * 3_600_000);
    if (when.getTime() > anchor.getTime()) return;
    events.push({ at: when, who: 'commercial', op: { k: 'reassign', company: key, to: OWNERS[(OWNERS.indexOf(owner) + 1) % OWNERS.length]! } });
  });

  // Deux ambassadeurs issus de la formation (sans entreprise rattachée) ; le premier est ensuite complété par le Responsable commercial.
  const learners: [number, string, string][] = [[-120, 'Marie-Claire', 'Ngassa'], [-45, 'Ousmane', 'Gueye']];
  learners.forEach(([offset, first, last], index) => {
    const when = new Date(day0.getTime() + offset * DAY + 10 * 3_600_000);
    events.push({ at: when, who: OWNERS[index % OWNERS.length]!, op: { k: 'ambassador', key: `apprenant-${index + 1}`, lastName: last, firstName: first, origin: 'LEARNER', email: `${slug(first)}.${slug(last)}@apprenants.test`, phone: demoPhone('Cameroun', 9000 + index), appointedOn: isoDay(when), note: 'Ancien apprenant devenu relais auprès de son réseau.' } });
    if (index === 0) events.push({ at: new Date(when.getTime() + 20 * DAY), who: 'commercial', op: { k: 'ambassadorUpdate', ambassador: 'apprenant-1', note: 'Anime un club d’investisseurs : à inviter aux prochaines sessions.' } });
  });

  // Catalogue Investudy : le programme, ses sept modules partagés, ses cinq certificats (tarifs publics) et la salle de marchés. Posés un an avant la
  // date de référence par le Responsable commercial (les cas d'usage du catalogue n'ont pas de portée : seule la permission compte).
  const catalogueAt = new Date(day0.getTime() - 365 * DAY + 9 * 3_600_000);
  CATALOGUE.forEach((op, index) => events.push({ at: new Date(catalogueAt.getTime() + index * 60_000), who: 'commercial', op }));
  FORMATEURS.forEach((op, index) => events.push({ at: new Date(catalogueAt.getTime() + (CATALOGUE.length + index) * 60_000), who: 'commercial', op }));

  // Sessions de formation : sept sessions autour de la date de référence, toutes dans la salle de marchés, une semaine après l'autre (aucun chevauchement).
  // Deux terminées, une en cours (si la date de référence est un jour de cours), une ouverte, une planifiée, une reportée, une annulée. Les sessions sont
  // posées trois semaines avant leur début (jamais dans le futur) ; elles désignent le catalogue et les formateurs par leur nom, ce qui permet de les
  // charger seules sur une démo qui a déjà le catalogue.
  let monday0 = day0.getTime();
  while (new Date(monday0).getUTCDay() !== 1) monday0 -= DAY;
  const weekStart = (weeks: number) => isoDay(new Date(monday0 + weeks * 7 * DAY));
  const certificate = (key: string) => CERTIFICATES.find((c) => c.key === key)!.title;
  const trainerMail = (index: number) => `${TRAINERS[index]![3]}@formateurs.investudy.test`;
  const salle = 'Salle de marchés';
  const SESSIONS: readonly { key: string; certificate: string; trainer: number; week: number; capacity: number; open: boolean; postponeTo?: number; cancelReason?: string }[] = [
    { key: 'session-expert-passee', certificate: 'expert', trainer: 1, week: -5, capacity: 13, open: true },
    { key: 'session-etudiants-passee', certificate: 'etudiants', trainer: 4, week: -3, capacity: 12, open: true },
    { key: 'session-dirigeants-en-cours', certificate: 'dirigeants', trainer: 2, week: 0, capacity: 10, open: true },
    { key: 'session-banque-ouverte', certificate: 'banque', trainer: 3, week: 1, capacity: 13, open: true },
    { key: 'session-avocats-planifiee', certificate: 'avocats', trainer: 0, week: 2, capacity: 10, open: false },
    { key: 'session-expert-reportee', certificate: 'expert', trainer: 1, week: 3, capacity: 13, open: false, postponeTo: 4 },
    { key: 'session-etudiants-annulee', certificate: 'etudiants', trainer: 4, week: 5, capacity: 12, open: true, cancelReason: 'Pas assez d’inscrits : la session est reprogrammée au prochain cycle.' },
  ];
  SESSIONS.forEach((s) => {
    const start = weekStart(s.week);
    const plannedAt = Math.min(new Date(`${start}T00:00:00.000Z`).getTime() - 21 * DAY, day0.getTime() - 3 * DAY) + 10 * 3_600_000;
    events.push({ at: new Date(plannedAt), who: 'commercial', op: { k: 'session', key: s.key, training: certificate(s.certificate), room: salle, trainer: trainerMail(s.trainer), startDate: start, capacity: s.capacity } });
    if (s.open) events.push({ at: new Date(plannedAt + DAY), who: 'commercial', op: { k: 'sessionOpen', session: s.key } });
    if (s.postponeTo !== undefined) events.push({ at: new Date(plannedAt + 2 * DAY), who: 'commercial', op: { k: 'sessionPostpone', session: s.key, startDate: weekStart(s.postponeTo), reason: 'Le formateur n’est pas disponible la semaine prévue.' } });
    if (s.cancelReason) events.push({ at: new Date(plannedAt + 2 * DAY), who: 'commercial', op: { k: 'sessionCancel', session: s.key, reason: s.cancelReason } });
  });

  // Apprenants et inscriptions : douze apprenants répartis sur cinq entreprises qui ont un agrément reçu ou honoré (l'entreprise se désigne par son rang
  // parmi celles-ci, à l'exécution), inscrits aux sessions ci-dessus. Les inscrits des sessions passées sont confirmés ; une session ouverte garde des inscrits
  // en attente, une inscription annulée et un replacement ; les inscrits de la session annulée passent « à replacer ». Posés par le Responsable Investudy.
  const sessionAtDay = (key: string) => SESSIONS.find((s) => s.key === key)!;
  const startOfSession = (key: string) => new Date(`${weekStart(sessionAtDay(key).week)}T00:00:00.000Z`).getTime();
  const enrolledAt = (key: string, hours: number) => Math.min(startOfSession(key) - 20 * DAY, day0.getTime() - 2 * DAY) + 24 * 3_600_000 + hours * 3_600_000;
  // Cinq entreprises clientes de formation, propres à ce bloc (il se charge donc seul, même sur une démo dont les agréments ont expiré) : chacune a son
  // opportunité menée à l'accord de principe et un agrément reçu, valable plus d'un an après la date de référence (somme pour trois, places pour deux).
  const clientsBase = Math.min(startOfSession('session-expert-passee') - 25 * DAY, day0.getTime() - 3 * DAY) - 60 * DAY;
  const clientValidUntil = isoDay(new Date(day0.getTime() + 400 * DAY));
  FORMATION_CLIENTS.forEach(([name, country], i) => {
    const key = `${FORMATION_CLIENT}${i + 1}`;
    const owner = OWNERS[i % OWNERS.length]!;
    const at = (days: number, who: Who, op: SeedOp) => events.push({ at: new Date(clientsBase + days * DAY + i * 60_000 + 9 * 3_600_000), who, op });
    at(0, owner, { k: 'company', key, name, sector: 'Services financiers', country, email: `contact@${key}.test`, phone: demoPhone(country, 6000 + i) });
    at(1, owner, { k: 'opportunity', key: `${key}-opp`, company: key, title: `Plan de formation ${name}`, amount: '6000000', currency: 'XAF', source: 'REFERRAL' });
    at(2, 'commercial', { k: 'waiver', opportunity: `${key}-opp`, reason: 'Le client est connu de la direction commerciale : le rendez-vous décideur est remplacé par un échange direct.' });
    [6, 14, 24].forEach((day) => at(day, owner, { k: 'advance', opportunity: `${key}-opp` }));
    at(28, owner, i < 3
      ? { k: 'approval', key: `${key}-agrement`, opportunity: `${key}-opp`, amount: '6000000', currency: 'XAF', receivedOn: isoDay(new Date(clientsBase + 28 * DAY)), validUntil: clientValidUntil }
      : { k: 'approval', key: `${key}-agrement`, opportunity: `${key}-opp`, places: 12, currency: 'XAF', receivedOn: isoDay(new Date(clientsBase + 28 * DAY)), validUntil: clientValidUntil });
  });
  const formationLearners = Array.from({ length: 12 }, (_, i) => {
    const first = FIRST[(i * 3 + 2) % FIRST.length]!;
    const last = LAST[(i * 5 + 1) % LAST.length]!;
    return { key: `apprenant-formation-${i + 1}`, company: `${FORMATION_CLIENT}${(i % 5) + 1}`, first, last };
  });
  const learnerAt = Math.min(startOfSession('session-expert-passee') - 25 * DAY, day0.getTime() - 3 * DAY);
  formationLearners.forEach((l, i) => events.push({ at: new Date(learnerAt + i * 60_000), who: 'investudy', op: { k: 'learner', key: l.key, company: l.company, lastName: l.last, firstName: l.first, email: `${slug(l.first)}.${slug(l.last)}.${i + 1}@apprenants.test`, phone: demoPhone('Cameroun', 7000 + i) } }));
  const enroll = (key: string, learnerIndex: number, session: string, hours: number, confirm: boolean) => {
    const at = enrolledAt(session, hours);
    events.push({ at: new Date(at), who: 'investudy', op: { k: 'enroll', key, learner: formationLearners[learnerIndex - 1]!.key, session } });
    if (confirm) events.push({ at: new Date(at + 3_600_000), who: 'investudy', op: { k: 'enrollConfirm', enrollment: key } });
    return at;
  };
  [1, 2, 3].forEach((n, i) => enroll(`inscription-${n}`, n, 'session-expert-passee', i, true));
  [4, 5].forEach((n, i) => enroll(`inscription-${n}`, n, 'session-etudiants-passee', i, true));
  [6, 7, 8].forEach((n, i) => enroll(`inscription-${n}`, n, 'session-dirigeants-en-cours', i, true));
  enroll('inscription-9', 9, 'session-banque-ouverte', 0, true);
  enroll('inscription-10', 10, 'session-banque-ouverte', 1, true);
  enroll('inscription-11', 11, 'session-banque-ouverte', 2, false);
  const withdrawn = enroll('inscription-12', 12, 'session-banque-ouverte', 3, false);
  events.push({ at: new Date(withdrawn + 5 * 3_600_000), who: 'investudy', op: { k: 'enrollCancel', enrollment: 'inscription-12', reason: 'Le client a renoncé : le collaborateur est remplacé.' } });
  // Deux inscrits de la session annulée (des apprenants déjà passés par une session terminée) : l'un est replacé sur la session ouverte, l'autre reste « à replacer ».
  enroll('inscription-13', 1, 'session-etudiants-annulee', 0, false);
  enroll('inscription-14', 2, 'session-etudiants-annulee', 1, false);
  events.push({ at: new Date(enrolledAt('session-etudiants-annulee', 0) + 12 * 3_600_000), who: 'investudy', op: { k: 'enrollReplace', enrollment: 'inscription-13', session: 'session-banque-ouverte' } });

  // Bloc « particuliers » (Lot B) : des apprenants SANS entreprise ni agrément, saisis par le Responsable Investudy : deux étudiants (l'un règle lui-même, pour l'autre c'est sa famille) et un
  // particulier dont l'employeur règle. Aucune donnée réelle ; les e-mails sont en domaine réservé. Les inscriptions visent des sessions du bloc « sessions ».
  const individualsAt = learnerAt + 30 * 60_000;
  const person = (key: string, kind: 'STUDENT' | 'INDIVIDUAL', first: string, last: string, index: number) => events.push({
    at: new Date(individualsAt + index * 60_000),
    who: 'investudy',
    op: { k: 'individual', key, kind, lastName: last, firstName: first, email: `${slug(first)}.${slug(last)}${INDIVIDUALS_EMAIL_DOMAIN}`, phone: demoPhone('Cameroun', 9500 + index) },
  });
  person('etudiant-1', 'STUDENT', 'Léa', 'Essomba', 0);
  person('etudiant-2', 'STUDENT', 'Marc', 'Ndongo', 1);
  person('particulier-1', 'INDIVIDUAL', 'Carine', 'Tchamba', 2);
  const individualEnroll = (key: string, learner: string, session: string, hours: number, payer: Extract<SeedOp, { k: 'enrollIndividual' }>['payer'], confirm: boolean) => {
    const at = enrolledAt(session, hours + 10);
    events.push({ at: new Date(at), who: 'investudy', op: { k: 'enrollIndividual', key, learner, session, payer } });
    if (confirm) events.push({ at: new Date(at + 3_600_000), who: 'investudy', op: { k: 'individualConfirm', enrollment: key } });
  };
  individualEnroll('inscription-etudiant-1', 'etudiant-1', 'session-etudiants-passee', 0, { kind: 'SELF' }, true);
  individualEnroll('inscription-etudiant-2', 'etudiant-2', 'session-etudiants-passee', 1, { kind: 'THIRD_PARTY', name: 'Famille Ndongo (donnée de démonstration)', type: 'FAMILY' }, true);
  individualEnroll('inscription-particulier-1', 'particulier-1', 'session-banque-ouverte', 4, { kind: 'THIRD_PARTY', name: 'Cabinet Audit Plus (donnée de démonstration)', type: 'EMPLOYER' }, false);

  // Bloc « rh » : le personnel fictif (des FONCTIONS, aux noms inventés), créé par la RH. La hiérarchie des fiches suit celle des comptes de démonstration, sauf la
  // Finance (responsable RH : la DGA ; compte sans responsable) : un écart volontaire, pour montrer son signalement. Un ancien chargé de compte est sorti du personnel.
  const staffAt = (minute: number) => new Date(day0.getTime() - 20 * DAY + 9 * 3_600_000 + minute * 60_000);
  const hired = (daysAgo: number) => isoDay(new Date(day0.getTime() - daysAgo * DAY));
  let staffPhone = 7000;
  const staff = (
    index: number, key: string, first: string, last: string, jobTitle: string, department: string, daysAgo: number, extra: { manager?: string; account?: Who } = {},
  ) => events.push({
    at: staffAt(index),
    who: 'rh',
    op: {
      k: 'employee', key, matricule: `INV-${String(index + 1).padStart(3, '0')}`, lastName: last, firstName: first, jobTitle, department, ...extra,
      workEmail: `${slug(first)}.${slug(last)}${RH_EMAIL_DOMAIN}`, workPhone: demoPhone('Cameroun', ++staffPhone), hiredOn: hired(daysAgo),
    },
  });
  staff(0, 'personnel-dg', 'Samuel', 'Ekambi', 'Directeur général', 'Direction', 1500);
  staff(1, 'personnel-dga', 'Nadège', 'Tchoumi', 'Directrice générale adjointe (finances et ressources humaines)', 'Direction', 1300, { manager: 'personnel-dg', account: 'rh' });
  staff(2, 'personnel-daf', 'Félix', 'Nkodo', 'Directeur administratif et financier', 'Finance', 1100, { manager: 'personnel-dga', account: 'finance' });
  staff(3, 'personnel-commercial', 'Hugo', 'Mballa', 'Responsable commercial', 'Commercial', 1200, { manager: 'personnel-dg', account: 'commercial' });
  staff(4, 'personnel-compte1', 'Camille', 'Ngono', 'Chargée de compte', 'Commercial', 700, { manager: 'personnel-commercial', account: 'compte1' });
  staff(5, 'personnel-compte2', 'Karim', 'Biya', 'Chargé de compte', 'Commercial', 600, { manager: 'personnel-commercial', account: 'compte2' });
  staff(6, 'personnel-compte3', 'Estelle', 'Fouda', 'Chargée de compte', 'Commercial', 500, { manager: 'personnel-commercial', account: 'compte3' });
  staff(7, 'personnel-investudy', 'Inès', 'Abena', 'Responsable Investudy', 'Investudy', 900, { manager: 'personnel-dg', account: 'investudy' });
  staff(8, 'personnel-assistant-formation', 'Joël', 'Essomba', 'Assistant de formation', 'Investudy', 400, { manager: 'personnel-investudy' });
  staff(9, 'personnel-support', 'Sonia', 'Manga', 'Agente de support', 'Support', 450, { manager: 'personnel-dga' });
  staff(10, 'personnel-ancien', 'Patrick', 'Owona', 'Chargé de compte', 'Commercial', 800, { manager: 'personnel-commercial' });
  events.push({ at: new Date(day0.getTime() - 5 * DAY + 9 * 3_600_000), who: 'rh', op: { k: 'employeeLeave', employee: 'personnel-ancien', leftOn: hired(60), reason: 'Fin de contrat (donnée de démonstration)' } });

  // Bloc « conges » : des absences fictives sur le personnel ci-dessus, pour montrer chaque écran (à valider, calendrier, refus, demi-journée, saisie par la RH). Aucune donnée de
  // santé : un type « maladie » n'a ni diagnostic ni pièce. Les dates tombent toujours un jour ouvré. Aucun jour férié n'est présumé : la liste est à la RH.
  const nextWorkday = (from: Date): Date => {
    let day = from;
    while (day.getUTCDay() === 0 || day.getUTCDay() === 6) day = new Date(day.getTime() + DAY);
    return day;
  };
  const workday = (offset: number): string => isoDay(nextWorkday(new Date(day0.getTime() + offset * DAY)));
  /** Une période de `days` jours ouvrés à partir du premier jour ouvré après `offset`. */
  const span = (offset: number, days: number): { start: string; end: string } => {
    const start = nextWorkday(new Date(day0.getTime() + offset * DAY));
    let end = start;
    for (let left = days - 1; left > 0; left--) end = nextWorkday(new Date(end.getTime() + DAY));
    return { start: isoDay(start), end: isoDay(end) };
  };
  const leaveAt = (daysAgo: number, hour: number) => new Date(day0.getTime() - daysAgo * DAY + hour * 3_600_000);
  const leave = (key: string, at: Date, who: Who, employee: string, typeCode: string, period: { start: string; end: string }, note: string, halves: { startHalf?: boolean; endHalf?: boolean } = {}) =>
    events.push({ at, who, op: { k: 'leave', key, employee, typeCode, ...period, ...halves, note: `${note} (donnée de démonstration)` } });
  // Saisie par la RH pour un collègue, y compris dans le passé : validée d'emblée.
  leave('absence-maladie', leaveAt(6, 10), 'rh', 'personnel-compte2', 'SICK', span(-9, 2), 'Absence pour raison personnelle');
  leave('absence-support', leaveAt(4, 10), 'rh', 'personnel-support', 'ANNUAL', span(1, 3), 'Congé annuel saisi par la RH');
  // Demandes des employés (compte lié) : deux restent à valider, une est validée, une est refusée, une attend la RH (le responsable est la direction).
  leave('absence-compte1', leaveAt(3, 9), 'compte1', 'personnel-compte1', 'ANNUAL', span(14, 5), 'Congés de fin d’année');
  leave('absence-compte3', leaveAt(3, 11), 'compte3', 'personnel-compte3', 'ANNUAL', span(7, 2), 'Congé court');
  leave('absence-compte2-permission', leaveAt(2, 10), 'compte2', 'personnel-compte2', 'SPECIAL', { start: workday(3), end: workday(3) }, 'Démarche administrative', { endHalf: true });
  leave('absence-compte2-conge', leaveAt(2, 11), 'compte2', 'personnel-compte2', 'ANNUAL', span(28, 4), 'Congé annuel');
  leave('absence-investudy', leaveAt(1, 9), 'investudy', 'personnel-investudy', 'ANNUAL', span(40, 5), 'Congé annuel');
  events.push({ at: leaveAt(2, 15), who: 'commercial', op: { k: 'leaveDecision', leave: 'absence-compte3', decision: 'REJECT', note: 'Période de forte activité commerciale : à reporter après la clôture du trimestre.' } });
  events.push({ at: leaveAt(1, 15), who: 'commercial', op: { k: 'leaveDecision', leave: 'absence-compte2-conge', decision: 'APPROVE' } });

  // Ordre chronologique stable (à date égale, l'ordre de construction est conservé).
  return events.map((event, order) => ({ event, order })).sort((a, b) => a.event.at.getTime() - b.event.at.getTime() || a.order - b.order).map((x) => x.event);
}
