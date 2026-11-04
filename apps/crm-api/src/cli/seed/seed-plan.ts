/**
 * Plan du jeu de données de démonstration : une liste d'événements datés, construite sans accès à la base (donc testable seule).
 * Les données sont ENTIÈREMENT FICTIVES : noms d'entreprises et de personnes inventés, e-mails en `.test`, numéros de téléphone du
 * motif réservé « deux zéros avant les quatre derniers chiffres ». Le plan est déterministe : mêmes entrées, mêmes événements ; les dates sont
 * relatives à `anchor` (aujourd'hui), pour que retards, échéances et graphiques restent parlants.
 */

/** Qui exécute l'événement : un chargé de compte, le Responsable commercial ou la Finance (chacun avec ses droits et sa portée). */
export type Who = 'compte1' | 'compte2' | 'compte3' | 'commercial' | 'finance';

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

  // Ordre chronologique stable (à date égale, l'ordre de construction est conservé).
  return events.map((event, order) => ({ event, order })).sort((a, b) => a.event.at.getTime() - b.event.at.getTime() || a.order - b.order).map((x) => x.event);
}
