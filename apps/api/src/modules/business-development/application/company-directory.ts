/**
 * Ce que le module Formation (inscriptions) a le droit de savoir du module commercial : l'entreprise d'un apprenant (et son propriétaire,
 * dont dépend la portée), les agréments qui peuvent couvrir une inscription, et le rattachement d'un contact. Les agréments et les entreprises
 * restent la propriété du module commercial : Formation les lit, ne les modifie jamais.
 */
export interface CompanyRef {
  id: string;
  name: string;
  /** Chargé de compte propriétaire (la portée d'un apprenant ou d'une inscription est celle de son entreprise). */
  ownerUserId: string | null;
  archived: boolean;
}

export type ApprovalState = 'REQUESTED' | 'RECEIVED' | 'HONORED' | 'EXPIRED' | 'CANCELLED';

export interface ApprovalRef {
  id: string;
  companyId: string;
  status: ApprovalState;
  /** Somme globale couverte (texte décimal à deux décimales) ; absente si l'agrément ne couvre qu'un nombre de places. */
  amount: string | null;
  /** Nombre de places couvertes ; absent si l'agrément ne couvre qu'une somme. */
  places: number | null;
  currency: string;
  /** Fin de validité « AAAA-MM-JJ » (facultative). */
  validUntil: string | null;
  receivedOn: string | null;
  payerName: string | null;
}

export interface CompanyDirectory {
  company(id: string): Promise<CompanyRef | null>;
  /** Identifiants des entreprises dont le propriétaire est l'un de ces utilisateurs (la portée « Propre » ou « Équipe » d'un apprenant ou d'une inscription). */
  companyIdsOwnedBy(ownerIds: readonly string[]): Promise<string[]>;
  /** Le contact (non supprimé) appartient-il bien à cette entreprise ? */
  contactBelongsTo(contactId: string, companyId: string): Promise<boolean>;
  approval(id: string): Promise<ApprovalRef | null>;
  /** Les agréments de l'entreprise, du plus récent au plus ancien. */
  approvalsOf(companyId: string): Promise<ApprovalRef[]>;
  /** Verrouille l'agrément jusqu'à la fin de la transaction : deux inscriptions simultanées ne peuvent pas dépasser ses plafonds. */
  lockApproval(id: string): Promise<void>;
}

export const COMPANY_DIRECTORY = Symbol('CompanyDirectory');
