/** Profil de l'utilisateur connecté : identité, rôles, droits (avec portée) et état du MFA. */
export interface Profile {
  userId: string;
  email: string;
  displayName: string;
  roles: string[];
  permissions: { code: string; scope: 'OWN' | 'TEAM' | 'ALL' }[];
  mfaEnrolled: boolean;
}

/** Page de résultats paginés renvoyée par l'API. */
export interface Page<T> {
  items: T[];
  total: number;
  page?: number;
  pageSize?: number;
}

/** Utilisateur tel que l'API l'expose à l'administration. */
export interface UserView {
  id: string;
  email: string;
  displayName: string;
  status: 'PENDING' | 'ACTIVE' | 'LOCKED' | 'DISABLED';
  roles: string[];
  managerId: string | null;
  mfaEnabled: boolean;
  lastLoginAt: string | null;
  createdAt: string;
}

/** Rôle et ses permissions, tels que l'API les expose. */
export interface RoleView {
  code: string;
  label: string;
  description: string;
  mfaRequired: boolean;
  permissions: { code: string; scope: string }[];
}

/** Session de connexion telle que l'API l'expose (la courante est marquée). */
export interface SessionView {
  id: string;
  ipAddress: string;
  device: string;
  riskLevel: string;
  mfaVerified: boolean;
  loggedInAt: string;
  lastSeenAt: string;
  expiresAt: string;
  current: boolean;
}

/** Entreprise cible telle que l'API l'expose. */
export interface Company {
  id: string;
  name: string;
  status: string;
  sector: string | null;
  country: string | null;
  email: string | null;
  phone: string | null;
  /** Date de création (ISO 8601). */
  createdAt: string;
  /** Numéro de version (verrou optimiste) : renvoyé tel quel pour modifier la fiche. */
  version: number;
  /** Présente dans le détail seulement. `null` : aucun facilitateur. */
  facilitation?: Facilitation | null;
}

/** Contact : interlocuteur d'une entreprise. */
export interface Contact {
  id: string;
  companyId: string;
  companyName: string;
  lastName: string;
  firstName: string;
  role: string;
  email: string | null;
  phone: string | null;
  createdAt: string;
  /** Verrou optimiste : renvoyé tel quel pour modifier le contact. */
  version: number;
}

/** Offre faite à une entreprise (le montant est un texte décimal : jamais converti en nombre avant l'affichage). */
export interface Offer {
  id: string;
  reference: string;
  companyId: string;
  companyName: string;
  subject: string;
  amount: string;
  currency: string;
  status: string;
  note: string | null;
  submittedAt: string | null;
  decidedAt: string | null;
  withdrawnReason: string | null;
  createdAt: string;
  /** Échéance de la prochaine relance à faire (dans les listes seulement) ; `null` si aucune. */
  nextFollowupOn?: string | null;
  /** Verrou optimiste : renvoyé tel quel pour modifier l'offre ou changer son état. */
  version: number;
}

/** Décharge signée d'une offre déposée (le fichier signé est un document rattaché à la décharge). */
export interface Receipt {
  id: string;
  offerId: string;
  offerReference: string;
  /** Date de réception, « AAAA-MM-JJ ». */
  receivedOn: string;
  receivedBy: string;
  status: string;
  cancelledReason: string | null;
  cancelledAt: string | null;
  createdAt: string;
  /** Verrou optimiste : renvoyé tel quel pour annuler la décharge. */
  version: number;
}

/** Relance d'une offre en cours : à faire à une échéance, terminée (avec son résultat) ou annulée (avec son motif). */
export interface Followup {
  id: string;
  offerId: string;
  offerReference: string;
  companyId: string;
  companyName: string;
  /** Échéance, « AAAA-MM-JJ ». */
  dueOn: string;
  channel: string;
  note: string | null;
  status: string;
  /** Résultat (terminée) ou motif d'annulation (annulée). */
  resultNote: string | null;
  closedAt: string | null;
  /** Calculé par le serveur : à faire et échéance dépassée. */
  overdue: boolean;
  createdAt: string;
  /** Verrou optimiste : renvoyé tel quel pour modifier, terminer ou annuler la relance. */
  version: number;
}

/** Rendez-vous ou visite d'une entreprise, dans l'agenda de son organisateur. */
export interface Appointment {
  id: string;
  type: string;
  companyId: string;
  companyName: string;
  contactId: string | null;
  contactName: string | null;
  offerId: string | null;
  offerReference: string | null;
  organizerUserId: string;
  /** Instants ISO (UTC) de début et de fin. */
  startsAt: string;
  endsAt: string;
  durationMinutes: number;
  location: string | null;
  note: string | null;
  status: string;
  /** Compte rendu (tenu) ou motif d'annulation (annulé). */
  outcomeNote: string | null;
  closedAt: string | null;
  postponements: number;
  lastPostponeReason: string | null;
  /** Calculé par le serveur : à venir et heure de début passée (un compte rendu est attendu). */
  reportDue: boolean;
  createdAt: string;
  /** Verrou optimiste : renvoyé tel quel pour modifier, reporter, tenir ou annuler le rendez-vous. */
  version: number;
  /** Présent à la planification, à la modification et au report : autres rendez-vous du même organisateur sur le même créneau. */
  conflicts?: { id: string; type: string; startsAt: string; endsAt: string; companyName: string }[];
}

/** Opportunité commerciale d'une entreprise (pipeline). */
export interface Opportunity {
  id: string;
  companyId: string;
  companyName: string;
  title: string;
  /** Montant estimé, texte décimal à deux décimales. */
  amount: string;
  currency: string;
  source: string;
  stage: string;
  /** Étape suivante ; `null` à la dernière ou si l'opportunité est clôturée. */
  nextStage: string | null;
  status: string;
  lossReason: string | null;
  closingNote: string | null;
  closedAt: string | null;
  waiverReason: string | null;
  waivedAt: string | null;
  stageChangedAt: string;
  lastActivityAt: string;
  createdAt: string;
  /** Verrou optimiste : renvoyé tel quel pour modifier, avancer, déroger ou clore l'opportunité. */
  version: number;
}

/** Facilitateur : personne qui met en relation avec une entreprise. */
export interface Facilitator {
  id: string;
  lastName: string;
  firstName: string;
  phone: string;
  comment: string | null;
  createdAt: string;
}

export interface Commission {
  type: 'PERCENT' | 'FIXED' | string;
  /** Texte décimal (« 7.50 ») : jamais converti en nombre avant l'affichage. */
  value: string;
  currency: string | null;
}

/** Lien entreprise ↔ facilitateur. `facilitator` est nul si l'utilisateur n'a pas le droit de le voir ; `commission` est absente sans la permission « Commissions ». */
export interface Facilitation {
  facilitatorId: string;
  contactMethod: string;
  isCompanyEmployee: boolean;
  facilitator: Facilitator | null;
  commission?: Commission | null;
}

/** Une connexion de l'historique (réussie ou échouée) : étape de l'échec, adresse IP et appareil. */
export interface LoginEvent {
  id: string;
  at: string;
  result: 'SUCCESS' | 'FAILED';
  stage?: 'PASSWORD' | 'SECOND_FACTOR';
  ipAddress: string;
  device: string;
}

/** Page de l'historique : `nextBefore` est le curseur de la page suivante (nul s'il n'y en a pas). */
export interface LoginHistoryPage {
  items: LoginEvent[];
  nextBefore: string | null;
  windowDays: number;
}

/** Une version d'un document (le contenu est immuable ; l'empreinte SHA-256 en atteste l'intégrité). */
export interface DocumentVersionView {
  number: number;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  sha256: string;
  /** `PENDING` : le fichier n'a pas été analysé par un antivirus (le service arrive avec S7). */
  scanStatus: 'PENDING' | 'CLEAN' | 'INFECTED';
  uploadedAt: string;
}

/** Un document avec sa version courante. */
export interface DocumentView {
  id: string;
  ownerType: string;
  ownerId: string;
  title: string;
  category: string | null;
  status: string;
  createdAt: string;
  current: DocumentVersionView;
}

/** Détail d'un document : toutes ses versions, de la plus récente à la plus ancienne. */
export interface DocumentDetailView extends DocumentView {
  versions: DocumentVersionView[];
}

/** Règles d'envoi publiées par l'API (taille maximale, extensions, catégories). */
export interface UploadRules {
  maxBytes: number;
  formats: string[];
  categories: { code: string; label: string }[];
}

