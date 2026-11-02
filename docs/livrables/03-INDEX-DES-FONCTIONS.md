# Index des fonctions et composants (généré)

> Document **généré** par `node scripts/gen-function-index.mjs` à partir des commentaires du code. Ne pas le modifier à la main : corriger le commentaire dans le fichier source, puis relancer le script.

**1242 déclarations commentées au total.**


## API (NestJS) — 881 déclarations commentées

### `app.module.ts`

| Déclaration | Rôle |
|---|---|
| `export class AppModule {}` | Module racine : assemble la plateforme (base, configuration, limitation de débit, garde CSRF globale) et les modules métier (audit, notifications, IAM, développement commercial). |

### `app.setup.ts`

| Déclaration | Rôle |
|---|---|
| `export function configureApp(app: INestApplication, config: AppConfig): void` | Configuration commune à l'application réelle et aux tests de bout en bout : ce que les tests exercent est exactement ce qui tourne en production. |

### `cli/create-admin.logic.ts`

| Déclaration | Rôle |
|---|---|
| `export interface AdminArgs` | Arguments de la commande `admin:create` : adresse e-mail et nom affiché du SuperAdmin à créer (jamais le mot de passe). |
| `export function parseAdminArgs(argv: readonly string[]): AdminArgs` | Lit `--email` et `--name`. |
| `export function askHidden(question: string, input: NodeJS.ReadStream = process.stdin, output: NodeJS.WriteStream = process.stdout): Promise<string>` | Saisie masquée d'une ligne au terminal (rien n'est affiché ni conservé). |

### `cli/create-admin.ts`

| Déclaration | Rôle |
|---|---|
| `async function main()` | Crée un compte SuperAdmin (le premier, puis le second : il en faut au moins deux, sans compte partagé). |

### `cli/create-demo-users.ts`

| Déclaration | Rôle |
|---|---|
| `async function main()` | Crée un compte de démonstration par rôle (développement et recette SEULEMENT). |

### `cli/demo-users.logic.ts`

| Déclaration | Rôle |
|---|---|
| `export interface DemoUser` | Compte de démonstration : adresse (domaine .test réservé, jamais joignable), nom fictif, rôle et responsable. |
| `export function generateDemoPassword(random: (size: number) => Buffer = randomBytes): string` | Mot de passe aléatoire propre à chaque compte (jamais un mot de passe commun ni prévisible). |
| `export function assertNotProduction(env: NodeJS.ProcessEnv = process.env): void` | Refuse toute exécution en production : ces comptes sont réservés au développement et à la recette. |

### `cli/seed-core.ts`

| Déclaration | Rôle |
|---|---|
| `async function main()` | `pnpm crm-api seed:core` — synchronise rôles et permissions (idempotent, sans utilisateur). |

### `main.ts`

| Déclaration | Rôle |
|---|---|
| `async function bootstrap()` | Démarre l'API : charge la configuration (refuse de démarrer si elle est dangereuse en production), monte l'application et écoute sur l'adresse locale uniquement. |

### `modules/audit/application/audit-reader.ts`

| Déclaration | Rôle |
|---|---|
| `export const LOGIN_HISTORY_WINDOW_DAYS = 90;` | Profondeur de l'historique des connexions affiché à l'utilisateur (jours). |
| `export const LOGIN_HISTORY_DEFAULT_LIMIT = 25;` | Nombre d'événements par page (par défaut et au maximum). |
| `export interface LoginEvent` | Une connexion telle que l'intéressé la voit. |
| `export interface LoginHistoryPage` | Page de l'historique : `nextBefore` est le curseur de la page suivante (nul s'il n'y en a pas). |
| `export interface AuditReader` | API publique de lecture du journal pour les autres modules (lecture seule, jamais d'écriture). |
| `loginHistory(query: { userId: string; before?: Date; limit?: number }): Promise<LoginHistoryPage>;` | Historique des connexions d'UN utilisateur, borné dans le temps, du plus récent au plus ancien. |
| `export function toLoginEvent(entry: AuditEntry): LoginEvent` | Entrée d'audit → événement de connexion affichable (aucun détail interne : motif, valeurs avant/après). |
| `export class DefaultAuditReader implements AuditReader` | Lecture de l'historique des connexions dans le journal d'audit (aucune table supplémentaire). |
| `async loginHistory(query: { userId: string; before?: Date; limit?: number }): Promise<LoginHistoryPage>` | Lit une page : fenêtre de 90 jours, taille bornée (25 par défaut, 100 au plus). |

### `modules/audit/application/audit-recorder.ts`

| Déclaration | Rôle |
|---|---|
| `export interface AuditRecord` | Ce qu'un cas d'usage fournit pour tracer une action : qui, dans quel module, sur quelle entité, quoi, avec l'ancienne et la nouvelle valeur. |
| `export interface AuditRecorder` | API publique d'audit pour les autres modules. |
| `export class DefaultAuditRecorder implements AuditRecorder` | Enregistreur d'audit par défaut : complète l'enregistrement (identifiant, horodatage) puis l'ajoute au journal en ajout seul. |
| `async record(record: AuditRecord): Promise<void>` | Ajoute une entrée au journal d'audit, dans la transaction en cours si elle existe (l'audit et l'action réussissent ou échouent ensemble). |

### `modules/audit/audit.module.ts`

| Déclaration | Rôle |
|---|---|
| `export class AuditModule {}` | Module d'audit : fournit l'enregistreur (`AUDIT_RECORDER`) et le lecteur (`AUDIT_READER`, historique des connexions) aux autres modules ; le journal est en ajout seul, partitionné par mois. |

### `modules/audit/domain/audit-entry.ts`

| Déclaration | Rôle |
|---|---|
| `export interface AuditEntry` | Entrée immuable du journal : qui, quoi, quand, d'où, avant, après. |

### `modules/audit/domain/audit-repository.ts`

| Déclaration | Rôle |
|---|---|
| `export interface LoginEventQuery` | Critères de lecture des événements de connexion d'UN utilisateur, dans une fenêtre de dates bornée. |
| `export interface AuditRepository` | Append-only : aucune méthode de modification ni de suppression. |
| `listLoginEvents(query: LoginEventQuery): Promise<AuditEntry[]>;` | Connexions réussies et échouées de l'utilisateur, de la plus récente à la plus ancienne. |

### `modules/audit/infrastructure/prisma-audit.repository.ts`

| Déclaration | Rôle |
|---|---|
| `const asJson = (value: Record<string, unknown> \| null)` | Convertit une valeur facultative en JSON Prisma (`null` devient NULL en base, pas la chaîne « null »). |
| `function toEntry(row:` | Ligne de la table d'audit → entrée du domaine. |
| `export class PrismaAuditRepository implements AuditRepository` | Écrit et relit le journal d'audit dans PostgreSQL (schéma `audit`). |
| `async append(entry: AuditEntry): Promise<void>` | Ajoute une entrée immuable au journal (acteur, session, IP, appareil, entité, action, avant/après). |
| `async listByEntity(entityType: string, entityId: string): Promise<AuditEntry[]>` | Historique d'une entité, du plus ancien au plus récent (500 entrées au plus). |
| `async listLoginEvents(query: LoginEventQuery): Promise<AuditEntry[]>` | Connexions (`LOGIN`) et échecs (`LOGIN_FAILED`) rattachés à l'utilisateur, dans la fenêtre demandée, du plus récent au plus ancien. |

### `modules/business-development/application/appointment-use-cases.ts`

| Déclaration | Rôle |
|---|---|
| `const resourceOf = (type: AppointmentType): 'visit' \| 'appointment' => (type === AppointmentType.Visit ? 'visit' : 'appointment');` | Une visite chez Investally relève du droit « visite » ; les rendez-vous avec le DAF ou le décideur, du droit « rendez-vous ». |
| `async function contactOf(contacts: ContactRepository, contactId: string \| null \| undefined, companyId: string): Promise<Contact \| null>` | Un contact lié à un rendez-vous appartient à l'entreprise du rendez-vous (sinon refus). |
| `async function appointmentInScope(` | Charge le rendez-vous et vérifie qu'il est dans la portée de son entreprise avec le droit demandé ; sinon « introuvable ». |
| `async function withConflicts(appointments: AppointmentRepository, appointment: Appointment, view: AppointmentView): Promise<AppointmentView>` | Avertit des rendez-vous à venir du même organisateur qui chevauchent le créneau ; ne bloque jamais (règle proposée, D35). |
| `export class PlanAppointmentUseCase` | Planifier un rendez-vous ou une visite : portée de l'entreprise, entreprise non archivée, contact et offre rattachés à cette entreprise ; l'heure ne peut pas être dans le passé ; un conflit d'horaire avertit sans bloquer ; audit. |
| `export class UpdateAppointmentUseCase` | Modifier un rendez-vous À VENIR (contact, durée, lieu, note) : portée, version lue, entreprise non archivée ; audit avant/après. |
| `export class TransitionAppointmentUseCase` | Reporter (nouvelle heure + motif), tenir (compte rendu) ou annuler (motif) un rendez-vous : portée, version lue, entreprise non archivée ; annuler exige le droit d'annuler (visite : de modifier) ; audit avant/après. |
| `export class GetAppointmentHandler` | Lecture d'un rendez-vous : hors de la portée de son entreprise, il est « introuvable ». |
| `export const MAX_AGENDA_DAYS = 63;` | Fenêtre d'agenda la plus large acceptée : neuf semaines, de quoi couvrir un mois affiché en grille. |
| `export class ListAppointmentsHandler` | L'agenda : rendez-vous visibles dans la fenêtre [from, to[, triés par début. |

### `modules/business-development/application/appointment-view.ts`

| Déclaration | Rôle |
|---|---|
| `export interface AppointmentConflict` | Un autre rendez-vous de l'organisateur qui chevauche celui-ci (avertissement, jamais un blocage). |
| `export interface AppointmentView` | Modèle de lecture d'un rendez-vous (jamais l'entité). |

### `modules/business-development/application/approval-document-owners.ts`

| Déclaration | Rôle |
|---|---|
| `export const APPROVAL_OWNER_TYPE = 'approval';` | Type d'objet propriétaire déclaré au module Documents pour les agréments (le document signé). |
| `export class ApprovalDocumentOwnerResolver implements DocumentOwnerResolver, OnModuleInit` | Résolveur des agréments pour les documents : un agrément n'est « résolu » que s'il existe ET si l'appelant peut le lire. |

### `modules/business-development/application/approval-use-cases.ts`

| Déclaration | Rôle |
|---|---|
| `async function opportunityInScope(` | L'opportunité et son entreprise, dans la portée de l'appelant pour la permission demandée ; sinon « introuvable ». |
| `async function approvalInScope(` | L'agrément, son opportunité et son entreprise, dans la portée de l'appelant pour la permission demandée ; sinon « introuvable ». |
| `export class RegisterApprovalUseCase` | Enregistrer l'agrément d'une opportunité : portée de son entreprise, entreprise non archivée, opportunité qui a franchi l'accord de principe et n'est pas perdue, un seul agrément actif par opportunité. |
| `export class CloseApprovalUseCase` | Honorer (le paiement a eu lieu), déclarer expiré ou annuler un agrément reçu : portée, version lue, entreprise non archivée ; le droit d'honorer est distinct de celui d'annuler ou d'expirer ; expirer et annuler exigent un motif. |
| `export class GetApprovalHandler` | Lecture d'un agrément : hors de la portée de son entreprise, il est « introuvable ». |
| `export class ListApprovalsHandler` | Les agréments visibles de l'appelant, le plus récent d'abord. |

### `modules/business-development/application/approval-view.ts`

| Déclaration | Rôle |
|---|---|
| `export interface ApprovalView` | Modèle de lecture d'un agrément (jamais l'entité). |

### `modules/business-development/application/company-document-owner.ts`

| Déclaration | Rôle |
|---|---|
| `export const COMPANY_OWNER_TYPE = 'company';` | Type d'objet propriétaire déclaré au module Documents pour les entreprises. |
| `export class CompanyDocumentOwnerResolver implements DocumentOwnerResolver, OnModuleInit` | Résolveur des entreprises pour les documents : une entreprise n'est « résolue » que si elle existe ET que l'appelant peut la lire (même règle de portée que la fiche entreprise). |
| `onModuleInit(): void` | Se déclare auprès du registre des documents au démarrage de l'application. |
| `async resolve(ownerId: string, access: AccessContext): Promise<{ ownerUserId: string \| null } \| null>` | Propriétaire de l'entreprise si elle existe et est lisible par l'appelant, sinon `null`. |

### `modules/business-development/application/company-lifecycle-use-cases.ts`

| Déclaration | Rôle |
|---|---|
| `async function loadInScope(companies: CompanyRepository, id: string, access: AccessContext, permission: string): Promise<Company>` | Une entreprise hors de la portée de l'appelant (pour la permission demandée) est « introuvable », comme une inexistante. |
| `export class ChangeCompanyStatusUseCase` | Cas d'usage : changer le statut d'une entreprise à la main (CU-C-05), d'un cran, avec le droit de modification. |
| `export class ReassignCompanyUseCase` | Cas d'usage : confier une entreprise à un autre propriétaire (D17). |
| `async function candidatesFor(owners: OwnerDirectory, access: AccessContext): Promise<OwnerSummary[]>` | Les propriétaires possibles dans la portée de l'appelant (droit de réattribution). |
| `export class ListOwnerCandidatesHandler` | Requête de lecture : à qui l'appelant peut-il confier une entreprise (liste du choix de la fenêtre de réattribution). |

### `modules/business-development/application/company-sheet.ts`

| Déclaration | Rôle |
|---|---|
| `export function esc(value: unknown): string` | Échappe le texte saisi par les utilisateurs : rien de ce qui est affiché ne peut être interprété comme du HTML. |
| `export const sheetReference = (company: CompanyView): string => `FIC-${company.id.replace(/-/g, '').slice(-8).toUpperCase()}`;` | Référence lisible du document : ne contient aucune donnée personnelle. |
| `export function renderCompanySheet(company: CompanyView, exportedAt: Date): string` | Fiche d'entreprise imprimable (HTML autonome, aux couleurs de l'application ; gabarit PROVISOIRE en attendant la charte des documents). |

### `modules/business-development/application/company-view.ts`

| Déclaration | Rôle |
|---|---|
| `export interface FacilitationView` | Facilitation telle qu'exposée : le facilitateur et la commission ne sont renseignés que si l'appelant y a droit. |
| `export interface CompanyView` | Modèle de lecture exposé par l'Application (pas l'entité). |
| `export interface FacilitationVisibility` | Ce que l'appelant a le droit de voir dans la facilitation. |
| `export function toCompanyView(company: Company, facilitation?: FacilitationVisibility, ownerName?: string \| null): CompanyView` | Transforme une entreprise du domaine en représentation publique (aucun objet interne n'est exposé). |

### `modules/business-development/application/contact-use-cases.ts`

| Déclaration | Rôle |
|---|---|
| `async function companyInScope(companies: CompanyRepository, id: string, access: AccessContext, permission: string): Promise<Company>` | Entreprise visible de l'appelant pour cette permission, sinon « introuvable » (même réponse qu'un identifiant inexistant). |
| `async function contactInScope(` | Contact et entreprise visibles de l'appelant (la visibilité d'un contact suit celle de son entreprise). |
| `async function assertNoDuplicate(contacts: ContactRepository, contact: Contact, allowDuplicate: boolean \| undefined, excludeId?: string): Promise<voi` | Un doublon probable (même entreprise, même nom ou même e-mail) est signalé par un conflit ; `allowDuplicate` permet de créer quand même (l'utilisateur a vu l'avertissement) : on propose la fiche existante plutôt que d'interdire. |
| `export class RegisterContactUseCase` | Créer un contact : l'entreprise doit être dans la portée de l'appelant et non archivée ; doublon signalé ; audit. |
| `export class UpdateContactUseCase` | Modifier un contact : portée de son entreprise, version lue, doublon, entreprise non archivée ; audit avant/après. |
| `export class DeleteContactUseCase` | Supprimer un contact (suppression logique) : droit de suppression et portée de son entreprise ; audit. |
| `export class GetContactHandler` | Lecture d'un contact : hors de la portée de son entreprise, il est « introuvable ». |
| `export class ListContactsHandler` | Liste paginée des contacts visibles ; filtrer par entreprise exige que cette entreprise soit dans la portée (sinon « introuvable »). |

### `modules/business-development/application/contact-view.ts`

| Déclaration | Rôle |
|---|---|
| `export interface ContactView` | Modèle de lecture d'un contact (jamais l'entité). |

### `modules/business-development/application/export-company-sheet.query.ts`

| Déclaration | Rôle |
|---|---|
| `export class ExportCompanySheetHandler` | Export de la fiche d'une entreprise. |

### `modules/business-development/application/facilitation-resolver.ts`

| Déclaration | Rôle |
|---|---|
| `export interface FacilitationInput` | Facilitateur à lier : un facilitateur existant (par identifiant) OU un nouveau, jamais les deux. |
| `export class FacilitationResolver` | Règles communes à la création et à la modification d'une entreprise : droits de l'appelant (facilitateur, commission), facilitateur retrouvé dans sa portée (sinon « introuvable », prévention d'IDOR) ou créé, validations faites AVANT toute écriture. |

### `modules/business-development/application/facilitator-queries.ts`

| Déclaration | Rôle |
|---|---|
| `export class ListFacilitatorsHandler` | Liste paginée des facilitateurs visibles par l'appelant (portée calculée depuis ses droits). |
| `export class GetFacilitatorHandler` | Lecture d'un facilitateur : hors portée → « introuvable » (404), comme pour une entreprise (prévention d'IDOR). |

### `modules/business-development/application/facilitator-view.ts`

| Déclaration | Rôle |
|---|---|
| `export interface FacilitatorView` | Modèle de lecture d'un facilitateur. |

### `modules/business-development/application/followup-closer.ts`

| Déclaration | Rôle |
|---|---|
| `export class PlannedFollowupsCloser` | Annule les relances encore à faire d'une offre qui n'est plus en cours (acceptée, refusée, retirée) : plus de relance après la réponse du client ou le retrait. |
| `async cancelPlanned(offer: Offer, companyName: string, reason: string, actor: ActorContext, now: Date): Promise<number>` | Annule les relances à faire de l'offre avec le motif donné ; renvoie leur nombre. |

### `modules/business-development/application/followup-use-cases.ts`

| Déclaration | Rôle |
|---|---|
| `async function followupInScope(` | Relance, offre et entreprise visibles de l'appelant : la visibilité d'une relance suit celle de l'entreprise de son offre. |
| `export class PlanFollowupUseCase` | Planifier une relance sur une offre EN COURS (déposée ou décharge reçue) : portée de son entreprise, entreprise non archivée, au plus trois relances par offre ; l'échéance ne peut pas être dans le passé ; audit. |
| `export class UpdateFollowupUseCase` | Modifier une relance À FAIRE : portée, version lue, entreprise non archivée ; audit avant/après. |
| `export class CloseFollowupUseCase` | Terminer une relance (avec son résultat) ou l'annuler (avec son motif) : portée, version lue, entreprise non archivée ; terminer exige le droit « terminer », annuler le droit de modifier ; audit avant/après. |
| `export class GetFollowupHandler` | Lecture d'une relance : hors de la portée de son entreprise, elle est « introuvable ». |
| `export class ListFollowupsHandler` | Liste paginée des relances visibles (la liste « À faire »), triée par échéance. |

### `modules/business-development/application/followup-view.ts`

| Déclaration | Rôle |
|---|---|
| `export interface FollowupView` | Modèle de lecture d'une relance (jamais l'entité). |

### `modules/business-development/application/get-company-overview.query.ts`

| Déclaration | Rôle |
|---|---|
| `export class GetCompanyOverviewHandler` | Requête de lecture : compteurs par statut et valeurs de filtre, dans la seule portée de l'appelant. |

### `modules/business-development/application/get-company.query.ts`

| Déclaration | Rôle |
|---|---|
| `export class GetCompanyHandler` | Lecture d'une entreprise par identifiant. |
| `async execute(query: { id: string; access: AccessContext }): Promise<CompanyView>` | Lit une entreprise. |

### `modules/business-development/application/list-companies.query.ts`

| Déclaration | Rôle |
|---|---|
| `export interface ListCompaniesQuery` | Paramètres de la liste : pagination, recherche et visibilité (calculée depuis les droits de l'appelant, jamais depuis la requête). |
| `export class ListCompaniesHandler` | Requête de lecture : liste paginée des entreprises visibles par l'appelant. |
| `async execute(query: ListCompaniesQuery): Promise<Page<CompanyView>>` | Borne la page et la taille de page, puis ne renvoie que les entreprises de la portée de l'appelant (propriétaires autorisés). |

### `modules/business-development/application/offer-document-owners.ts`

| Déclaration | Rôle |
|---|---|
| `export const OFFER_OWNER_TYPE = 'offer';` | Types d'objets propriétaires déclarés au module Documents pour les offres et leurs décharges. |
| `export class OfferDocumentOwnerResolver implements DocumentOwnerResolver, OnModuleInit` | Résolveur des offres pour les documents (le fichier de l'offre envoyé au client) : une offre n'est « résolue » que si elle existe ET si l'appelant peut la lire. |
| `export class ReceiptDocumentOwnerResolver implements DocumentOwnerResolver, OnModuleInit` | Résolveur des décharges pour les documents (la décharge signée) : même règle, par le droit de lire les décharges. |

### `modules/business-development/application/offer-use-cases.ts`

| Déclaration | Rôle |
|---|---|
| `export async function companyInScope(companies: CompanyRepository, id: string, access: AccessContext, permission: string): Promise<Company>` | Entreprise visible de l'appelant pour cette permission, sinon « introuvable » (même réponse qu'un identifiant inexistant). |
| `export async function offerInScope(` | Offre et entreprise visibles de l'appelant (la visibilité d'une offre suit celle de son entreprise). |
| `export class RegisterOfferUseCase` | Créer une offre (brouillon) : l'entreprise doit être dans la portée de l'appelant et non archivée ; référence attribuée ; audit. |
| `export class UpdateOfferUseCase` | Modifier un brouillon : portée de son entreprise, version lue, entreprise non archivée ; audit avant/après. |
| `export class ChangeOfferStatusUseCase` | Changer l'état d'une offre (déposer, accepter, refuser, retirer) : portée, version lue, entreprise non archivée, transition permise ; audit. |
| `export class GetOfferHandler` | Lecture d'une offre : hors de la portée de son entreprise, elle est « introuvable ». |
| `export class ListOffersHandler` | Liste paginée des offres visibles ; filtrer par entreprise exige que cette entreprise soit dans la portée (sinon « introuvable »). |

### `modules/business-development/application/offer-view.ts`

| Déclaration | Rôle |
|---|---|
| `export interface OfferView` | Modèle de lecture d'une offre (jamais l'entité). |

### `modules/business-development/application/opportunity-use-cases.ts`

| Déclaration | Rôle |
|---|---|
| `async function opportunityInScope(` | Opportunité et entreprise visibles de l'appelant (la visibilité d'une opportunité suit celle de son entreprise). |
| `export class CreateOpportunityUseCase` | Créer une opportunité (à « Qualification ») : l'entreprise doit être dans la portée de l'appelant et non archivée ; audit. |
| `abstract class OpportunityChange<C extends { id: string; version: number; access: AccessContext; actor: ActorContext }>` | Les cas d'usage qui changent une opportunité existante partagent la même séquence : portée, version, règle du domaine, audit. |
| `export class UpdateOpportunityUseCase extends OpportunityChange<UpdateOpportunityCommand>` | Modifier une opportunité OUVERTE (intitulé, montant, devise, source) : portée, version lue ; audit avant/après. |
| `export class AdvanceOpportunityUseCase extends OpportunityChange<AdvanceOpportunityCommand>` | Passer à l'étape suivante (jamais plus loin, jamais en arrière). |
| `export class GrantWaiverUseCase extends OpportunityChange<GrantWaiverCommand>` | Accorder la dérogation à la règle du rendez-vous décideur (Responsable commercial) : justification obligatoire, tracée. |
| `export class CloseOpportunityUseCase extends OpportunityChange<CloseOpportunityCommand>` | Clore une opportunité : « perdue » (chargé de compte pour les siennes, motif obligatoire) ou « gagnée » (Responsable commercial seulement, une fois l'accord de principe obtenu) ; décision D28. |
| `export class GetOpportunityHandler` | Lecture d'une opportunité : hors de la portée de son entreprise, elle est « introuvable ». |
| `export class ListOpportunitiesHandler` | Liste paginée des opportunités visibles (cartes et vue par étape), la plus récemment modifiée d'abord. |

### `modules/business-development/application/opportunity-view.ts`

| Déclaration | Rôle |
|---|---|
| `export interface OpportunityView` | Modèle de lecture d'une opportunité (jamais l'entité). |

### `modules/business-development/application/receipt-use-cases.ts`

| Déclaration | Rôle |
|---|---|
| `async function receiptInScope(` | Décharge, offre et entreprise visibles de l'appelant : la visibilité d'une décharge suit celle de l'entreprise de son offre. |
| `export class RegisterReceiptUseCase` | Enregistrer la décharge d'une offre DÉPOSÉE : portée de son entreprise, entreprise non archivée, une seule décharge valide ; l'offre passe à « décharge reçue ». |
| `export class CancelReceiptUseCase` | Annuler une décharge (saisie erronée, mauvais fichier) avec un motif : portée, version lue, entreprise non archivée ; l'offre redevient « déposée » et attend sa décharge. |
| `export class GetReceiptHandler` | Lecture d'une décharge : hors de la portée de son entreprise, elle est « introuvable ». |
| `export class ListReceiptsHandler` | Décharges d'une offre (annulées comprises) ; l'offre doit être dans la portée de l'appelant, sinon « introuvable ». |

### `modules/business-development/application/receipt-view.ts`

| Déclaration | Rôle |
|---|---|
| `export interface ReceiptView` | Modèle de lecture d'une décharge (jamais l'entité). |

### `modules/business-development/application/register-company.use-case.ts`

| Déclaration | Rôle |
|---|---|
| `export interface RegisterCompanyCommand` | Données d'enregistrement d'une entreprise cible ; le propriétaire vient de l'identité de l'appelant, jamais du corps de la requête. |
| `export class RegisterCompanyUseCase` | Cas d'usage : enregistrer une entreprise cible, refuser un doublon de nom, tracer l'opération. |
| `async execute(command: RegisterCompanyCommand): Promise<CompanyView>` | Crée l'entreprise, son éventuel facilitateur et leur audit dans une même transaction ; un nom déjà pris (sans tenir compte de la casse ni des espaces) est un conflit. |

### `modules/business-development/application/register-facilitator.use-case.ts`

| Déclaration | Rôle |
|---|---|
| `export class RegisterFacilitatorUseCase` | Cas d'usage : enregistrer un facilitateur réutilisable et tracer l'opération. |
| `async executeInTransaction(command: RegisterFacilitatorCommand): Promise<FacilitatorView>` | Corps du cas d'usage, appelable depuis une transaction déjà ouverte (création d'entreprise avec facilitateur). |

### `modules/business-development/application/update-company.use-case.ts`

| Déclaration | Rôle |
|---|---|
| `export interface UpdateCompanyCommand` | Modification d'une fiche d'entreprise. |
| `export class UpdateCompanyUseCase` | Cas d'usage : modifier une entreprise. |
| `private async fullView(company: Parameters<typeof toCompanyView>[0], known: ReturnType<typeof toFacilitatorView> \| null = null): Promise<CompanyView>` | Vue complète (commission comprise) pour l'audit : lisible des seuls détenteurs de `audit.log.read`. |

### `modules/business-development/business-development.module.ts`

| Déclaration | Rôle |
|---|---|
| `export class BusinessDevelopmentModule {}` | Module « Développement commercial » : entreprises cibles et facilitateurs (premières briques du pipeline commercial). |

### `modules/business-development/domain/appointment-repository.ts`

| Déclaration | Rôle |
|---|---|
| `export interface AppointmentListItem` | Un rendez-vous avec son entreprise, son contact et son offre (pour les listes). |
| `export interface AppointmentRepository` | Port de persistance des rendez-vous. |
| `save(appointment: Appointment): Promise<void>;` | Crée ou met à jour ; une modification sur une version périmée est un conflit (verrou optimiste). |
| `findConflicts(query: { organizerUserId: string; startsAt: Date; endsAt: Date; excludeId?: string }): Promise<AppointmentListItem[]>;` | Rendez-vous À VENIR de l'organisateur qui chevauchent le créneau (hors `excludeId`) : sert à avertir d'un conflit d'horaire. |
| `list(query: AppointmentListQuery): Promise<Page<AppointmentListItem>>;` | Tri : début, puis création. |

### `modules/business-development/domain/appointment.ts`

| Déclaration | Rôle |
|---|---|
| `export const DEFAULT_APPOINTMENT_MINUTES = 60;` | Durée proposée, minimale et maximale d'un rendez-vous, en minutes : valeurs proposées, à confirmer. |
| `function required(raw: string \| undefined, label: string, max: number): string` | Texte obligatoire (compte rendu, motif) : trois caractères au moins, la limite donnée au plus. |
| `export class Appointment extends AggregateRoot` | Rendez-vous ou visite d'une entreprise, dans l'agenda de son organisateur. |
| `static plan(input:` | Planifie un rendez-vous ; l'heure de début ne peut pas être dans le passé. |
| `edit(changes: { durationMinutes?: number; location?: string \| null; note?: string \| null; contactId?: string \| null }): void` | Modifie la durée, le lieu, la note ou le contact d'un rendez-vous À VENIR (le changement d'horaire passe par le report). |
| `postpone(startsAt: Date \| string, reason: string \| undefined, now: Date): void` | Reporte le rendez-vous à une autre heure (dans le futur) ; le motif est obligatoire et le rendez-vous reste « à venir ». |
| `hold(report: string \| undefined, now: Date): void` | Marque le rendez-vous tenu avec son compte rendu (obligatoire) ; impossible avant son heure de début. |
| `cancel(reason: string \| undefined, now: Date): void` | Annule le rendez-vous avec un motif (obligatoire). |
| `get endsAt(): Date { return new Date(this.props.startsAt.getTime() + this.props.durationMinutes * 60000); }` | Fin du rendez-vous. |
| `overlaps(other: { startsAt: Date; endsAt: Date }): boolean` | Vrai si les deux créneaux se chevauchent (fin exclusive : deux rendez-vous bout à bout ne se chevauchent pas). |
| `isReportDue(now: Date): boolean` | Vrai si le rendez-vous est à venir et son heure de début est passée : un compte rendu est attendu (calculé, jamais stocké). |

### `modules/business-development/domain/approval-repository.ts`

| Déclaration | Rôle |
|---|---|
| `export interface ApprovalListItem` | Un agrément avec le nom de son entreprise et l'intitulé de son opportunité (pour les listes). |
| `export interface ApprovalRepository` | Port de persistance des agréments. |
| `save(approval: Approval): Promise<void>;` | Crée ou met à jour ; une version périmée est un conflit ; un second agrément actif pour la même opportunité aussi. |
| `findActiveByOpportunity(opportunityId: string): Promise<Approval \| null>;` | L'agrément actif (reçu ou honoré) de l'opportunité, s'il existe. |
| `list(query: ApprovalListQuery): Promise<Page<ApprovalListItem>>;` | Tri : le plus récent d'abord. |

### `modules/business-development/domain/approval.ts`

| Déclaration | Rôle |
|---|---|
| `function isoDate(raw: string \| null \| undefined, label: string): string` | Date « AAAA-MM-JJ » réelle (le 31 février n'existe pas), sinon refusée. |
| `function reasonOf(raw: string \| undefined, label: string): string` | Motif obligatoire (expiration, annulation) : trois caractères au moins, 500 au plus. |
| `export class Approval extends AggregateRoot` | Agrément : promesse de paiement signée par l'entreprise cliente (payeur : le client seulement, D2) pour une opportunité qui a franchi l'accord de principe. |
| `static register(input:` | Enregistre un agrément reçu. |
| `honor(now: Date): void` | Constate que la promesse a été tenue (le paiement a eu lieu). |
| `expire(reason: string \| undefined, now: Date): void` | Déclare l'agrément expiré (sa validité est passée), avec un motif ; expiration manuelle (D3). |
| `cancel(reason: string \| undefined, now: Date): void` | Annule l'agrément (saisie erronée, renoncement du client) avec un motif ; il ne revient pas. |
| `isPastValidity(today: string): boolean` | Vrai si la date de fin de validité est passée (sert à signaler « à expirer » ; l'expiration reste manuelle). |

### `modules/business-development/domain/commission.ts`

| Déclaration | Rôle |
|---|---|
| `export const DEFAULT_CURRENCY = 'XAF';` | Devise par défaut d'un montant fixe : franc CFA d'Afrique centrale (décision du 2026-10-29). |
| `export class Commission` | Objet-valeur : commission du facilitateur, soit un montant fixe dans une devise (ISO 4217), soit un pourcentage (jusqu'à 100). |

### `modules/business-development/domain/company-name.ts`

| Déclaration | Rôle |
|---|---|
| `export class CompanyName` | Objet-valeur : nom d'entreprise normalisé (espaces nettoyés, longueur bornée) avec une clé de comparaison sans casse. |
| `get normalized(): string` | Clé de comparaison pour la détection de doublons. |

### `modules/business-development/domain/company-overview-reader.ts`

| Déclaration | Rôle |
|---|---|
| `export interface CompanyOverview` | Synthèse de la liste des entreprises : effectifs par statut et valeurs disponibles pour les filtres. |
| `export interface CompanyOverviewReader` | Port de lecture de la synthèse : compteurs par statut et valeurs de filtre, toujours bornés à la portée de l'appelant. |
| `overview(query: { ownerIds?: readonly string[]; search?: string; country?: string; sector?: string }): Promise<CompanyOverview>;` | `ownerIds` : mêmes règles que la liste (liste vide = aucune ; absent = portée Tous). |

### `modules/business-development/domain/company-repository.ts`

| Déclaration | Rôle |
|---|---|
| `export const COMPANY_SORT_FIELDS = ['createdAt', 'name', 'country', 'sector', 'status'] as const;` | Colonnes sur lesquelles la liste peut être triée. |
| `export interface CompanyListQuery` | Paramètres de la liste : pagination, recherche, filtres (statut, pays, secteur), tri et portée. |
| `export interface CompanyRepository` | Port de persistance des entreprises : enregistrer, retrouver, tester l'unicité du nom et lister selon les propriétaires autorisés. |
| `list(query: CompanyListQuery): Promise<Page<Company>>;` | `ownerIds` : restreint aux entreprises de ces propriétaires (liste vide = aucune) ; absent = pas de restriction (portée Tous). |

### `modules/business-development/domain/company.ts`

| Déclaration | Rôle |
|---|---|
| `export interface CompanyProps` | État interne d'une entreprise (identité, nom, statut, propriétaire, horodatages). |
| `export class Company extends AggregateRoot` | Entreprise cible : racine d'agrégat du pipeline commercial. |
| `static rehydrate(props: CompanyProps): Company` | Reconstitution depuis la persistance : aucun événement émis. |
| `update(changes:` | Modifie les informations de la fiche. |
| `changeStatus(next: CompanyStatus, context: { contactCount: number }): void` | Change le statut à la main, d'un cran. |
| `reassign(newOwnerUserId: string): void` | Confie l'entreprise à un autre propriétaire (la portée des droits suit). |
| `becomeClient(): void` | Un agrément reçu fait de l'entreprise une cliente (flux C5) ; refusé si elle est archivée, sans effet si elle l'est déjà. |
| `archive(): void` | Archive l'entreprise ; refuse de l'archiver deux fois (règle métier). |

### `modules/business-development/domain/contact-info.ts`

| Déclaration | Rôle |
|---|---|
| `export function normalizeEmail(raw: string \| null \| undefined): string \| null` | Normalise une adresse e-mail facultative : minuscules, forme simple `x@y.z`, 200 caractères au plus. |
| `export function normalizePhone(raw: string \| null \| undefined, options: { required: boolean }): string \| null` | Normalise un numéro de téléphone : chiffres, espaces, `+ - . |

### `modules/business-development/domain/contact-repository.ts`

| Déclaration | Rôle |
|---|---|
| `export interface ContactListItem` | Un contact et le nom de son entreprise (pour les listes). |
| `export interface ContactRepository` | Port de persistance des contacts. |
| `remove(id: string): Promise<void>;` | Suppression logique : le contact disparaît partout. |
| `countByCompany(companyId: string): Promise<number>;` | Nombre de contacts non supprimés de l'entreprise. |
| `findDuplicates(query: { companyId: string; nameKey: string; emailKey: string \| null; excludeId?: string }): Promise<Contact[]>;` | Contacts non supprimés de la même entreprise portant le même nom OU le même e-mail (hors `excludeId`). |

### `modules/business-development/domain/contact.ts`

| Déclaration | Rôle |
|---|---|
| `export const contactNameKey = (lastName: string, firstName: string): string => `${lastName} ${firstName}`.toLocaleLowerCase('fr');` | Clé de comparaison du nom pour la détection de doublons : prénom et nom, sans casse ni espaces superflus. |
| `export class Contact extends AggregateRoot` | Contact : interlocuteur d'une entreprise (DAF, décideur…). |
| `static rehydrate(props: ContactProps): Contact` | Reconstitution depuis la persistance. |
| `update(changes: { lastName?: string; firstName?: string; role?: string; email?: string \| null; phone?: string \| null }): void` | Modifie les champs donnés (absent = inchangé, chaîne vide = champ facultatif effacé) ; tout ou rien en cas d'erreur. |

### `modules/business-development/domain/events/approval-received.ts`

| Déclaration | Rôle |
|---|---|
| `export class ApprovalReceived implements DomainEvent` | Événement de domaine : un agrément vient d'être reçu pour une opportunité (« agrément accordé », flux F1). |

### `modules/business-development/domain/events/company-registered.ts`

| Déclaration | Rôle |
|---|---|
| `export class CompanyRegistered implements DomainEvent` | Événement de domaine : une entreprise vient d'être enregistrée (sera publié vers d'autres contextes plus tard). |

### `modules/business-development/domain/facilitation.ts`

| Déclaration | Rôle |
|---|---|
| `export class Facilitation` | Lien entre une entreprise et son facilitateur : méthode de contact, appartenance, commission éventuelle. |
| `static assertMethod(method: string): void` | Refuse une méthode inconnue ; appelable avant toute écriture. |

### `modules/business-development/domain/facilitator-repository.ts`

| Déclaration | Rôle |
|---|---|
| `export interface FacilitatorRepository` | Port de persistance des facilitateurs. |
| `list(query: { page: number; pageSize: number; search?: string; ownerIds?: readonly string[] }): Promise<Page<Facilitator>>;` | `ownerIds` : restreint aux facilitateurs de ces propriétaires (liste vide = aucun) ; absent = pas de restriction. |

### `modules/business-development/domain/facilitator.ts`

| Déclaration | Rôle |
|---|---|
| `export class Facilitator extends AggregateRoot` | Facilitateur : personne qui met en relation avec une entreprise (parfois un employé de celle-ci). |
| `static rehydrate(props: FacilitatorProps): Facilitator` | Reconstitution depuis la persistance. |

### `modules/business-development/domain/followup-repository.ts`

| Déclaration | Rôle |
|---|---|
| `export interface FollowupListItem` | Une relance avec l'offre et l'entreprise (pour les listes). |
| `export type FollowupDue = 'overdue' \| 'today' \| 'upcoming';` | Filtre sur l'échéance des relances À FAIRE : en retard (avant aujourd'hui), aujourd'hui, à venir (après aujourd'hui). |
| `export interface FollowupRepository` | Port de persistance des relances. |
| `save(followup: Followup): Promise<void>;` | Crée ou met à jour ; une modification sur une version périmée est un conflit (verrou optimiste). |
| `listByOffer(offerId: string): Promise<Followup[]>;` | Relances d'une offre, les plus récentes d'abord (annulées comprises). |
| `countActiveByOffer(offerId: string): Promise<number>;` | Nombre de relances de l'offre qui comptent dans la limite (à faire ou terminées ; pas les annulées). |
| `listPlannedByOffer(offerId: string): Promise<Followup[]>;` | Relances de l'offre encore à faire (pour les annuler quand l'offre n'est plus en cours). |
| `list(query: { page: number; pageSize: number; status?: FollowupStatus; due?: FollowupDue; today: string; offerId?: string; ownerIds?: readonly string[` | `today` : « AAAA-MM-JJ » (UTC) pour situer les échéances. |

### `modules/business-development/domain/followup.ts`

| Déclaration | Rôle |
|---|---|
| `export const MAX_FOLLOWUPS_PER_OFFER = 3;` | Au plus trois relances par offre (terminées ou à faire ; les annulées ne comptent pas) : valeur proposée, à confirmer. |
| `function required(raw: string \| undefined, label: string, max: number): string` | Texte obligatoire (résultat, motif) : trois caractères au moins, la limite donnée au plus. |
| `export class Followup extends AggregateRoot` | Relance d'une offre en cours : à faire à une échéance, par un canal. |
| `static plan(input: { id: string; offerId: string; dueOn: string; channel: string; note?: string \| null; now: Date }): Followup` | Planifie une relance ; l'échéance ne peut pas être dans le passé. |
| `edit(changes: { dueOn?: string; channel?: string; note?: string \| null }, now: Date): void` | Modifie l'échéance, le canal ou la note d'une relance À FAIRE. |
| `complete(result: string \| undefined, now: Date): void` | Termine la relance avec son résultat (obligatoire : ce qui s'est dit ou décidé). |
| `cancel(reason: string \| undefined, now: Date): void` | Annule la relance avec un motif (obligatoire) ; l'annulation automatique, quand l'offre n'est plus en cours, y a aussi son motif. |
| `isOverdue(now: Date): boolean` | Vrai si la relance est à faire et son échéance dépassée. |

### `modules/business-development/domain/offer-repository.ts`

| Déclaration | Rôle |
|---|---|
| `export interface OfferListItem` | Une offre et le nom de son entreprise (pour les listes). |
| `export interface OfferRepository` | Port de persistance des offres. |
| `save(offer: Offer): Promise<void>;` | Crée ou met à jour ; une modification sur une version périmée est un conflit (verrou optimiste). |
| `nextReference(year: number): Promise<string>;` | Prochaine référence « OFF-2026-0001 » : compteur par année, sans trou ni doublon (transactionnel). |

### `modules/business-development/domain/offer.ts`

| Déclaration | Rôle |
|---|---|
| `export class Offer extends AggregateRoot` | Offre faite à une entreprise : sa visibilité suit celle de l'entreprise. |
| `edit(changes: { subject?: string; amount?: string \| number; currency?: string; note?: string \| null }): void` | Modifie les champs donnés ; seulement tant que l'offre est un brouillon (déposée, elle ne change plus). |
| `submit(now: Date): void` | Dépôt chez l'entreprise : brouillon → déposée. |
| `receiptReceived(): void` | La décharge signée est enregistrée : déposée → décharge reçue. |
| `receiptCancelled(): void` | La décharge est annulée : décharge reçue → déposée (l'offre attend de nouveau sa décharge). |
| `accept(now: Date): void` | Le client accepte. |
| `refuse(now: Date): void` | Le client refuse. |
| `withdraw(reason: string \| undefined, now: Date): void` | Retrait avec motif obligatoire, tant que le client n'a pas répondu. |
| `get isOpen(): boolean` | Les relances et la décharge n'ont de sens que pour une offre en cours. |

### `modules/business-development/domain/opportunity-repository.ts`

| Déclaration | Rôle |
|---|---|
| `export interface OpportunityListItem` | Une opportunité avec le nom de son entreprise (pour les listes). |
| `export interface OpportunityRepository` | Port de persistance des opportunités. |
| `save(opportunity: Opportunity): Promise<void>;` | Crée ou met à jour ; une modification sur une version périmée est un conflit (verrou optimiste). |
| `list(query: OpportunityListQuery): Promise<Page<OpportunityListItem>>;` | Tri : dernière activité d'abord, puis identifiant. |
| `export interface DecisionMakerMeetings` | Lecture des rendez-vous décideur tenus (règle de l'accord de principe, flux F1). |

### `modules/business-development/domain/opportunity-totals.ts`

| Déclaration | Rôle |
|---|---|
| `export interface CurrencyTotal` | Montant total d'une devise. |
| `export interface OpenOpportunities` | Les opportunités OUVERTES d'une entreprise : leur nombre et leur valeur, devise par devise (on n'additionne jamais deux devises). |
| `export interface OpportunityTotals` | Port de lecture de la valeur des opportunités ouvertes, par entreprise (colonne « Valeur » du tableau des entreprises). |
| `openByCompany(companyIds: readonly string[]): Promise<ReadonlyMap<string, OpenOpportunities>>;` | Les entreprises sans opportunité ouverte sont absentes du résultat. |

### `modules/business-development/domain/opportunity.ts`

| Déclaration | Rôle |
|---|---|
| `function required(raw: string \| undefined, label: string, max: number): string` | Texte obligatoire (justification, précision) : trois caractères au moins, la limite donnée au plus. |
| `export class Opportunity extends AggregateRoot` | Opportunité commerciale d'une entreprise (plusieurs en même temps possibles) : sa visibilité suit celle de l'entreprise. |
| `static create(input:` | Crée une opportunité : elle commence à « Qualification ». |
| `edit(changes: { title?: string; amount?: string \| number; currency?: string; source?: string }): void` | Modifie l'intitulé, le montant, la devise ou la source d'une opportunité OUVERTE. |
| `get nextStage(): OpportunityStage \| null` | L'étape qui suit l'étape actuelle ; `null` à la dernière. |
| `advance(context: { decisionMakerMeetingHeld: boolean }, now: Date): void` | Passe à l'étape suivante, jamais plus loin ni en arrière. |
| `grantWaiver(reason: string \| undefined, now: Date): void` | Accorde la dérogation à la règle du rendez-vous décideur (justification obligatoire) ; une seule fois, avant l'accord de principe. |
| `closeLost(reason: string \| undefined, note: string \| null \| undefined, now: Date): void` | Clôture « perdue » avec un motif de la liste fermée ; « autre » exige une précision. |
| `closeWon(now: Date): void` | Clôture « gagnée » : au plus tôt une fois l'accord de principe obtenu. |

### `modules/business-development/domain/owner-directory.ts`

| Déclaration | Rôle |
|---|---|
| `export interface OwnerSummary` | Une personne qui peut porter des entreprises (utilisateur actif au rôle commercial). |
| `export interface OwnerDirectory` | Port de l'annuaire des propriétaires : qui peut recevoir une entreprise, et comment s'appelle un propriétaire. |
| `candidates(ids?: readonly string[]): Promise<OwnerSummary[]>;` | Les utilisateurs actifs au rôle commercial parmi `ids` (tous si `ids` est absent), triés par nom. |
| `names(ids: readonly string[]): Promise<ReadonlyMap<string, string>>;` | Le nom de chaque identifiant connu (les inconnus sont absents du résultat). |

### `modules/business-development/domain/receipt-repository.ts`

| Déclaration | Rôle |
|---|---|
| `export interface ReceiptRepository` | Port de persistance des décharges. |
| `save(receipt: Receipt): Promise<void>;` | Crée ou met à jour ; une modification sur une version périmée est un conflit (verrou optimiste). |
| `listByOffer(offerId: string): Promise<Receipt[]>;` | Décharges d'une offre, la plus récente d'abord, annulées comprises (l'historique reste lisible). |

### `modules/business-development/domain/receipt.ts`

| Déclaration | Rôle |
|---|---|
| `function isoDate(raw: string \| undefined): string` | Date « AAAA-MM-JJ » réelle (le 31 février n'existe pas), sinon refusée. |
| `export class Receipt extends AggregateRoot` | Décharge signée par l'entreprise pour une offre déposée. |
| `static register(input: { id: string; offerId: string; receivedOn: string; receivedBy: string; offerSubmittedAt: Date \| null; now: Date }): Receipt` | Enregistre une décharge. |
| `cancel(reason: string \| undefined, now: Date): void` | Annule la décharge (saisie erronée, mauvais fichier) avec un motif obligatoire ; une décharge annulée ne revient pas. |

### `modules/business-development/infrastructure/prisma-appointment.repository.ts`

| Déclaration | Rôle |
|---|---|
| `export class PrismaAppointmentRepository implements AppointmentRepository` | Persistance PostgreSQL des rendez-vous (jamais supprimés : on les tient ou on les annule, avec un texte). |
| `async save(appointment: Appointment): Promise<void>` | Crée ou met à jour le rendez-vous ; une modification sur une version périmée est un conflit (verrou optimiste). |
| `async findConflicts(query: { organizerUserId: string; startsAt: Date; endsAt: Date; excludeId?: string }): Promise<AppointmentListItem[]>` | Une durée s'exprimant en minutes, le chevauchement se calcule en SQL sur l'heure de début et la durée. |

### `modules/business-development/infrastructure/prisma-approval.repository.ts`

| Déclaration | Rôle |
|---|---|
| `export class PrismaApprovalRepository implements ApprovalRepository` | Persistance PostgreSQL des agréments (jamais supprimés : on les honore, les déclare expirés ou les annule, avec un motif). |
| `async save(approval: Approval): Promise<void>` | Crée ou met à jour l'agrément ; une modification sur une version périmée est un conflit (verrou optimiste). |

### `modules/business-development/infrastructure/prisma-company-overview.reader.ts`

| Déclaration | Rôle |
|---|---|
| `export class PrismaCompanyOverviewReader implements CompanyOverviewReader` | Synthèse PostgreSQL : compteurs par statut (recherche, pays, secteur appliqués) et valeurs de filtre de la portée. |

### `modules/business-development/infrastructure/prisma-company.repository.ts`

| Déclaration | Rôle |
|---|---|
| `function toDomain(row: CompanyRow): Company` | Reconstruit une entreprise du domaine à partir d'une ligne de base de données. |
| `export class PrismaCompanyRepository implements CompanyRepository` | Persistance PostgreSQL des entreprises (suppression logique : une entreprise supprimée est ignorée partout). |
| `async save(company: Company): Promise<void>` | Crée ou met à jour l'entreprise (clé de nom normalisée pour l'unicité). |
| `private async syncFacilitation(company: Company): Promise<void>` | Aligne le lien avec le facilitateur sur l'entreprise : créé, remplacé ou retiré (modification d'une fiche existante). |
| `async findById(id: string): Promise<Company \| null>` | Retrouve une entreprise non supprimée, ou `null`. |
| `async existsByName(name: CompanyName): Promise<boolean>` | Vrai si une entreprise non supprimée porte déjà ce nom (comparaison sans casse). |
| `async list(query: CompanyListQuery): Promise<Page<Company>>` | Liste paginée, la plus récente d'abord ; `ownerIds` restreint aux propriétaires autorisés (liste vide = aucune entreprise), absent = aucune restriction. |
| `export function companyWhere(query: { ownerIds?: readonly string[]; search?: string; status?: CompanyStatus; country?: string; sector?: string }): Pri` | Filtre commun à la liste et à la synthèse : suppression logique, portée, recherche, pays et secteur (statut en plus pour la liste). |
| `function orderFor(field: CompanySortField, direction: 'asc' \| 'desc'): Prisma.CompanyOrderByWithRelationInput[]` | Tri demandé ; les valeurs absentes (pays, secteur) passent toujours en dernier. |

### `modules/business-development/infrastructure/prisma-contact.repository.ts`

| Déclaration | Rôle |
|---|---|
| `export class PrismaContactRepository implements ContactRepository` | Persistance PostgreSQL des contacts (suppression logique). |
| `async save(contact: Contact): Promise<void>` | Crée ou met à jour le contact ; une modification sur une version périmée est un conflit (verrou optimiste). |

### `modules/business-development/infrastructure/prisma-facilitator.repository.ts`

| Déclaration | Rôle |
|---|---|
| `export class PrismaFacilitatorRepository implements FacilitatorRepository` | Persistance PostgreSQL des facilitateurs. |
| `async save(facilitator: Facilitator): Promise<void>` | Crée le facilitateur (aucune modification n'existe encore : seule la création est possible). |
| `async list(query: { page: number; pageSize: number; search?: string; ownerIds?: readonly string[] }): Promise<Page<Facilitator>>` | Liste paginée, la plus récente d'abord ; `ownerIds` restreint aux propriétaires autorisés. |

### `modules/business-development/infrastructure/prisma-followup.repository.ts`

| Déclaration | Rôle |
|---|---|
| `export class PrismaFollowupRepository implements FollowupRepository` | Persistance PostgreSQL des relances (jamais supprimées : on les termine ou on les annule, avec un texte). |
| `async save(followup: Followup): Promise<void>` | Crée ou met à jour la relance ; une modification sur une version périmée est un conflit (verrou optimiste). |

### `modules/business-development/infrastructure/prisma-offer.repository.ts`

| Déclaration | Rôle |
|---|---|
| `export class PrismaOfferRepository implements OfferRepository` | Persistance PostgreSQL des offres (jamais supprimées : on les retire). |
| `async save(offer: Offer): Promise<void>` | Crée ou met à jour l'offre ; une modification sur une version périmée est un conflit (verrou optimiste). |
| `async nextReference(year: number): Promise<string>` | Incrémente le compteur de l'année dans la transaction en cours : deux créations simultanées ne partagent jamais un numéro. |

### `modules/business-development/infrastructure/prisma-opportunity-totals.ts`

| Déclaration | Rôle |
|---|---|
| `export class PrismaOpportunityTotals implements OpportunityTotals` | Somme des opportunités ouvertes par entreprise et par devise, calculée par la base (une requête, quel que soit le nombre d'entreprises). |

### `modules/business-development/infrastructure/prisma-opportunity.repository.ts`

| Déclaration | Rôle |
|---|---|
| `export class PrismaOpportunityRepository implements OpportunityRepository` | Persistance PostgreSQL des opportunités (jamais supprimées : on les clôt, gagnées ou perdues). |
| `async save(opportunity: Opportunity): Promise<void>` | Crée ou met à jour l'opportunité ; une modification sur une version périmée est un conflit (verrou optimiste). |
| `export class PrismaDecisionMakerMeetings implements DecisionMakerMeetings` | Les rendez-vous « décideur » tenus d'une entreprise (agenda, S4.2d) : la règle de l'accord de principe les compte. |

### `modules/business-development/infrastructure/prisma-owner-directory.ts`

| Déclaration | Rôle |
|---|---|
| `const OWNER_ROLE_CODES = ['ACCOUNT_MANAGER', 'HEAD_OF_SALES', 'SUPER_ADMIN'];` | Rôles qui portent des entreprises : chargé de compte, Responsable commercial, administrateur. |
| `export class PrismaOwnerDirectory implements OwnerDirectory` | Annuaire des propriétaires, lu dans la table des utilisateurs (jamais d'e-mail ni de secret exposé). |

### `modules/business-development/infrastructure/prisma-receipt.repository.ts`

| Déclaration | Rôle |
|---|---|
| `export class PrismaReceiptRepository implements ReceiptRepository` | Persistance PostgreSQL des décharges (jamais supprimées : on les annule, avec un motif). |
| `async save(receipt: Receipt): Promise<void>` | Crée ou met à jour la décharge ; une modification sur une version périmée est un conflit (verrou optimiste). |

### `modules/business-development/presentation/appointments.controller.ts`

| Déclaration | Rôle |
|---|---|
| `export class AppointmentsController` | Agenda : rendez-vous (DAF, décideur) et visites. |
| `plan(@Body() dto: PlanAppointmentDto, @Access() access: AccessContext, @CurrentActor() actor: AuthenticatedActor, @Req() req: Request)` | Planifie ; la réponse porte `conflicts` si l'organisateur a déjà un rendez-vous sur le créneau (avertissement). |
| `list(@Query() query: ListAppointmentsDto, @Access() access: AccessContext)` | L'agenda sur une fenêtre de temps, trié par heure de début. |
| `postpone(@Param('id', ParseUUIDPipe) id: string, @Body() dto: TransitionAppointmentDto, @Access() access: AccessContext, @CurrentActor() actor: Authen` | Reporter à une autre heure, avec un motif (obligatoire). |
| `hold(@Param('id', ParseUUIDPipe) id: string, @Body() dto: TransitionAppointmentDto, @Access() access: AccessContext, @CurrentActor() actor: Authentica` | Marquer tenu, avec le compte rendu (obligatoire). |
| `cancel(@Param('id', ParseUUIDPipe) id: string, @Body() dto: TransitionAppointmentDto, @Access() access: AccessContext, @CurrentActor() actor: Authenti` | Annuler, avec un motif (obligatoire). |

### `modules/business-development/presentation/approvals.controller.ts`

| Déclaration | Rôle |
|---|---|
| `export class ApprovalsController` | Agréments (promesses de paiement signées). |
| `register(@Body() dto: RegisterApprovalDto, @Access() access: AccessContext, @CurrentActor() actor: AuthenticatedActor, @Req() req: Request)` | Enregistrer l'agrément d'une opportunité qui a franchi l'accord de principe ; l'entreprise devient « Cliente ». |
| `honor(@Param('id', ParseUUIDPipe) id: string, @Body() dto: HonorApprovalDto, @Access() access: AccessContext, @CurrentActor() actor: AuthenticatedActo` | Constater que la promesse a été tenue (réservé à qui peut honorer : Responsable commercial). |
| `expire(@Param('id', ParseUUIDPipe) id: string, @Body() dto: CloseApprovalDto, @Access() access: AccessContext, @CurrentActor() actor: AuthenticatedAct` | Déclarer l'agrément expiré (motif obligatoire) : l'expiration est manuelle (D3). |
| `cancel(@Param('id', ParseUUIDPipe) id: string, @Body() dto: CloseApprovalDto, @Access() access: AccessContext, @CurrentActor() actor: AuthenticatedAct` | Annuler l'agrément (motif obligatoire). |

### `modules/business-development/presentation/companies.controller.ts`

| Déclaration | Rôle |
|---|---|
| `export class CompaniesController` | Chaque route est protégée : identité + MFA vérifié + permission. |
| `register(@Body() dto: RegisterCompanyDto, @Access() access: AccessContext, @CurrentActor() actor: AuthenticatedActor, @Req() req: Request)` | L'utilisateur qui crée l'entreprise en devient le propriétaire. |
| `overview(@Query() query: CompanyOverviewDto, @Access() access: AccessContext)` | Compteurs par statut et valeurs des filtres (pays, secteurs), dans la portée de l'appelant. |
| `owners(@Access() access: AccessContext)` | Les personnes à qui l'appelant peut confier une entreprise (liste du choix de réattribution). |
| `async export(@Param('id', ParseUUIDPipe) id: string, @Access() access: AccessContext, @CurrentActor() actor: AuthenticatedActor, @Req() req: Request)` | Fiche imprimable. |
| `update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateCompanyDto, @Access() access: AccessContext, @CurrentActor() actor: AuthenticatedAct` | Modifie la fiche. |
| `status(@Param('id', ParseUUIDPipe) id: string, @Body() dto: ChangeStatusDto, @Access() access: AccessContext, @CurrentActor() actor: AuthenticatedActo` | Change le statut à la main, d'un cran (CU-C-05) ; « Qualifiée » exige un contact. |
| `owner(@Param('id', ParseUUIDPipe) id: string, @Body() dto: ReassignDto, @Access() access: AccessContext, @CurrentActor() actor: AuthenticatedActor, @R` | Confie l'entreprise à un autre propriétaire de la portée de l'appelant (D17). |

### `modules/business-development/presentation/contacts.controller.ts`

| Déclaration | Rôle |
|---|---|
| `export class ContactsController` | Contacts des entreprises. |

### `modules/business-development/presentation/dto/appointment.dto.ts`

| Déclaration | Rôle |
|---|---|
| `export class PlanAppointmentDto` | Planification d'un rendez-vous : le type, l'entreprise et l'heure de début ; le reste est facultatif. |
| `export class UpdateAppointmentDto` | Modification d'un rendez-vous à venir : `version` (celle qui a été lue) obligatoire ; le reste est facultatif (absent = inchangé, contact `null` = retiré). |
| `export class TransitionAppointmentDto` | Report, tenue ou annulation : la version lue, et le texte (motif ou compte rendu) obligatoire ; le report porte aussi la nouvelle heure. |
| `export class ListAppointmentsDto` | Fenêtre de l'agenda (début inclus, fin exclue, 63 jours au plus), pagination (taille ≤ 200), type, état, entreprise, offre. |

### `modules/business-development/presentation/dto/approval.dto.ts`

| Déclaration | Rôle |
|---|---|
| `export class RegisterApprovalDto` | Enregistrement d'un agrément : l'opportunité, la date de réception, le montant couvert et/ou le nombre de places (au moins l'un des deux, vérifié par le domaine), la devise et la fin de validité (facultative). |
| `export class HonorApprovalDto` | Honorer un agrément : la version lue. |
| `export class CloseApprovalDto` | Déclarer un agrément expiré ou l'annuler : la version lue et le motif (obligatoire, vérifié par le domaine). |
| `export class ListApprovalsDto` | Liste des agréments : pagination (taille ≤ 100), entreprise, opportunité, état. |

### `modules/business-development/presentation/dto/company-lifecycle.dto.ts`

| Déclaration | Rôle |
|---|---|
| `export const MANUAL_STATUSES = ['TARGET', 'CONTACTED', 'QUALIFIED'] as const;` | Statuts qu'on peut poser à la main (les statuts « Cliente » et « Archivée » ne se posent pas ici). |

### `modules/business-development/presentation/dto/contact.dto.ts`

| Déclaration | Rôle |
|---|---|
| `export class RegisterContactDto` | Création d'un contact : l'entreprise (identifiant), le nom et le prénom sont obligatoires. |
| `export class UpdateContactDto` | Modification : `version` (celle qui a été lue) est obligatoire ; le reste est facultatif (absent = inchangé, vide = effacé). |
| `export class ListContactsDto` | Paramètres de la liste : pagination (taille ≤ 100), recherche, entreprise, fonction. |

### `modules/business-development/presentation/dto/followup.dto.ts`

| Déclaration | Rôle |
|---|---|
| `export class PlanFollowupDto` | Planification d'une relance : l'offre, l'échéance (AAAA-MM-JJ) et le canal ; la note est facultative. |
| `export class UpdateFollowupDto` | Modification d'une relance à faire : `version` (celle qui a été lue) obligatoire ; le reste est facultatif (absent = inchangé). |
| `export class CloseFollowupDto` | Terminer ou annuler une relance : la version lue et le texte (résultat ou motif), obligatoire. |
| `export class ListFollowupsDto` | Paramètres de la liste : pagination (taille ≤ 100), offre, état, échéance. |

### `modules/business-development/presentation/dto/list-companies.dto.ts`

| Déclaration | Rôle |
|---|---|
| `export class ListCompaniesDto` | Paramètres de requête de la liste (page, taille ≤ 100, recherche, filtres, tri) validés avant d'atteindre le cas d'usage. |
| `export class CompanyOverviewDto` | Paramètres de la synthèse (compteurs par statut) : mêmes filtres que la liste, hors statut. |

### `modules/business-development/presentation/dto/offer.dto.ts`

| Déclaration | Rôle |
|---|---|
| `const AMOUNT = /^\s*\d[\d\s]{0,15}([.,]\d{1,2})?\s*$/;` | Montant en texte décimal (« 4500000 » ou « 4500000,50 ») : jamais de nombre flottant sur le réseau. |
| `export class RegisterOfferDto` | Création d'une offre : entreprise, objet et montant obligatoires ; devise XAF par défaut. |
| `export class UpdateOfferDto` | Modification d'un brouillon : `version` (celle qui a été lue) obligatoire ; le reste est facultatif (absent = inchangé). |
| `export class OfferTransitionDto` | Changement d'état : la version lue ; le motif n'est lu que pour un retrait. |
| `export class ListOffersDto` | Paramètres de la liste : pagination (taille ≤ 100), recherche, entreprise, état. |

### `modules/business-development/presentation/dto/opportunity.dto.ts`

| Déclaration | Rôle |
|---|---|
| `export class CreateOpportunityDto` | Création : l'entreprise, l'intitulé, le montant estimé et la source ; la devise est facultative (XAF par défaut). |
| `export class UpdateOpportunityDto` | Modification d'une opportunité ouverte : `version` (celle qui a été lue) obligatoire ; le reste est facultatif (absent = inchangé). |
| `export class AdvanceOpportunityDto` | Avancer : seulement la version lue. |
| `export class WaiverDto` | Dérogation : la version lue et la justification (obligatoire). |
| `export class CloseLostDto` | Clôture « perdue » : la version lue, le motif de la liste fermée et une précision (obligatoire pour « autre »). |
| `export class CloseWonDto` | Clôture « gagnée » : seulement la version lue. |
| `export class ListOpportunitiesDto` | Paramètres de la liste : pagination (taille ≤ 200), recherche, entreprise, état, étape. |

### `modules/business-development/presentation/dto/receipt.dto.ts`

| Déclaration | Rôle |
|---|---|
| `export class RegisterReceiptDto` | Enregistrement d'une décharge : l'offre, la date de réception (AAAA-MM-JJ) et la personne qui l'a remise. |
| `export class CancelReceiptDto` | Annulation d'une décharge : la version lue et le motif (obligatoire). |
| `export class ListReceiptsDto` | Liste des décharges d'une offre. |

### `modules/business-development/presentation/dto/register-company.dto.ts`

| Déclaration | Rôle |
|---|---|
| `export class NewFacilitatorDto` | Nouveau facilitateur saisi à la création de l'entreprise. |
| `export class CommissionDto` | Commission : montant fixe (avec devise) ou pourcentage. |
| `export class FacilitationDto` | Facilitateur par qui l'entreprise a été approchée : existant (identifiant) OU nouveau, plus la méthode de contact. |
| `export class UpdateFacilitationDto` | Modification du lien avec le facilitateur : tout est facultatif (absent = inchangé), `commission: null` la retire. |
| `export class RegisterCompanyDto` | Corps de la requête d'enregistrement : nom obligatoire, le reste facultatif, longueurs bornées ; tout autre champ (notamment le propriétaire) est refusé. |

### `modules/business-development/presentation/dto/update-company.dto.ts`

| Déclaration | Rôle |
|---|---|
| `export class UpdateCompanyDto` | Corps de la modification d'une entreprise : `version` (celle que l'appelant a lue) est obligatoire, tout le reste est facultatif (absent = inchangé, chaîne vide = champ effacé) ; `facilitation: null` retire le facilitateur. |

### `modules/business-development/presentation/facilitators.controller.ts`

| Déclaration | Rôle |
|---|---|
| `export class FacilitatorsController` | Facilitateurs : personnes qui mettent en relation avec une entreprise. |
| `register(@Body() dto: NewFacilitatorDto, @Access() access: AccessContext, @CurrentActor() actor: AuthenticatedActor, @Req() req: Request)` | L'utilisateur qui crée le facilitateur en devient le propriétaire. |

### `modules/business-development/presentation/followups.controller.ts`

| Déclaration | Rôle |
|---|---|
| `export class FollowupsController` | Relances des offres. |
| `list(@Query() query: ListFollowupsDto, @Access() access: AccessContext)` | La liste « À faire » : triée par échéance, filtrable par offre, état et échéance (en retard, aujourd'hui, à venir). |
| `complete(@Param('id', ParseUUIDPipe) id: string, @Body() dto: CloseFollowupDto, @Access() access: AccessContext, @CurrentActor() actor: AuthenticatedA` | Terminer la relance avec son résultat (obligatoire). |
| `cancel(@Param('id', ParseUUIDPipe) id: string, @Body() dto: CloseFollowupDto, @Access() access: AccessContext, @CurrentActor() actor: AuthenticatedAct` | Annuler la relance avec un motif (obligatoire). |

### `modules/business-development/presentation/offers.controller.ts`

| Déclaration | Rôle |
|---|---|
| `export class OffersController` | Offres faites aux entreprises. |
| `submit(@Param('id', ParseUUIDPipe) id: string, @Body() dto: OfferTransitionDto, @Access() access: AccessContext, @CurrentActor() actor: AuthenticatedA` | Déposer le brouillon chez l'entreprise. |
| `accept(@Param('id', ParseUUIDPipe) id: string, @Body() dto: OfferTransitionDto, @Access() access: AccessContext, @CurrentActor() actor: AuthenticatedA` | Enregistrer l'acceptation de l'entreprise. |
| `refuse(@Param('id', ParseUUIDPipe) id: string, @Body() dto: OfferTransitionDto, @Access() access: AccessContext, @CurrentActor() actor: AuthenticatedA` | Enregistrer le refus de l'entreprise. |
| `withdraw(@Param('id', ParseUUIDPipe) id: string, @Body() dto: OfferTransitionDto, @Access() access: AccessContext, @CurrentActor() actor: Authenticate` | Retirer l'offre (motif obligatoire). |

### `modules/business-development/presentation/opportunities.controller.ts`

| Déclaration | Rôle |
|---|---|
| `export class OpportunitiesController` | Opportunités commerciales (pipeline). |
| `list(@Query() query: ListOpportunitiesDto, @Access() access: AccessContext)` | Le pipeline : les opportunités visibles, la plus récemment modifiée d'abord ; filtrable par recherche, entreprise, état, étape. |
| `advance(@Param('id', ParseUUIDPipe) id: string, @Body() dto: AdvanceOpportunityDto, @Access() access: AccessContext, @CurrentActor() actor: Authentica` | Passer à l'étape suivante (accord de principe : rendez-vous décideur tenu ou dérogation). |
| `waiver(@Param('id', ParseUUIDPipe) id: string, @Body() dto: WaiverDto, @Access() access: AccessContext, @CurrentActor() actor: AuthenticatedActor, @Re` | Accorder la dérogation à la règle du rendez-vous décideur (Responsable commercial), avec une justification. |
| `closeLost(@Param('id', ParseUUIDPipe) id: string, @Body() dto: CloseLostDto, @Access() access: AccessContext, @CurrentActor() actor: AuthenticatedActo` | Clore « perdue » avec un motif de la liste fermée (chargé de compte pour les siennes). |
| `closeWon(@Param('id', ParseUUIDPipe) id: string, @Body() dto: CloseWonDto, @Access() access: AccessContext, @CurrentActor() actor: AuthenticatedActor,` | Clore « gagnée » (Responsable commercial seulement, après l'accord de principe). |

### `modules/business-development/presentation/receipts.controller.ts`

| Déclaration | Rôle |
|---|---|
| `export class ReceiptsController` | Décharges signées des offres. |
| `cancel(@Param('id', ParseUUIDPipe) id: string, @Body() dto: CancelReceiptDto, @Access() access: AccessContext, @CurrentActor() actor: AuthenticatedAct` | Annuler la décharge (motif obligatoire) : l'offre redevient « déposée ». |

### `modules/documents/application/document-use-cases.ts`

| Déclaration | Rôle |
|---|---|
| `export function sha256Of(bytes: Buffer): string` | Empreinte SHA-256 hexadécimale d'un contenu. |
| `export function newStorageKey(): string` | Clé de stockage ALÉATOIRE (jamais le nom fourni) : deux niveaux de dossiers pour éviter un dossier géant. |
| `export class DocumentOwnerGate` | Contrôle d'accès commun : un document n'est JAMAIS plus accessible que son objet propriétaire. |
| `async require(ownerType: string, ownerId: string, access: AccessContext, permission: string, notFound: string): Promise<void>` | Vérifie l'accès à l'objet et la permission ; lève « introuvable » sinon, « validation » si le type est inconnu. |
| `export interface UploadCommand` | Ce que reçoit un envoi : le fichier est contrôlé et stocké, jamais exécuté. |
| `export class UploadDocumentUseCase` | Envoie un NOUVEAU document : contrôle l'objet propriétaire et le droit, contrôle le fichier (taille, format par signature, extension cohérente), calcule l'empreinte SHA-256, écrit le contenu sous une clé aléatoire puis enregistre le document, sa première version et l'audit dans UNE transaction. |
| `async execute(command: UploadCommand): Promise<DocumentView>` | Enregistre le document et renvoie sa vue (version 1). |
| `export interface AddVersionCommand` | Ce que reçoit l'ajout d'une version. |
| `export class AddDocumentVersionUseCase` | Ajoute une VERSION à un document existant : les versions précédentes restent intactes et téléchargeables. |
| `async execute(command: AddVersionCommand): Promise<DocumentView>` | Écrit le nouveau contenu puis enregistre la version, l'avancement du document et l'audit. |
| `export class ListDocumentsHandler` | Liste les documents d'un objet propriétaire que l'appelant peut voir. |
| `async execute(query: { ownerType: string; ownerId: string; includeArchived: boolean; access: AccessContext }): Promise<DocumentView[]>` | Documents de l'objet (les archivés seulement sur demande), avec leur version courante. |
| `export class GetDocumentHandler` | Détail d'un document (versions comprises) ; hors accès, « introuvable ». |
| `async execute(query: { id: string; access: AccessContext }): Promise<DocumentDetailView>` | Lit le document et toutes ses versions. |
| `export interface DownloadedFile` | Fichier prêt à être servi : octets vérifiés, nom, type. |
| `export class DownloadDocumentUseCase` | Télécharge une version (la courante par défaut) : contrôle d'accès, lecture du contenu, VÉRIFICATION de l'empreinte SHA-256 avant d'envoyer quoi que ce soit, et audit de chaque téléchargement. |
| `async execute(query: { id: string; versionNumber?: number; access: AccessContext; actor: ActorContext }): Promise<DownloadedFile>` | Lit, vérifie et trace ; renvoie le contenu à servir en pièce jointe. |
| `export class ArchiveDocumentUseCase` | Archive un document : suppression LOGIQUE. |
| `async execute(command: { id: string; access: AccessContext; actor: ActorContext }): Promise<void>` | Passe le document à « archivé » et trace l'action. |

### `modules/documents/application/document-views.ts`

| Déclaration | Rôle |
|---|---|
| `export interface VersionView` | Une version telle que l'utilisateur la voit (jamais la clé de stockage ni l'identifiant de l'auteur). |
| `export interface DocumentView` | Un document avec sa version courante (liste et détail). |
| `export interface DocumentDetailView extends DocumentView` | Détail d'un document : le document et TOUTES ses versions, de la plus récente à la plus ancienne. |
| `export function toVersionView(version: DocumentVersion): VersionView` | Version du domaine → version affichable. |
| `export function toDocumentView(document: Document, current: DocumentVersion): DocumentView` | Document et version courante → vue publique (aucun objet interne n'est exposé). |

### `modules/documents/application/owner-registry.ts`

| Déclaration | Rôle |
|---|---|
| `export interface DocumentOwnerResolver` | Résout l'objet propriétaire d'un document (entreprise, offre, opportunité…) : renvoie le propriétaire de CET objet s'il existe ET si l'appelant peut le voir, sinon `null` (introuvable : on ne révèle pas son existence). |
| `export interface DocumentOwnerRegistry` | Registre où chaque module métier déclare le résolveur de ses objets (`register('company', …)`). |
| `export class InMemoryDocumentOwnerRegistry implements DocumentOwnerRegistry` | Registre en mémoire : un seul résolveur par type d'objet (un doublon est une erreur de composition). |
| `register(ownerType: string, resolver: DocumentOwnerResolver): void` | Déclare le résolveur d'un type d'objet propriétaire ; refuse un doublon. |
| `resolver(ownerType: string): DocumentOwnerResolver \| null` | Résolveur d'un type, ou `null` si le type n'est pas déclaré (refus par défaut). |
| `types(): string[]` | Types d'objets propriétaires déclarés. |

### `modules/documents/application/upload-rules.ts`

| Déclaration | Rôle |
|---|---|
| `export const MAX_UPLOAD_BYTES = MAX_FILE_BYTES;` | Taille maximale d'un envoi, exposée à la couche de présentation (qui borne la lecture du corps de la requête). |
| `export function uploadRules(): { maxBytes: number; formats: string[]; categories: readonly { code: string; label: string }[] }` | Règles d'envoi publiées par l'API : taille maximale, extensions acceptées, catégories. |

### `modules/documents/documents.module.ts`

| Déclaration | Rôle |
|---|---|
| `export class DocumentsModule {}` | Module « Documents » : versions immuables avec empreinte SHA-256, stockage derrière un port, téléchargement contrôlé et audité. |

### `modules/documents/domain/document-policy.ts`

| Déclaration | Rôle |
|---|---|
| `export const MAX_FILE_BYTES = 10 * 1024 * 1024;` | Taille maximale d'un fichier (10 Mo). |
| `export type DocumentFormat = 'PDF' \| 'JPEG' \| 'PNG' \| 'DOCX' \| 'XLSX';` | Formats acceptés : leur type réel est reconnu par la SIGNATURE du contenu, jamais par ce que déclare le client. |
| `export function detectFormat(bytes: Buffer): DocumentFormat \| null` | Reconnaît le format d'après le CONTENU (octets magiques). |
| `const MAX_NAME_LENGTH = 200;` | Longueur maximale d'un nom de fichier conservé (colonne `file_name` : 255). |
| `export function sanitizeFileName(raw: string): string` | Nom de fichier conservé pour l'affichage et le téléchargement : sans chemin, sans caractères de contrôle ni caractères réservés, borné. |
| `export function extensionOf(fileName: string): string` | Extension en minuscules, sans le point (`rapport.PDF` → `pdf`) ; chaîne vide s'il n'y en a pas. |
| `export interface AcceptedFile` | Fichier accepté : nom assaini, format reconnu et type MIME correspondant. |
| `export function checkUpload(rawFileName: string, bytes: Buffer): AcceptedFile` | Contrôle d'un fichier envoyé : non vide, taille maximale, nom exploitable, format reconnu par signature, et extension COHÉRENTE avec ce format (un `.pdf` qui contient autre chose est refusé, comme un `.exe` renommé). |
| `export function checkCategory(category: string \| null \| undefined): string \| null` | Catégorie valide (ou absente) ; une catégorie inconnue est refusée. |

### `modules/documents/domain/document.ts`

| Déclaration | Rôle |
|---|---|
| `export interface DocumentVersion` | Contenu d'un document à un instant : une version immuable (fichier, empreinte SHA-256, auteur). |
| `export interface DocumentProps` | Données d'un document reconstitué depuis la base. |
| `export class Document` | Un document rattaché à un objet d'un autre contexte (type + identifiant, sans clé étrangère) : titre, catégorie, état et numéro de la version courante. |
| `static create(input: { id: string; ownerType: string; ownerId: string; title: string; category: string \| null; createdBy: string; now: Date }): Docum` | Nouveau document : actif avec sa première version (numéro 1). |
| `static rehydrate(props: DocumentProps): Document` | Reconstitue un document depuis la persistance (aucune règle rejouée). |
| `get isArchived(): boolean` | Vrai si le document est archivé (lecture seule : on n'y ajoute plus de version). |
| `nextVersionNumber(): number` | Numéro de la prochaine version ; refusé si le document est archivé. |
| `registerVersion(versionNumber: number): void` | Enregistre l'ajout d'une version (la courante devient celle-là). |
| `archive(): void` | Archive le document (suppression logique, sans effet s'il l'est déjà). |

### `modules/documents/domain/ports.ts`

| Déclaration | Rôle |
|---|---|
| `export interface DocumentRepository` | Port de persistance des documents et de leurs versions (aucune méthode ne supprime une version). |
| `createWithVersion(document: Document, version: DocumentVersion): Promise<void>;` | Crée un document et sa première version (même transaction). |
| `addVersion(document: Document, version: DocumentVersion): Promise<void>;` | Ajoute une version et met à jour la version courante (verrou optimiste sur le document). |
| `save(document: Document): Promise<void>;` | Enregistre l'état du document (archivage) avec verrou optimiste. |
| `listByOwner(ownerType: string, ownerId: string, includeArchived: boolean): Promise<Document[]>;` | Documents d'un objet propriétaire, du plus récent au plus ancien ; les archivés seulement sur demande. |
| `currentVersions(documentIds: readonly string[]): Promise<DocumentVersion[]>;` | Dernière version de chaque document donné (pour l'affichage de la liste). |
| `export interface ObjectStorage` | Port de stockage des contenus : clé aléatoire → octets. |
| `removeOrphan(key: string): Promise<void>;` | Retire un objet qu'on vient d'écrire et qu'aucune ligne en base ne référence (annulation d'un envoi). |

### `modules/documents/infrastructure/local-disk-object-storage.ts`

| Déclaration | Rôle |
|---|---|
| `const KEY_PATTERN = /^[0-9a-f]{2}\/[0-9a-f]{2}\/[0-9a-f]{48}$/;` | Forme exacte d'une clé de stockage (deux niveaux de dossiers puis 48 caractères hexadécimaux) : rien d'autre ne passe. |
| `export class LocalDiskObjectStorage implements ObjectStorage` | Stockage des contenus sur disque (CAD-S36-1 B) : dossier HORS racine web, droits restreints (dossiers 0700, fichiers 0600), écriture atomique (fichier temporaire puis renommage). |
| `private pathOf(key: string): string` | Chemin absolu d'une clé valide ; toute autre forme est une erreur de programmation (jamais une entrée utilisateur). |
| `async put(key: string, data: Buffer): Promise<void>` | Écrit le contenu sous la clé, de façon atomique. |
| `async get(key: string): Promise<Buffer>` | Lit le contenu ; une clé absente est une erreur (la base référence un fichier qui n'existe plus). |
| `async removeOrphan(key: string): Promise<void>` | Retire un objet qu'on vient d'écrire et qu'aucune ligne en base ne référence ; sans effet s'il n'existe pas. |

### `modules/documents/infrastructure/prisma-document.repository.ts`

| Déclaration | Rôle |
|---|---|
| `function toDocument(row: DocumentRow): Document` | Ligne de base → document du domaine. |
| `function toVersion(row: VersionRow): DocumentVersion` | Ligne de base → version du domaine (la taille est un entier 64 bits en base, un nombre ≤ 10 Mo ici). |
| `function versionData(version: DocumentVersion)` | Données d'une version à écrire. |
| `export class PrismaDocumentRepository implements DocumentRepository` | Persistance PostgreSQL des documents (schéma `docs`). |
| `async createWithVersion(document: Document, version: DocumentVersion): Promise<void>` | Crée le document et sa première version. |
| `async addVersion(document: Document, version: DocumentVersion): Promise<void>` | Ajoute une version et avance la version courante ; refus si quelqu'un d'autre a modifié le document entre-temps. |
| `async save(document: Document): Promise<void>` | Enregistre l'état du document (archivage) avec verrou optimiste. |
| `async listByOwner(ownerType: string, ownerId: string, includeArchived: boolean): Promise<Document[]>` | Documents d'un objet, du plus récent au plus ancien (les archivés seulement sur demande, 200 au plus). |
| `async currentVersions(documentIds: readonly string[]): Promise<DocumentVersion[]>` | Version courante de chaque document donné (le numéro courant est lu sur le document lui-même). |

### `modules/documents/presentation/documents.controller.ts`

| Déclaration | Rôle |
|---|---|
| `function noStore(res: Response): void` | Les réponses documentaires ne doivent jamais être mises en cache (données de l'entreprise). |
| `export class DocumentsController` | Routes des documents (S3.6). |
| `meta(@Res({ passthrough: true }) res: Response)` | Règles d'envoi (formats, taille maximale, catégories) pour que l'interface les affiche sans les dupliquer. |
| `async create(@Query() query: UploadDocumentQueryDto, @Req() req: Request, @Access() access: AccessContext, @CurrentActor() actor: AuthenticatedActor)` | Envoie un nouveau document (version 1) sur un objet propriétaire. |
| `async listByOwner(@Query() query: ListDocumentsQueryDto, @Access() access: AccessContext, @Res({ passthrough: true }) res: Response)` | Documents d'un objet propriétaire visibles de l'appelant. |
| `async detail(@Param('id', ParseUUIDPipe) id: string, @Access() access: AccessContext, @Res({ passthrough: true }) res: Response)` | Détail d'un document et de toutes ses versions. |
| `async newVersion(@Param('id', ParseUUIDPipe) id: string, @Query() query: NewVersionQueryDto, @Req() req: Request, @Access() access: AccessContext, @Cu` | Ajoute une version à un document (les précédentes restent intactes). |
| `async downloadVersion(` | Télécharge une version en pièce jointe, après vérification de son empreinte SHA-256 ; chaque téléchargement est audité. |
| `async archiveDocument(@Param('id', ParseUUIDPipe) id: string, @Req() req: Request, @Access() access: AccessContext, @CurrentActor() actor: Authenticat` | Archive un document (suppression logique : versions et fichiers conservés). |

### `modules/documents/presentation/dto/documents.dto.ts`

| Déclaration | Rôle |
|---|---|
| `export class UploadDocumentQueryDto` | Paramètres d'un premier envoi (le fichier lui-même est le corps de la requête) : objet propriétaire, titre, catégorie, nom. |
| `export class NewVersionQueryDto` | Paramètres de l'ajout d'une version : seul le nom du fichier (le document est dans l'adresse). |
| `export class ListDocumentsQueryDto` | Paramètres de la liste : objet propriétaire, archivés ou non. |
| `export class DownloadQueryDto` | Paramètres du téléchargement : numéro de version (la courante par défaut). |

### `modules/documents/presentation/request-body.ts`

| Déclaration | Rôle |
|---|---|
| `export async function readBinaryBody(req: Request, maxBytes: number): Promise<Buffer>` | Lit le corps brut d'un envoi de fichier (`application/octet-stream`) en refusant, AVANT d'avoir tout reçu, un fichier qui dépasse la taille maximale : l'en-tête `Content-Length` puis le cumul des octets reçus sont contrôlés. |
| `export function attachmentHeader(fileName: string): string` | En-tête `Content-Disposition` d'un téléchargement : toujours « attachment », nom ASCII de repli et nom UTF-8 exact. |

### `modules/iam/application/access-types.ts`

| Déclaration | Rôle |
|---|---|
| `export type ScopeName = 'OWN' \| 'TEAM' \| 'ALL';` | Portée minimale exigée par une route d'administration (valeurs de `Scope`). |
| `export type UserStatusName = 'PENDING' \| 'ACTIVE' \| 'LOCKED' \| 'DISABLED';` | Statuts d'un compte, tels qu'exposés par l'API. |

### `modules/iam/application/admin/invitations.use-cases.ts`

| Déclaration | Rôle |
|---|---|
| `export function invitationLink(publicUrl: string, token: string): string` | Lien d'invitation : le jeton est dans le FRAGMENT (`#`), que le navigateur n'envoie ni au serveur ni dans l'en-tête Referer. |
| `function invitationEmail(displayName: string, link: string)` | Compose l'e-mail d'invitation (lien de 48 h, usage unique, rappel que le second facteur est obligatoire). |
| `export interface InviteUserCommand` | Données d'une invitation : adresse, nom, rôles, responsable, acteur et droits de l'appelant (inviter avec des rôles revient à les attribuer). |
| `export interface InvitationResult` | Résultat d'une invitation : le compte créé et `emailSent` (faux si l'e-mail n'a pas pu partir : renvoyer le lien). |
| `export function parseRoles(input: readonly string[]): RoleCode[]` | Vérifie et dédoublonne les rôles demandés (jamais un rôle inconnu). |
| `export class InviteUserUseCase` | Crée un compte EN ATTENTE, sans mot de passe, et envoie un lien d'activation. |
| `async execute(command: InviteUserCommand): Promise<InvitationResult>` | Vérifie le droit d'attribuer des rôles, crée le compte en attente et son lien dans une transaction, puis envoie l'e-mail hors transaction. |
| `private async send(user: User, token: string, actor: ActorContext): Promise<boolean>` | Envoie l'e-mail d'invitation ; un échec est audité (sans le lien) et signalé par `false`. |
| `export class ResendInvitationUseCase` | Renvoie une invitation : les liens précédents sont révoqués, un nouveau lien de 48 h est envoyé. |
| `async execute(command: { userId: string; actor: ActorContext }): Promise<{ emailSent: boolean }>` | Révoque les liens précédents et en envoie un nouveau (compte encore en attente seulement). |
| `export class AcceptInvitationUseCase` | Activation du compte par l'utilisateur : il choisit son mot de passe grâce au lien (usage unique, 48 h). |
| `async execute(command: { token: string; password: string; actor: ActorContext }): Promise<void>` | Valide le lien et le mot de passe (politique, avant de consommer le lien), puis active le compte. |
| `private async activate(recordId: string, tokenHash: string, userId: string, passwordHash: string, actor: ActorContext): Promise<AcceptResult>` | Consomme le lien de façon atomique puis active le compte avec son mot de passe ; deux activations simultanées : une seule aboutit. |
| `private async deny(actor: ActorContext, entityId: string, reason: string): Promise<void>` | Trace un lien refusé (motif interne : inconnu, expiré, utilisé, révoqué) sans jamais écrire le jeton. |

### `modules/iam/application/admin/password-reset.use-cases.ts`

| Déclaration | Rôle |
|---|---|
| `export function passwordResetLink(publicUrl: string, token: string): string` | Le jeton est dans le FRAGMENT (`#`) : ni envoyé au serveur, ni dans l'en-tête Referer. |
| `const cleanName = (name: string): string => name.replace(/[\u0000-\u001f\u007f]/g, ' ').trim();` | Retire les caractères de contrôle d'un nom avant de l'écrire dans un e-mail (pas d'injection d'en-têtes ni de lignes). |
| `function resetEmail(displayName: string, link: string, validity: string, byAdministrator: boolean)` | Compose l'e-mail de réinitialisation (lien, durée de validité, rappel que le MFA est conservé, conduite à tenir si la demande n'est pas la vôtre). |
| `function passwordChangedEmail(displayName: string, when: Date, ipAddress: string)` | Compose l'e-mail de confirmation « votre mot de passe a été modifié » (date UTC, adresse IP) envoyé au titulaire. |
| `function isResettable(user: User): boolean` | Un compte peut se réinitialiser seulement s'il est actif ou verrouillé ET possède déjà un mot de passe. |
| `export class RequestPasswordResetUseCase` | « Mot de passe oublié » (libre-service, route publique). |
| `async execute(command: { email: string; actor: ActorContext }): Promise<void>` | Traite une demande « mot de passe oublié » : ne signale jamais rien à l'appelant (anti-énumération), audite toujours l'issue et envoie le lien seulement si le compte est éligible et sous le plafond. |
| `private record(actor: ActorContext, entityId: string, outcome: string, extra: Record<string, unknown> = {}): Promise<void>` | Écrit l'entrée d'audit d'une demande (issue : ISSUED, UNKNOWN, INELIGIBLE, THROTTLED, EMAIL_FAILED). |
| `export class IssuePasswordResetUseCase` | Réinitialisation déclenchée par un **administrateur** (permission `iam.user.reset_password` + MFA récent, contrôlés par la route). |
| `async execute(command: { userId: string; actor: ActorContext }): Promise<{ emailSent: boolean }>` | Interdit pour soi-même ; refuse un compte en attente ou désactivé ; révoque les liens précédents, crée un lien de 48 h, l'audite puis l'envoie. |
| `export class ResetPasswordUseCase` | Choix du nouveau mot de passe avec le lien (public). |
| `async execute(command: { token: string; password: string; actor: ActorContext }): Promise<void>` | Valide le lien, la politique et l'historique, consomme le lien de façon atomique, change le mot de passe, coupe toutes les sessions, révoque les autres liens, audite et prévient le titulaire. |
| `private deny(actor: ActorContext, entityId: string, reason: string): Promise<void>` | Trace un lien refusé (motif interne) sans jamais écrire le jeton ni révéler le motif à l'appelant. |

### `modules/iam/application/admin/session-management.use-cases.ts`

| Déclaration | Rôle |
|---|---|
| `export interface SessionView` | Session telle que l'utilisateur la voit : appareil, IP, risque, MFA, dates ; `current` marque la session qui fait la demande. |
| `export class ListOwnSessionsHandler` | Les sessions actives de l'appelant : il ne voit jamais celles des autres. |
| `async execute(actor: { userId: string; sessionId: string }): Promise<SessionView[]>` | Liste les sessions actives de l'appelant seulement. |
| `export class RevokeSessionUseCase` | Révoque UNE session. |
| `async execute(command: { sessionId: string; access: AccessContext; actor: ActorContext }): Promise<void>` | Révoque une session et ses jetons ; hors de la portée de l'appelant, elle est « introuvable » (404). |
| `export class RevokeUserSessionsUseCase` | Coupe TOUTES les sessions d'un utilisateur (incident). |
| `async execute(command: { targetUserId: string; access: AccessContext; actor: ActorContext }): Promise<{ revoked: number }>` | Coupe toutes les sessions d'un utilisateur (portée Tous exigée) et révoque leurs jetons ; renvoie leur nombre. |
| `export class RevokeOtherSessionsUseCase` | Révoque TOUTES les sessions de l'appelant SAUF celle qui fait la demande (« déconnecter mes autres appareils »). |
| `async execute(command: { userId: string; sessionId: string; actor: ActorContext }): Promise<{ revoked: number }>` | Révoque les autres sessions et leurs jetons, trace l'action et renvoie le nombre de sessions coupées. |
| `export class LoginHistoryHandler` | Historique des connexions de l'appelant (journal d'audit, 90 jours) : jamais celui d'un autre utilisateur. |
| `async execute(query: { userId: string; before?: Date; limit?: number }): Promise<LoginHistoryPage>` | Page d'historique de l'utilisateur dont l'identifiant vient du jeton ; `before` est le curseur de la page suivante. |

### `modules/iam/application/admin/user-management.use-cases.ts`

| Déclaration | Rôle |
|---|---|
| `async function assertNotLastSuperAdmin(users: UserRepository): Promise<void>` | Toute opération qui peut retirer un SuperAdmin actif passe par cette vérification, sous verrou. |
| `export interface UpdateUserCommand` | Modification d'un utilisateur : nom et/ou responsable (`null` retire le responsable, absent laisse inchangé). |
| `export class UpdateUserUseCase` | Modifie le nom ou le responsable d'un utilisateur (refuse les cycles hiérarchiques) et trace avant/après. |
| `async execute(command: UpdateUserCommand): Promise<UserView>` | Applique la modification, vérifie l'absence de cycle dans la hiérarchie et audite l'ancien et le nouvel état. |
| `export class SetUserStatusUseCase` | Désactive (ou réactive) un compte. |
| `async execute(command: { userId: string; enabled: boolean; actor: ActorContext }): Promise<UserView>` | Désactive (sessions et jetons coupés aussitôt) ou réactive un compte ; jamais soi-même, jamais le dernier SuperAdmin actif. |
| `export class AssignRolesUseCase` | Remplace les rôles d'un utilisateur. |
| `async execute(command: { userId: string; roles: readonly string[]; actor: ActorContext }): Promise<UserView>` | Remplace les rôles d'un utilisateur : jamais les siens, jamais au point de supprimer le dernier SuperAdmin ; audite avant/après. |

### `modules/iam/application/admin/user-queries.ts`

| Déclaration | Rôle |
|---|---|
| `export interface ListUsersQuery` | Paramètres de la liste d'administration : page, taille, recherche et filtre de statut. |
| `export class ListUsersHandler` | Requête de lecture : liste paginée des utilisateurs avec leurs rôles. |
| `async execute(query: ListUsersQuery): Promise<Page<UserView>>` | Borne la page (taille ≤ 100) et renvoie les utilisateurs avec leurs rôles en deux requêtes. |
| `export class GetUserHandler` | Requête de lecture : un utilisateur et ses rôles. |
| `async execute(userId: string): Promise<UserView>` | Renvoie l'utilisateur ou lève « introuvable ». |
| `export class ListRolesHandler` | Requête de lecture : catalogue des rôles et de leurs permissions. |
| `execute(): Promise<RoleView[]>` | Renvoie tous les rôles avec leurs permissions et portées. |

### `modules/iam/application/admin/user-view.ts`

| Déclaration | Rôle |
|---|---|
| `export interface UserView` | Représentation publique d'un utilisateur : JAMAIS de hachage, de secret MFA ni de compteur interne. |
| `export function toUserView(user: User, roles: readonly string[]): UserView` | Transforme un utilisateur en représentation publique (jamais de hachage, de secret MFA ni de compteur interne). |
| `export interface RoleView` | Rôle tel qu'exposé à l'administration : code, libellé, description, MFA exigé et permissions. |
| `export interface RoleCatalogReader` | Lecture du catalogue des rôles et de leurs permissions, tels qu'enregistrés en base. |

### `modules/iam/application/authenticate-access-token.use-case.ts`

| Déclaration | Rôle |
|---|---|
| `export interface AuthenticatedActor` | Identité de l'appelant, établie à partir d'un jeton d'accès valide ET d'une session encore active. |
| `export class AuthenticateAccessTokenUseCase` | Vérifie le jeton (signature, expiration) puis l'état de la session : une session déconnectée, révoquée ou expirée refuse immédiatement le jeton, même encore valide cryptographiquement (révocation immédiate). |
| `async execute(token: string): Promise<AuthenticatedActor \| null>` | Authentifie un jeton d'accès : signature et échéance, session encore active, compte autorisé à se connecter, MFA effectivement vérifié. |

### `modules/iam/application/authorization.service.ts`

| Déclaration | Rôle |
|---|---|
| `export class AuthorizationService` | Autorisation côté serveur : les droits sont lus en base à chaque requête (jamais dans le jeton), donc un changement de rôle ou une désactivation prend effet immédiatement. |
| `async contextFor(userId: string): Promise<AccessContext>` | Lit en base les droits et l'équipe de l'utilisateur pour la durée de la requête (jamais depuis le jeton). |
| `async assertPermission(context: AccessContext, permission: string, actor: ActorContext, minScope?: ScopeName): Promise<void>` | Vérifie la permission au niveau de la route (sans objet précis) ; la portée est contrôlée ensuite, objet par objet. |

### `modules/iam/application/change-password.use-case.ts`

| Déclaration | Rôle |
|---|---|
| `export const PASSWORD_HISTORY_DEPTH = 5;` | Nombre de mots de passe passés refusés à la réutilisation (SECURITY.md §2.1). |
| `export interface ChangePasswordCommand` | Changement de mot de passe par l'utilisateur connecté : ancien mot de passe, nouveau mot de passe et session à conserver. |
| `export class ChangePasswordUseCase` | Changement de mot de passe par l'utilisateur connecté. |
| `async execute(command: ChangePasswordCommand): Promise<void>` | Vérifie l'ancien mot de passe, la politique et l'historique des 5 derniers, change le mot de passe, coupe les autres sessions et audite. |

### `modules/iam/application/create-user.use-case.ts`

| Déclaration | Rôle |
|---|---|
| `export interface CreateUserCommand` | Création directe d'un compte actif avec mot de passe (outil de démarrage et tests ; le parcours normal est l'invitation). |
| `export interface CreatedUser` | Compte créé : identifiant, adresse et rôles. |
| `export class CreateUserUseCase` | Création d'un compte actif avec mot de passe. |
| `async execute(command: CreateUserCommand): Promise<CreatedUser>` | Vérifie la politique de mot de passe et l'unicité de l'adresse, crée le compte, ses rôles et son historique, et l'audite. |

### `modules/iam/application/get-profile.handler.ts`

| Déclaration | Rôle |
|---|---|
| `export interface ProfileView` | Ce dont l'interface a besoin pour construire ses menus. |
| `export class GetProfileHandler` | Requête de lecture : profil et droits de l'utilisateur connecté, pour construire les menus de l'interface. |
| `async execute(userId: string): Promise<ProfileView>` | Renvoie nom, rôles, droits et état du MFA ; informatif seulement, le serveur re-contrôle chaque requête. |

### `modules/iam/application/login.use-case.ts`

| Déclaration | Rôle |
|---|---|
| `export interface LoginCommand` | Données d'une connexion : adresse, mot de passe et contexte du client (IP, appareil). |
| `export interface LoginSuccess extends IssuedTokens` | Connexion réussie : jetons, session, niveau de risque et état du MFA (exigé, configuré, vérifié). |
| `const RECENT_FAILURES_WINDOW_MS = 24 * 60 * 60 * 1000;` | Fenêtre d'observation des échecs récents pour le score de risque. |
| `const GENERIC_FAILURE = 'Identifiants invalides';` | Message unique : jamais de distinction entre e-mail inconnu, mauvais mot de passe, compte verrouillé ou inactif. |
| `export class LoginUseCase` | Connexion par mot de passe : message d'échec unique, verrouillage progressif, risque de la session, audit de chaque tentative. |
| `async execute(command: LoginCommand): Promise<LoginSuccess>` | Les échecs doivent être PERSISTÉS (compteur, tentative, audit) : on ne lève donc l'erreur qu'après la validation de la transaction, jamais à l'intérieur. |
| `private async attempt(command: LoginCommand): Promise<LoginOutcomeResult>` | Déroule une tentative sous verrou de ligne : compte inconnu (temps de hachage égalisé), verrouillé, inactif, mauvais mot de passe ou succès ; persiste toujours compteur, tentative et audit. |

### `modules/iam/application/logout.use-case.ts`

| Déclaration | Rôle |
|---|---|
| `export interface LogoutCommand` | Déconnexion : session à fermer et contexte de l'acteur. |
| `export class LogoutUseCase` | Déconnexion : idempotente (une session déjà terminée ne produit ni erreur ni nouvelle ligne d'audit). |
| `async execute(command: LogoutCommand): Promise<void>` | Ferme la session, révoque ses jetons de rafraîchissement et audite la déconnexion. |

### `modules/iam/application/mfa-enrollment.use-cases.ts`

| Déclaration | Rôle |
|---|---|
| `export const MFA_ISSUER = 'Investally CRM';` | Nom affiché dans l'application d'authentification de l'utilisateur. |
| `export interface MfaCommand` | Contexte commun des opérations MFA : utilisateur, session et acteur. |
| `export interface MfaEnrollmentStart` | Début d'enrôlement : secret (affiché une seule fois) et URI à transformer en QR code. |
| `export class StartMfaEnrollmentUseCase` | Démarre l'enrôlement TOTP : génère et stocke (chiffré) un secret ; le MFA n'est pas encore actif. |
| `async execute(command: MfaCommand): Promise<MfaEnrollmentStart>` | Génère un secret TOTP, le stocke chiffré (sans activer le MFA) et renvoie le secret et l'URI ; refuse si le MFA est déjà actif. |
| `export interface MfaEnrollmentConfirmed` | Enrôlement confirmé : 10 codes de secours en clair (affichés une seule fois) et nouveau jeton vérifié par MFA. |
| `export class ConfirmMfaEnrollmentUseCase` | Confirme l'enrôlement avec un premier code valide : active le MFA et délivre les codes de secours. |
| `async execute(command: MfaCommand & { code: string }): Promise<MfaEnrollmentConfirmed>` | L'échec est signalé APRÈS la validation de la transaction (le compteur d'échecs doit persister). |
| `private async confirm(command: MfaCommand & { code: string }): Promise<ConfirmResult>` | Vérifie le premier code (compte non verrouillé, secret déchiffré, anti-rejeu), active le MFA, marque la session vérifiée et génère les codes de secours. |
| `private async fail(command: MfaCommand, user: User, now: Date, reason: string, count: boolean): Promise<ConfirmResult>` | Enregistre un échec de confirmation (compteur, verrouillage progressif, audit) sans lever d'erreur dans la transaction. |

### `modules/iam/application/mfa-management.use-cases.ts`

| Déclaration | Rôle |
|---|---|
| `export class RegenerateRecoveryCodesUseCase` | Régénère les 10 codes de secours (les anciens deviennent invalides). |
| `async execute(command: { userId: string; sessionId: string; actor: ActorContext }): Promise<{ recoveryCodes: string[] }>` | Remplace les 10 codes de secours (les anciens cessent de fonctionner) ; exige un MFA récent. |
| `export class ResetMfaUseCase` | Réinitialise le MFA d'un AUTRE utilisateur (perte du téléphone) : secret et codes supprimés, TOUTES ses sessions révoquées. |
| `async execute(command: { targetUserId: string; actor: ActorContext }): Promise<void>` | Réinitialise le MFA d'un autre utilisateur (jamais le sien) : supprime secret et codes, coupe toutes ses sessions, audite. |

### `modules/iam/application/mfa-ports.ts`

| Déclaration | Rôle |
|---|---|
| `export interface SecretCipher` | Chiffrement du secret TOTP au repos. |
| `decrypt(blob: string, context: string): string;` | Lève une erreur si le chiffré a été altéré ou si le contexte ne correspond pas. |
| `export interface TotpGenerator` | Port : génération d'un secret TOTP. |
| `generateSecret(): string;` | Nouveau secret aléatoire de 160 bits, en base32 (format des applications d'authentification). |
| `export interface RecoveryCodeGenerator` | Port : génération d'un lot de codes de secours. |
| `generate(count: number): string[];` | `count` codes uniques, en forme normalisée (10 caractères, sans tiret). |
| `export interface RecoveryCodeRepository` | Port : stockage des codes de secours (hachages) et consommation atomique d'un code. |
| `replaceAll(userId: string, hashes: { id: string; hash: string }[], now: Date): Promise<void>;` | Remplace TOUS les codes de l'utilisateur par ces hachages (les anciens deviennent invalides). |
| `listUnused(userId: string): Promise<{ id: string; hash: string }[]>;` | Codes encore utilisables (non consommés). |
| `consume(id: string, now: Date): Promise<boolean>;` | Consomme atomiquement : `false` si un autre appel l'a déjà fait. |

### `modules/iam/application/ports.ts`

| Déclaration | Rôle |
|---|---|
| `export interface PasswordHasher` | Port : hachage et vérification des mots de passe (argon2id), avec une vérification factice pour égaliser le temps des comptes inconnus. |
| `verifyDummy(plain: string): Promise<void>;` | Effectue un calcul de même coût qu'une vraie vérification, sans compte réel. |
| `export interface AccessTokenClaims` | Revendications d'un jeton d'accès : identité, session et méthodes d'authentification (`pwd`, `otp`) ; aucune permission. |
| `export interface AccessTokenService` | Port : émission et vérification des jetons d'accès signés. |
| `issue(claims: AccessTokenClaims, ttlMs: number, now: Date): Promise<{ token: string; expiresAt: Date }>;` | Signe un jeton d'accès valable `ttlMs` millisecondes. |
| `verify(token: string, now: Date): Promise<AccessTokenClaims \| null>;` | Retourne les claims si le jeton est authentique et non expiré, `null` sinon. |
| `export interface RefreshTokenFactory` | Port : fabrique de jetons opaques et de leurs empreintes (rafraîchissement, invitation, réinitialisation). |
| `generate(): { token: string; hash: string };` | Jeton opaque aléatoire (256 bits) et son empreinte SHA-256 ; seule l'empreinte est stockée. |
| `export type OpaqueTokenFactory = RefreshTokenFactory;` | Jeton opaque aléatoire et son empreinte : même forme que le jeton de rafraîchissement, usage différent (invitations). |

### `modules/iam/application/refresh-session.use-case.ts`

| Déclaration | Rôle |
|---|---|
| `export interface RefreshCommand` | Rafraîchissement : jeton présenté (cookie) et contexte du client. |
| `export class RefreshSessionUseCase` | Échange un jeton de rafraîchissement contre un nouveau jeton d'accès et un nouveau jeton de rafraîchissement (rotation, détection de rejeu). |
| `async execute(command: RefreshCommand): Promise<IssuedTokens & { sessionId: string; userId: string }>` | Comme pour la connexion, l'échec est signalé APRÈS la validation de la transaction (la révocation doit persister). |
| `private async rotate(command: RefreshCommand): Promise<RefreshResult>` | Consomme le jeton de façon atomique ; un rejeu hors tolérance de 10 s coupe toute la famille et la session ; sinon émet la paire suivante. |

### `modules/iam/application/session-token.service.ts`

| Déclaration | Rôle |
|---|---|
| `export interface IssuedTokens` | Jeton d'accès et jeton de rafraîchissement émis, avec leurs échéances. |
| `export class SessionTokenService` | Émet le couple jeton d'accès + jeton de rafraîchissement d'une session (connexion et rotation). |
| `async issue(input: { session: UserSession; policy: SessionPolicy; familyId: string; amr: string[]; now: Date }): Promise<IssuedTokens>` | Émet le jeton d'accès et un nouveau jeton de rafraîchissement (dont l'empreinte est stockée) pour une session. |

### `modules/iam/application/verify-mfa.use-case.ts`

| Déclaration | Rôle |
|---|---|
| `export interface VerifyMfaCommand` | Vérification du second facteur : code TOTP ou code de secours, utilisateur, session et acteur. |
| `export interface MfaVerified` | Second facteur vérifié : nouveau jeton `pwd+otp`, heure de vérification et nombre de codes de secours restants si l'un vient d'être consommé. |
| `export class VerifyMfaUseCase` | Vérifie le second facteur : à la connexion (la session passe à « MFA vérifié ») ET pour un step-up (action sensible : l'horodatage est rafraîchi). |
| `async execute(command: VerifyMfaCommand): Promise<MfaVerified>` | L'échec est signalé APRÈS la validation de la transaction : compteur d'échecs et audit doivent persister. |
| `private async verify(command: VerifyMfaCommand): Promise<VerifyResult>` | Vérifie le code sous verrou de ligne (TOTP avec anti-rejeu, ou code de secours à usage unique) ; un échec compte comme un échec de connexion. |
| `private async consumeRecoveryCode(user: User, input: string, now: Date): Promise<{ ok: true; remaining: number } \| { ok: false }>` | Cherche parmi les codes non consommés celui qui correspond, puis le consomme atomiquement. |
| `private async fail(command: VerifyMfaCommand, user: User, now: Date, reason: string, count: boolean): Promise<VerifyResult>` | Enregistre un échec de vérification (compteur, verrouillage progressif, audit), sans lever d'erreur dans la transaction. |

### `modules/iam/domain/access-context.ts`

| Déclaration | Rôle |
|---|---|
| `export interface AccessContext` | Ce que l'on sait des droits de l'appelant pour la durée d'une requête (résolus depuis la base, jamais lus dans le jeton). |
| `export type Visibility = { unrestricted: true } \| { unrestricted: false; ownerIds: readonly string[] };` | Les objets qu'un acteur peut voir pour une permission : tous, ou ceux de ces propriétaires (liste vide = aucun). |
| `export function visibilityFor(context: AccessContext, permission: string): Visibility` | Traduit les droits de l'acteur en périmètre de lecture pour une permission : tout voir, voir les objets de certains propriétaires (lui, ou lui + ses subordonnés directs), ou rien. |
| `export function decideFor(context: AccessContext, permission: string, ownerId: string \| null \| undefined): AccessDecision` | Décision pour un objet précis (voir `decideAccess` pour la signification de `ownerId`). |

### `modules/iam/domain/access-policy.ts`

| Déclaration | Rôle |
|---|---|
| `export interface AccessRequest` | Question posée à la politique d'accès : droits de l'acteur, permission demandée, objet visé (propriétaire) et équipe de l'acteur. |
| `export function scopeCovers(granted: Scope, required: Scope): boolean` | `true` si la portée accordée couvre la portée exigée (Propre < Équipe < Tous). |
| `export function widestScope(grants: readonly ResolvedGrant[], permission: string): Scope \| null` | Portée la plus large accordée pour une permission, `null` si elle n'est pas accordée. |
| `export function decideAccess(request: AccessRequest): AccessDecision` | Règle de décision pure (aucune dépendance) : refus par défaut. |

### `modules/iam/domain/auth-repositories.ts`

| Déclaration | Rôle |
|---|---|
| `export interface UserRepository` | Port de persistance des utilisateurs : lecture, verrous de ligne pour les opérations concurrentes, rôles, liste d'administration et invariants (dernier SuperAdmin, hiérarchie). |
| `lockByEmailKey(emailKey: string): Promise<User \| null>;` | Charge l'utilisateur ET verrouille sa ligne pour la durée de la transaction en cours (`SELECT ... |
| `lockById(id: string): Promise<User \| null>;` | Comme `lockByEmailKey`, par identifiant (vérifications MFA : anti-rejeu et compteur d'échecs fiables). |
| `list(query: { page: number; pageSize: number; search?: string; status?: UserStatus }): Promise<Page<User>>;` | Liste paginée (recherche sur e-mail et nom), plus récents d'abord. |
| `replaceRoles(userId: string, roles: readonly RoleCode[], assignedBy: string \| null): Promise<void>;` | Remplace l'ensemble des rôles de l'utilisateur. |
| `lockSuperAdminInvariant(): Promise<void>;` | Verrouille (jusqu'à la fin de la transaction) la règle « il reste au moins un SuperAdmin actif ». |
| `managerChainOf(userId: string, maxDepth: number): Promise<string[]>;` | Responsables successifs de l'utilisateur (son responsable, puis le responsable de celui-ci…), au plus `maxDepth`. |
| `export interface GrantReader` | Lecture des droits d'un utilisateur, résolus depuis la base À CHAQUE requête (jamais dans le jeton). |
| `teamMemberIds(userId: string): Promise<string[]>;` | Subordonnés directs (portée Équipe). |
| `export interface InvitationRepository` | Port des liens à usage unique (invitation et réinitialisation de mot de passe) : seule l'empreinte du jeton est conservée. |
| `consume(tokenHash: string, now: Date): Promise<boolean>;` | Marque l'invitation comme utilisée **atomiquement** si, et seulement si, elle est encore valide. |
| `revokeAllOfUser(userId: string, now: Date): Promise<void>;` | Révoque toutes les invitations non utilisées de l'utilisateur (renvoi d'invitation). |
| `countCreatedSince(userId: string, purpose: string, since: Date): Promise<number>;` | Nombre de liens d'un usage donné émis pour l'utilisateur depuis `since` (plafond de demandes). |
| `export interface PasswordHistoryRepository` | Port de l'historique des mots de passe (hachages seulement) pour refuser la réutilisation des derniers. |
| `recentHashes(userId: string, limit: number): Promise<string[]>;` | Les `limit` derniers hachages (les plus récents d'abord). |
| `export interface KnownFingerprints` | Plages réseau et appareils déjà vus pour un compte, base du calcul du risque d'une nouvelle session. |
| `export interface SessionRepository` | Port de persistance des sessions : ouverture, lecture, révocation en masse et empreintes connues. |
| `knownFingerprints(userId: string): Promise<KnownFingerprints>;` | Plages réseau et appareils déjà utilisés par ce compte (sessions passées). |
| `revokeAllOfUserExcept(userId: string, keepSessionId: string \| null, now: Date, reason: string): Promise<string[]>;` | Révoque les sessions actives de l'utilisateur, sauf `keepSessionId`. |
| `listActiveOf(userId: string, now: Date): Promise<UserSession[]>;` | Sessions actuellement actives (ni déconnectées, ni révoquées, ni expirées) de l'utilisateur, récentes d'abord. |
| `export interface RefreshTokenRepository` | Port des jetons de rafraîchissement : consommation atomique (rotation), révocation par famille ou par session. |
| `consume(tokenHash: string, now: Date): Promise<boolean>;` | Marque le jeton comme utilisé **atomiquement** si, et seulement si, il est encore valide (non utilisé, non révoqué, non expiré). |
| `export interface LoginAttemptRepository` | Port du journal des tentatives de connexion (y compris pour des adresses inconnues) et du comptage des échecs récents. |
| `countRecentFailures(emailKey: string, since: Date): Promise<number>;` | Échecs (hors succès) pour ce compte depuis `since`. |

### `modules/iam/domain/base32.ts`

| Déclaration | Rôle |
|---|---|
| `export function base32Encode(bytes: Uint8Array): string` | Base32 (RFC 4648) sans remplissage : format attendu par les applications d'authentification. |
| `export function base32Decode(input: string): Buffer` | Décode du base32 ; tolère minuscules, espaces et `=` de fin ; refuse tout autre caractère. |

### `modules/iam/domain/email.ts`

| Déclaration | Rôle |
|---|---|
| `export class Email` | Objet-valeur : adresse e-mail validée et normalisée ; la clé en minuscules sert à l'unicité et à la recherche. |
| `static keyOf(raw: string): string` | Clé de recherche sans lever d'erreur (connexion : une adresse invalide = identifiants invalides). |

### `modules/iam/domain/hierarchy.ts`

| Déclaration | Rôle |
|---|---|
| `export function createsCycle(userId: string, managerId: string, ancestorsOfManager: readonly string[]): boolean` | Faire de `managerId` le responsable de `userId` crée-t-il un cycle hiérarchique ? |
| `export const MAX_HIERARCHY_DEPTH = 20;` | Profondeur maximale de remontée hiérarchique : au-delà, la hiérarchie est considérée comme corrompue (refus). |

### `modules/iam/domain/invitation.ts`

| Déclaration | Rôle |
|---|---|
| `export const INVITATION_TTL_MS = 48 * 60 * 60 * 1000;` | Durée de validité d'une invitation (décision : 48 h, SECURITY.md §2.6). |
| `export const InvitationPurpose = { Invitation: 'INVITATION', PasswordReset: 'PASSWORD_RESET' } as const;` | À quoi sert un lien : un lien d'invitation ne peut jamais réinitialiser un mot de passe, et inversement. |
| `export const SELF_SERVICE_RESET_TTL_MS = 60 * 60 * 1000;` | Lien de réinitialisation demandé par l'utilisateur lui-même : court, car la boîte e-mail devient la clé du compte. |
| `export const ADMIN_RESET_TTL_MS = INVITATION_TTL_MS;` | Lien de réinitialisation émis par un administrateur : même durée qu'une invitation. |
| `export const SELF_SERVICE_RESET_MAX_PER_HOUR = 3;` | Au plus 3 liens demandés par heure pour un même compte : empêche d'inonder une boîte e-mail ou de révoquer sans cesse les liens. |
| `export interface UserInvitationRecord` | Lien à usage unique : empreinte du jeton, usage (invitation ou réinitialisation), émetteur, échéance, date d'utilisation ou de révocation. |
| `export function evaluateInvitation(record: UserInvitationRecord, now: Date): InvitationDecision` | État d'une invitation présentée. |

### `modules/iam/domain/network.ts`

| Déclaration | Rôle |
|---|---|
| `export function networkRangeOf(ip: string): string` | Plage réseau d'une adresse IP, pour détecter un « nouveau réseau » sans être trop sensible aux changements d'adresse au sein d'un même fournisseur : IPv4 → /24, IPv6 → /64. |
| `export function deviceFingerprint(device: string): string` | Empreinte d'appareil simple (navigateur + système) : suffisante pour signaler un appareil inconnu. |

### `modules/iam/domain/password-policy.ts`

| Déclaration | Rôle |
|---|---|
| `export interface PasswordContext` | Identité de l'utilisateur, pour refuser un mot de passe qui la contient. |
| `export function checkPasswordPolicy(password: string, context: PasswordContext): string[]` | Politique de mot de passe (SECURITY.md §2.1, NIST SP 800-63B) : la longueur prime sur la complexité. |

### `modules/iam/domain/permission-catalog.ts`

| Déclaration | Rôle |
|---|---|
| `export interface ResourceDefinition` | Catalogue des permissions du CRM. |
| `export interface PermissionDefinition` | Une permission du catalogue : code `module.ressource.action`, module, ressource, action et description. |

### `modules/iam/domain/recovery-codes.ts`

| Déclaration | Rôle |
|---|---|
| `export const RECOVERY_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';` | Alphabet sans caractères ambigus (ni I, O, 0, 1) : 32 symboles = 5 bits par caractère. |
| `export function formatRecoveryCode(code: string): string` | Forme lisible : `ABCDE-FGHJK`. |
| `export function normalizeRecoveryCode(input: string): string \| null` | Normalise la saisie d'un utilisateur (casse, tirets, espaces) vers la forme stockée/hachée. |

### `modules/iam/domain/refresh-token.ts`

| Déclaration | Rôle |
|---|---|
| `export const REUSE_GRACE_MS = 10_000;` | Fenêtre pendant laquelle une seconde présentation du même jeton n'est PAS traitée comme un vol (deux onglets qui se rafraîchissent en même temps). |
| `export interface RefreshTokenRecord` | Jeton de rafraîchissement stocké : empreinte, session, famille de rotation, échéance, usage et révocation. |
| `export function evaluateRefresh(record: RefreshTokenRecord, now: Date): RefreshDecision` | Décide du sort d'un jeton de rafraîchissement présenté. |

### `modules/iam/domain/roles.ts`

| Déclaration | Rôle |
|---|---|
| `export interface RoleDefinition` | Un rôle métier : code, libellé, description et exigence de MFA (obligatoire pour tous depuis la décision du 2026-10-20). |
| `export interface Grant` | Droit accordé à un rôle : permission exacte ou motif (`bd.*`) et portée (Propre, Équipe, Tous). |
| `const g = (permission: string, scope: Scope): Grant => ({ permission, scope });` | Raccourci d'écriture d'un droit dans la matrice rôles → permissions. |
| `export interface ResolvedGrant` | Droit élargi : un motif est remplacé par les permissions exactes du catalogue. |
| `function expand(pattern: string): string[]` | Élargit un motif (`iam.*`) en codes de permission du catalogue ; un code exact reste tel quel, un motif inconnu ne donne rien. |
| `export function resolveGrants(role: RoleCode): ResolvedGrant[]` | Développe les motifs en codes exacts ; en cas de doublon, la portée la plus large l'emporte. |
| `export function unknownPatterns(): string[]` | Motifs de la matrice qui ne correspondent à aucune permission du catalogue (faute de frappe). |

### `modules/iam/domain/session-policy.ts`

| Déclaration | Rôle |
|---|---|
| `export interface SessionPolicy` | Durées d'une session : jeton d'accès, inactivité maximale, durée absolue (plus courtes pour les rôles privilégiés). |
| `export function sessionPolicyFor(roles: readonly RoleCode[]): SessionPolicy` | Un utilisateur cumulant plusieurs rôles reçoit la politique la plus stricte. |
| `export function hasPrivilegedRole(roles: readonly RoleCode[]): boolean` | Vrai si l'un des rôles est privilégié (SuperAdmin, Direction, Finance) : sa session absolue est plus courte. |

### `modules/iam/domain/session-risk.ts`

| Déclaration | Rôle |
|---|---|
| `export interface RiskSignals` | Signaux observés à la connexion (nouvel appareil, nouveau réseau, échecs récents) qui servent à calculer le risque de la session. |
| `export function assessRisk(signals: RiskSignals): RiskLevel` | Niveau de risque d'une session (SECURITY.md §3). |

### `modules/iam/domain/totp.ts`

| Déclaration | Rôle |
|---|---|
| `export const TOTP_WINDOW = 1;` | Pas de tolérance de part et d'autre du pas courant (dérive d'horloge du téléphone) : ±1 = ±30 s. |
| `export function hotp(secret: Buffer, counter: number, digits = TOTP_DIGITS): string` | HOTP (RFC 4226) : code à `digits` chiffres pour un compteur donné. |
| `export function timeStepOf(nowMs: number, stepSeconds = TOTP_STEP_SECONDS): number` | Pas de temps (RFC 6238) correspondant à un instant. |
| `export function totp(secret: Buffer, nowMs: number, digits = TOTP_DIGITS): string` | Code TOTP à 6 chiffres (RFC 6238) pour un secret et un instant donnés ; sert aux tests et à l'enrôlement. |
| `function equalCodes(a: string, b: string): boolean` | Compare deux codes en temps constant (aucune information ne fuit par la durée de la comparaison). |
| `export function verifyTotp(input:` | Vérifie un code TOTP dans la fenêtre ±TOTP_WINDOW et refuse le REJEU : un pas de temps déjà utilisé (ou antérieur) est rejeté (RFC 6238 §5.2). |
| `export function otpauthUri(input: { secretBase32: string; accountName: string; issuer: string }): string` | URI `otpauth://` à encoder en QR code côté interface (Microsoft/Google Authenticator). |

### `modules/iam/domain/user-session.ts`

| Déclaration | Rôle |
|---|---|
| `export const STEP_UP_MAX_AGE_MS = 10 * 60_000;` | Fraîcheur maximale d'une vérification MFA pour une action sensible (step-up, SECURITY.md §2.3). |
| `export interface UserSessionProps` | État d'une session : utilisateur, réseau, appareil, risque, MFA vérifié (et quand), activité et échéances. |
| `export class UserSession` | Session de connexion : ouverture, activité, vérification du MFA, révocation et expiration (inactivité ou durée absolue). |
| `isActive(now: Date): boolean` | Active = ni déconnectée, ni révoquée, ni expirée (inactivité ou durée absolue). |
| `touch(now: Date, policy: SessionPolicy): void` | Prolonge l'inactivité sans jamais dépasser l'expiration absolue. |
| `end(now: Date): void` | Déconnexion volontaire. |
| `revoke(now: Date, reason: string): void` | Révocation (sécurité, administrateur). |
| `markMfaVerified(now: Date): void` | Second facteur prouvé (connexion, ou step-up pour une action sensible). |
| `hasFreshMfa(now: Date, maxAgeMs: number = STEP_UP_MAX_AGE_MS): boolean` | `true` si le MFA a été vérifié depuis moins de `maxAgeMs` (jamais si l'horodatage est dans le futur). |
| `markRisk(level: RiskLevel): void` | Enregistre le niveau de risque calculé à l'ouverture de la session. |

### `modules/iam/domain/user.ts`

| Déclaration | Rôle |
|---|---|
| `export const LOCKOUT_THRESHOLD = 5;` | Échecs consécutifs tolérés avant le premier verrouillage. |
| `export interface UserProps` | État interne d'un utilisateur : identité, statut, mot de passe haché, compteurs de verrouillage, MFA, responsable, dates. |
| `export class User extends AggregateRoot` | Agrégat Utilisateur : compte, mot de passe, verrouillage progressif, MFA, responsable et statut. |
| `static create(input: { id: string; email: Email; displayName: string; passwordHash: string; managerId?: string \| null; now: Date }): User` | Crée un compte actif avec un mot de passe déjà haché (le hachage est fait par l'Application). |
| `static invite(input: { id: string; email: Email; displayName: string; managerId?: string \| null; now: Date }): User` | Compte invité : sans mot de passe, en attente. |
| `canAuthenticate(): boolean` | Seul un compte actif peut s'authentifier ; un compte en attente ou désactivé est refusé. |
| `isLocked(now: Date): boolean` | Vrai si le compte est verrouillé à cet instant (après des échecs répétés). |
| `registerFailedLogin(now: Date): void` | Enregistre un échec : à partir du 5e échec consécutif, verrouillage progressif (1, 5, 15, 60, 60… min). |
| `registerSuccessfulLogin(now: Date): void` | Enregistre une connexion réussie : remet à zéro les échecs et le verrouillage, note la date. |
| `clearLoginFailures(): void` | Après une vérification MFA réussie : les échecs consécutifs sont oubliés. |
| `changePassword(passwordHash: string, now: Date): void` | Remplace le mot de passe (déjà haché) ; lève aussi tout verrouillage en cours. |
| `beginMfaEnrollment(secretEnc: string): void` | Démarre (ou recommence) l'enrôlement : le secret chiffré est stocké mais le MFA n'est PAS encore actif. |
| `confirmMfaEnrollment(step: number): void` | Active le MFA une fois le premier code prouvé ; ce code est consommé (anti-rejeu). |
| `recordMfaStep(step: number): void` | Retient le dernier pas TOTP utilisé : un même code ne peut pas servir deux fois (anti-rejeu). |
| `registerFailedMfa(now: Date): void` | Échec MFA : même compteur et même verrouillage progressif que les échecs de mot de passe. |
| `resetMfa(): void` | Réinitialisation (perte du téléphone) : à l'initiative d'un administrateur uniquement. |
| `activateWithPassword(passwordHash: string, now: Date): void` | Fin d'invitation : l'utilisateur a choisi son mot de passe, le compte devient actif. |
| `enable(): void` | Réactive un compte désactivé (jamais un compte qui n'a pas encore choisi de mot de passe). |
| `rename(displayName: string): void` | Change le nom affiché (1 à 200 caractères). |
| `assignManager(managerId: string \| null): void` | Définit ou retire le responsable direct ; personne ne peut être son propre responsable. |
| `disable(): void` | Désactive le compte (aucune connexion possible) ; les sessions sont coupées par l'appelant. |

### `modules/iam/iam.module.ts`

| Déclaration | Rôle |
|---|---|
| `export class IamModule {}` | Module Identité et accès : comptes, authentification, MFA, sessions, rôles et permissions, invitations et réinitialisation de mot de passe. |

### `modules/iam/infrastructure/aes-gcm-secret-cipher.ts`

| Déclaration | Rôle |
|---|---|
| `export class AesGcmSecretCipher implements SecretCipher` | Chiffrement des secrets TOTP au repos : AES-256-GCM, IV aléatoire par chiffrement, et **données authentifiées liées à l'utilisateur** (AAD) : un secret copié d'un compte à un autre échoue au déchiffrement, et toute altération du chiffré est détectée. |
| `encrypt(plain: string, context: string): string` | Chiffre un secret (AES-256-GCM, IV aléatoire) ; `context` (l'identifiant de l'utilisateur) est authentifié : un secret copié sur un autre compte ne se déchiffre pas. |
| `decrypt(blob: string, context: string): string` | Déchiffre un secret ; toute altération, tout mauvais contexte ou toute mauvaise clé lève une erreur (jamais un résultat faux). |
| `function aad(context: string): Buffer` | Données associées authentifiées : lient le chiffré à son usage et à son propriétaire. |

### `modules/iam/infrastructure/argon2-password-hasher.ts`

| Déclaration | Rôle |
|---|---|
| `const OPTIONS = { algorithm: Algorithm.Argon2id, memoryCost: 19_456, timeCost: 2, parallelism: 1 } as const;` | argon2id, paramètres du minimum OWASP (SECURITY.md §2.1) : 19 MiB, 2 passes, 1 thread. |
| `export class Argon2PasswordHasher implements PasswordHasher` | Hachage des mots de passe en argon2id (19 Mio, 2 passes, 1 voie : recommandation OWASP). |
| `hash(plain: string): Promise<string>` | Hache un mot de passe en clair (sel aléatoire propre à chaque hachage). |
| `async verify(storedHash: string, plain: string): Promise<boolean>` | Vrai si le mot de passe correspond au hachage ; un hachage illisible donne `false`, jamais une exception qui révélerait l'état du compte. |
| `async verifyDummy(plain: string): Promise<void>` | Même coût qu'une vraie vérification (mêmes paramètres), sur un hachage qui ne correspond à aucun compte. |

### `modules/iam/infrastructure/crypto-generators.ts`

| Déclaration | Rôle |
|---|---|
| `export class CryptoTotpGenerator implements TotpGenerator` | Secret TOTP de 160 bits (recommandation RFC 4226), aléa cryptographique. |
| `generateSecret(): string` | Génère un secret TOTP de 160 bits (aléa cryptographique), encodé en base32. |
| `export class CryptoRecoveryCodeGenerator implements RecoveryCodeGenerator` | Codes de secours : `randomInt` est uniforme (pas de biais de modulo) ; unicité garantie dans un lot. |
| `generate(count: number): string[]` | Génère `count` codes de secours distincts, sans biais statistique. |

### `modules/iam/infrastructure/es256-access-token.service.ts`

| Déclaration | Rôle |
|---|---|
| `export class Es256AccessTokenService implements AccessTokenService` | Jeton d'accès JWT signé ES256 (asymétrique : l'ERP pourra vérifier sans connaître le secret de signature). |
| `async issue(claims: AccessTokenClaims, ttlMs: number, now: Date): Promise<{ token: string; expiresAt: Date }>` | Signe un jeton d'accès (ES256) : identité, session, méthodes d'authentification, émetteur, audience, échéance. |
| `async verify(token: string, now: Date): Promise<AccessTokenClaims \| null>` | Vérifie signature, algorithme, émetteur, audience et échéance ; renvoie les revendications, ou `null` pour tout jeton invalide (jamais d'exception). |

### `modules/iam/infrastructure/prisma-grant-reader.repository.ts`

| Déclaration | Rôle |
|---|---|
| `export class PrismaGrantReader implements GrantReader` | Droits d'un utilisateur lus en base à chaque requête (union des permissions de tous ses rôles). |
| `async grantsOf(userId: string): Promise<ResolvedGrant[]>` | Droits d'un utilisateur : union des droits de ses rôles, la portée la plus large l'emportant. |
| `async teamMemberIds(userId: string): Promise<string[]>` | Identifiants des subordonnés directs (portée Équipe) ; les comptes supprimés sont exclus. |
| `export class PrismaRoleCatalogReader implements RoleCatalogReader` | Lecture du catalogue des rôles et de leurs permissions tels qu'enregistrés en base (écran d'administration). |
| `async list(): Promise<RoleView[]>` | Liste les rôles avec leurs permissions et portées, par code. |

### `modules/iam/infrastructure/prisma-invitation.repository.ts`

| Déclaration | Rôle |
|---|---|
| `export class PrismaInvitationRepository implements InvitationRepository` | Persistance des liens à usage unique (invitation, réinitialisation) ; seule l'empreinte du jeton est écrite. |
| `async save(record: UserInvitationRecord): Promise<void>` | Enregistre un nouveau lien. |
| `async findByHash(tokenHash: string): Promise<UserInvitationRecord \| null>` | Retrouve un lien par l'empreinte du jeton présenté, ou `null`. |
| `async consume(tokenHash: string, now: Date): Promise<boolean>` | Compare-and-set atomique : deux acceptations simultanées du même lien, une seule voit `count = 1`. |
| `async revokeAllOfUser(userId: string, now: Date): Promise<void>` | Révoque tous les liens encore valides de l'utilisateur (un nouveau lien remplace les précédents). |
| `async countCreatedSince(userId: string, purpose: string, since: Date): Promise<number>` | Nombre de liens d'un usage donné émis depuis `since` (plafond de demandes « mot de passe oublié »). |

### `modules/iam/infrastructure/prisma-login-attempt.repository.ts`

| Déclaration | Rôle |
|---|---|
| `export class PrismaLoginAttemptRepository implements LoginAttemptRepository` | Journal des tentatives de connexion, y compris pour des adresses inconnues (aucune clé étrangère). |
| `async record(attempt: { id: string; emailKey: string; userId: string \| null; ipAddress: string; outcome: LoginOutcome; createdAt: Date }): Promise<vo` | Enregistre une tentative (adresse tronquée, IP, issue) ; sert au calcul du risque et aux enquêtes. |
| `async countRecentFailures(emailKey: string, since: Date): Promise<number>` | Nombre d'échecs (hors succès) pour cette adresse depuis `since`. |

### `modules/iam/infrastructure/prisma-password-history.repository.ts`

| Déclaration | Rôle |
|---|---|
| `export class PrismaPasswordHistoryRepository implements PasswordHistoryRepository` | Historique des hachages de mots de passe (jamais les mots de passe), pour interdire la réutilisation. |
| `async recentHashes(userId: string, limit: number): Promise<string[]>` | Les `limit` derniers hachages, du plus récent au plus ancien. |
| `async add(entry: { id: string; userId: string; passwordHash: string; createdAt: Date }): Promise<void>` | Ajoute un hachage à l'historique. |

### `modules/iam/infrastructure/prisma-recovery-code.repository.ts`

| Déclaration | Rôle |
|---|---|
| `export class PrismaRecoveryCodeRepository implements RecoveryCodeRepository` | Codes de secours MFA, stockés sous forme de hachages argon2 : on ne peut jamais les relire. |
| `async replaceAll(userId: string, hashes: { id: string; hash: string }[], now: Date): Promise<void>` | Remplace tous les codes de l'utilisateur (nouvelle série : les anciens cessent de fonctionner). |
| `async deleteAll(userId: string): Promise<void>` | Supprime tous les codes de secours (réinitialisation du MFA). |
| `async listUnused(userId: string): Promise<{ id: string; hash: string }[]>` | Codes non encore utilisés, pour comparer avec celui que présente l'utilisateur. |
| `async consume(id: string, now: Date): Promise<boolean>` | Compare-and-set atomique : un code de secours ne sert qu'une fois, même sous requêtes simultanées. |
| `async countUnused(userId: string): Promise<number>` | Nombre de codes de secours restants. |

### `modules/iam/infrastructure/prisma-refresh-token.repository.ts`

| Déclaration | Rôle |
|---|---|
| `export class PrismaRefreshTokenRepository implements RefreshTokenRepository` | Jetons de rafraîchissement : seule l'empreinte est stockée ; rotation à chaque usage, avec détection de rejeu par famille. |
| `async save(record: RefreshTokenRecord): Promise<void>` | Enregistre un jeton émis (empreinte, session, famille, échéance). |
| `async findByHash(tokenHash: string): Promise<RefreshTokenRecord \| null>` | Retrouve un jeton par son empreinte, ou `null`. |
| `async consume(tokenHash: string, now: Date): Promise<boolean>` | Compare-and-set atomique : une seule requête peut passer le jeton de « non utilisé » à « utilisé ». |
| `async revokeFamily(familyId: string, now: Date): Promise<void>` | Révoque toute la famille (rejeu détecté : la connexion d'origine est coupée). |
| `async revokeBySession(sessionId: string, now: Date): Promise<void>` | Révoque tous les jetons d'une session (déconnexion, désactivation, changement de mot de passe). |

### `modules/iam/infrastructure/prisma-session.repository.ts`

| Déclaration | Rôle |
|---|---|
| `const FINGERPRINT_HISTORY = 100;` | Nombre de sessions passées examinées pour reconnaître un appareil ou un réseau déjà vu. |
| `function toDomain(row: SessionRow): UserSession` | Reconstruit une session du domaine à partir d'une ligne de base de données. |
| `export class PrismaSessionRepository implements SessionRepository` | Persistance des sessions de connexion (PostgreSQL). |
| `async save(session: UserSession): Promise<void>` | Crée la session, ou met à jour ses champs variables (risque, MFA, activité, échéance, révocation). |
| `async findById(id: string): Promise<UserSession \| null>` | Retrouve une session par identifiant, ou `null`. |
| `async knownFingerprints(userId: string): Promise<KnownFingerprints>` | Plages réseau et appareils des dernières sessions du compte (calcul du risque d'une nouvelle connexion). |
| `async revokeAllOfUserExcept(userId: string, keepSessionId: string \| null, now: Date, reason: string): Promise<string[]>` | Révoque les sessions actives du compte, sauf celle à conserver ; renvoie les identifiants révoqués (pour couper aussi leurs jetons). |
| `async listActiveOf(userId: string, now: Date): Promise<UserSession[]>` | Sessions encore valides du compte (ni déconnectées, ni révoquées, ni expirées), la plus récente d'abord. |

### `modules/iam/infrastructure/prisma-user.repository.ts`

| Déclaration | Rôle |
|---|---|
| `function toDomain(row: UserRow): User` | Reconstruit un utilisateur du domaine à partir d'une ligne de base de données. |
| `export class PrismaUserRepository implements UserRepository` | Persistance PostgreSQL des utilisateurs et de leurs rôles (suppression logique, verrou optimiste sur la version). |
| `async findById(id: string): Promise<User \| null>` | Retrouve un utilisateur non supprimé, ou `null`. |
| `async lockByEmailKey(emailKey: string): Promise<User \| null>` | Charge l'utilisateur par adresse ET verrouille sa ligne jusqu'à la fin de la transaction : les opérations parallèles sur un même compte passent à la suite. |
| `async lockById(id: string): Promise<User \| null>` | Comme `lockByEmailKey`, par identifiant. |
| `async emailExists(emailKey: string): Promise<boolean>` | Vrai si un compte non supprimé utilise déjà cette adresse. |
| `async save(user: User): Promise<void>` | Verrou optimiste sur `version` : une modification concurrente non sérialisée est refusée, jamais écrasée. |
| `async roleCodesOf(userId: string): Promise<RoleCode[]>` | Codes des rôles de l'utilisateur. |
| `async assignRoles(userId: string, roles: readonly RoleCode[], assignedBy: string \| null): Promise<void>` | Ajoute les rôles à l'utilisateur ; un rôle absent de la base (seed non exécuté) est une erreur. |
| `async list(query: { page: number; pageSize: number; search?: string; status?: UserStatus }): Promise<Page<User>>` | Liste paginée pour l'administration, avec recherche (nom ou adresse) et filtre de statut. |
| `async rolesOfMany(userIds: readonly string[]): Promise<Map<string, RoleCode[]>>` | Rôles de plusieurs utilisateurs en une seule requête (évite une requête par ligne de liste). |
| `async replaceRoles(userId: string, roles: readonly RoleCode[], assignedBy: string \| null): Promise<void>` | Remplace l'ensemble des rôles de l'utilisateur. |
| `async lockSuperAdminInvariant(): Promise<void>` | Prend le verrou qui sérialise toute opération pouvant retirer un SuperAdmin : deux administrateurs ne peuvent pas retirer en même temps les deux derniers. |
| `async countActiveSuperAdmins(): Promise<number>` | Nombre de SuperAdmin actifs (il doit toujours en rester au moins un). |
| `async managerChainOf(userId: string, maxDepth: number): Promise<string[]>` | Chaîne des responsables au-dessus de l'utilisateur, bornée en profondeur (détection de cycle hiérarchique). |

### `modules/iam/infrastructure/seed-core.ts`

| Déclaration | Rôle |
|---|---|
| `export interface SeedReport` | Bilan du seed : permissions et rôles créés, droits ajoutés ou retirés. |
| `export async function seedCore(prisma: PrismaService, ids: IdGenerator): Promise<SeedReport>` | Synchronise la base sur le catalogue et la matrice du code (idempotent) : crée ou met à jour permissions, rôles système et leurs droits ; supprime ce qui n'existe plus dans le code. |

### `modules/iam/infrastructure/sha256-refresh-token-factory.ts`

| Déclaration | Rôle |
|---|---|
| `export class Sha256RefreshTokenFactory implements RefreshTokenFactory` | Jeton opaque de 256 bits (aléa cryptographique) ; seule son empreinte SHA-256 est stockée. |
| `generate(): { token: string; hash: string }` | Génère un jeton opaque de 256 bits (aléa cryptographique) et son empreinte SHA-256 ; seule l'empreinte est stockée. |
| `hashOf(token: string): string` | Empreinte SHA-256 d'un jeton présenté (pour le retrouver en base sans jamais le stocker). |

### `modules/iam/presentation/access-token.guard.ts`

| Déclaration | Rôle |
|---|---|
| `export class AccessTokenGuard implements CanActivate` | Authentification (qui es-tu ?). |
| `async canActivate(context: ExecutionContext): Promise<boolean>` | Authentifie la requête par son jeton `Bearer` ; sinon 401 avec `WWW-Authenticate: invalid_token` pour que le client sache rafraîchir. |
| `export const CurrentActor = createParamDecorator((_data: unknown, context: ExecutionContext): AuthenticatedActor` | Identité de l'appelant authentifié (à utiliser derrière `AccessTokenGuard`). |

### `modules/iam/presentation/admin.controllers.ts`

| Déclaration | Rôle |
|---|---|
| `function noStore(res: Response): void` | Les réponses d'administration ne doivent jamais être mises en cache (données personnelles). |
| `export class AdminUsersController` | Routes d'administration des utilisateurs (`/admin/users`) : chaque route exige une permission, certaines un MFA récent. |
| `invite(@Body() dto: InviteUserDto, @Access() access: AccessContext, @CurrentActor() actor: AuthenticatedActor, @Req() req: Request)` | Crée un compte en attente et envoie le lien d'activation (48 h, usage unique). |
| `roles(@Param('id', ParseUUIDPipe) id: string, @Body() dto: AssignRolesDto, @CurrentActor() actor: AuthenticatedActor, @Req() req: Request)` | Remplace les rôles. |
| `async resetUserMfa(@Param('id', ParseUUIDPipe) id: string, @CurrentActor() actor: AuthenticatedActor, @Req() req: Request): Promise<void>` | Perte du téléphone : supprime le secret et les codes de secours, révoque toutes les sessions. |
| `sendPasswordReset(@Param('id', ParseUUIDPipe) id: string, @CurrentActor() actor: AuthenticatedActor, @Req() req: Request)` | Mot de passe oublié, côté administrateur : envoie un lien de réinitialisation (48 h, usage unique). |
| `revokeAll(@Param('id', ParseUUIDPipe) id: string, @Access() access: AccessContext, @CurrentActor() actor: AuthenticatedActor, @Req() req: Request)` | Agit sur n'importe quel utilisateur : exige la portée « Tous » dès la garde (la portée « propre » ne suffit pas). |
| `export class AdminRolesController` | Route de lecture du catalogue des rôles (`/admin/roles`). |
| `export class SessionsController` | Mes sessions : je vois et je révoque les miennes (un SuperAdmin, en portée Tous, peut révoquer celles des autres). |
| `loginHistory(@Query() query: LoginHistoryQueryDto, @CurrentActor() actor: AuthenticatedActor, @Res({ passthrough: true }) res: Response)` | Mon historique de connexions (90 jours, réussies et échouées) : toujours le MIEN, jamais celui d'un autre. |
| `revokeAllOthers(@CurrentActor() actor: AuthenticatedActor, @Req() req: Request)` | Déconnecte tous mes autres appareils (la session courante reste ouverte). |

### `modules/iam/presentation/auth.controller.ts`

| Déclaration | Rôle |
|---|---|
| `const LOGIN_LIMIT = { default: { limit: 5, ttl: 60_000 } };` | 5 tentatives de connexion par minute et par couple IP + e-mail (SECURITY.md §2.4). |
| `const MFA_LIMIT = { default: { limit: 5, ttl: 60_000 } };` | 5 vérifications MFA par minute et par session (le verrouillage du compte est la vraie protection contre la force brute). |
| `const INVITATION_LIMIT = { default: { limit: 10, ttl: 60_000 } };` | 10 tentatives d'activation par minute et par IP (les jetons de 256 bits ne se devinent pas ; limite contre l'abus). |
| `const RESET_REQUEST_LIMIT = { default: { limit: 3, ttl: 60_000 } };` | 3 demandes de « mot de passe oublié » par minute et par couple IP + adresse ; le plafond par compte (3/heure) est dans le cas d'usage. |
| `const RESET_REQUEST_ANSWER = { message: "Si un compte correspond à cette adresse, un e-mail contenant un lien de réinitialisation vient d'être envoyé.` | Réponse unique, identique que le compte existe ou non. |
| `export class AuthController` | Routes d'authentification : connexion, rafraîchissement, déconnexion, MFA, mot de passe oublié, activation d'invitation, profil. |
| `profile(@CurrentActor() actor: AuthenticatedActor, @Res({ passthrough: true }) res: Response)` | Profil et droits de l'utilisateur connecté, pour construire l'interface (le serveur re-contrôle chaque requête). |
| `async startMfa(@CurrentActor() actor: AuthenticatedActor, @Req() req: Request, @Res({ passthrough: true }) res: Response)` | Démarre l'enrôlement : renvoie le secret (affiché une seule fois) et l'URI à transformer en QR code. |
| `async confirmMfa(@Body() dto: MfaCodeDto, @CurrentActor() actor: AuthenticatedActor, @Req() req: Request, @Res({ passthrough: true }) res: Response)` | Confirme l'enrôlement avec le premier code : renvoie les codes de secours (UNE seule fois) et un jeton vérifié par MFA. |
| `async verifyMfa(@Body() dto: MfaCodeDto, @CurrentActor() actor: AuthenticatedActor, @Req() req: Request, @Res({ passthrough: true }) res: Response)` | Vérifie le second facteur (code TOTP ou code de secours) : à la connexion, et pour un step-up. |
| `async regenerateRecoveryCodes(@CurrentActor() actor: AuthenticatedActor, @Req() req: Request, @Res({ passthrough: true }) res: Response)` | Régénère les 10 codes de secours ; exige un MFA vérifié depuis moins de 10 minutes. |
| `async acceptInvitation(@Body() dto: AcceptInvitationDto, @Req() req: Request, @Res({ passthrough: true }) res: Response): Promise<void>` | Activation d'un compte invité : l'utilisateur choisit son mot de passe avec le jeton du lien (fragment d'URL). |
| `requestPasswordReset(@Body() dto: RequestPasswordResetDto, @Req() req: Request, @Res({ passthrough: true }) res: Response)` | « Mot de passe oublié » (public). |
| `async acceptPasswordReset(@Body() dto: ResetPasswordDto, @Req() req: Request, @Res({ passthrough: true }) res: Response): Promise<void>` | Choix du nouveau mot de passe avec le lien reçu (public) ; tout lien non valide produit le même refus. |
| `private assertAllowedOrigin(req: Request): void` | Défense CSRF en plus de `SameSite=Strict` : une requête navigateur dont l'en-tête Origin n'est pas autorisé est refusée. |
| `private cookieOptions(): CookieOptions` | Options du cookie de rafraîchissement : HttpOnly, SameSite=Strict, Secure en production, limité au chemin d'authentification. |
| `private setRefreshCookie(res: Response, token: string, expiresAt: Date): void` | Pose le cookie de rafraîchissement avec son échéance. |
| `private clearRefreshCookie(res: Response): void` | Efface le cookie de rafraîchissement (déconnexion ou jeton refusé). |
| `function noStore(res: Response): void` | Les réponses d'authentification ne doivent jamais être mises en cache (jetons, identités). |

### `modules/iam/presentation/dto/admin.dto.ts`

| Déclaration | Rôle |
|---|---|
| `export class ListUsersDto` | Paramètres de la liste des utilisateurs : page, taille ≤ 100, recherche ≤ 100 caractères, statut connu. |
| `export class InviteUserDto` | Corps d'une invitation : adresse, nom, 1 à 10 rôles, responsable facultatif ; tout autre champ est refusé. |
| `export class UpdateUserDto` | Corps d'une modification : nom et/ou responsable. |
| `export class AssignRolesDto` | Corps d'une attribution de rôles : 1 à 10 codes de rôle. |
| `export class AcceptInvitationDto` | Corps d'activation d'un compte invité : jeton du lien et mot de passe choisi (tailles bornées). |
| `export class RequestPasswordResetDto` | Corps de « mot de passe oublié » : l'adresse saisie, sans validation de forme (la réponse est identique pour toute saisie). |
| `export class ResetPasswordDto` | Corps du choix d'un nouveau mot de passe : jeton du lien (fragment d'URL) et mot de passe, tailles bornées. |
| `export class LoginHistoryQueryDto` | Paramètres de l'historique des connexions : taille (1 à 100) et curseur `before` (date ISO 8601 de la page précédente). |

### `modules/iam/presentation/dto/auth.dto.ts`

| Déclaration | Rôle |
|---|---|
| `export class LoginDto` | Corps de connexion : adresse et mot de passe, tailles bornées (un mot de passe démesuré n'atteint jamais le hachage). |
| `export class ChangePasswordDto` | Corps de changement de mot de passe : ancien et nouveau, tailles bornées. |
| `export class MfaCodeDto` | Corps d'une vérification MFA : code TOTP à 6 chiffres ou code de secours. |

### `modules/iam/presentation/mfa.guards.ts`

| Déclaration | Rôle |
|---|---|
| `function actorOf(context: ExecutionContext): AuthenticatedActor \| undefined` | Lit l'identité posée sur la requête par la garde d'authentification. |
| `export class RequireMfaGuard implements CanActivate` | Exige que le second facteur ait été vérifié pour cette session (jeton portant `otp`). |
| `canActivate(context: ExecutionContext): boolean` | Refuse (403 `MFA_REQUIRED`) tant que le second facteur n'est pas vérifié pour cette session. |
| `export class RequireRecentMfaGuard implements CanActivate` | Step-up : pour une action sensible (changement de rôle, export, suppression), le MFA doit avoir été vérifié depuis moins de 10 minutes. |
| `canActivate(context: ExecutionContext): boolean` | Refuse `MFA_REQUIRED` sans second facteur vérifié, et `MFA_STEP_UP_REQUIRED` s'il date de plus de 10 minutes. |

### `modules/iam/presentation/protected.decorator.ts`

| Déclaration | Rôle |
|---|---|
| `interface RequestWithIdentity` | Requête enrichie par les gardes : IP, en-têtes, identité authentifiée et droits résolus. |
| `export class PermissionGuard implements CanActivate` | Vérifie que l'appelant possède la permission déclarée par `@Protected(...)`. |
| `async canActivate(context: ExecutionContext): Promise<boolean>` | Vérifie que la route déclare une permission du catalogue (sinon refus), résout les droits de l'appelant en base et exige la permission, et la portée minimale si elle est demandée. |
| `export function Protected(permission: string, options: { stepUp?: boolean; minScope?: ScopeName } = {})` | Protège une route : identité (jeton valide, session active) → MFA vérifié → permission → (optionnel) MFA récent. |
| `export const Access = createParamDecorator((_data: unknown, context: ExecutionContext): AccessContext` | Contexte d'accès de l'appelant (droits, équipe) — à utiliser derrière `@Protected`. |

### `modules/notifications/application/email-sender.ts`

| Déclaration | Rôle |
|---|---|
| `export interface EmailMessage` | Un e-mail : destinataire unique, sujet, texte brut obligatoire et HTML facultatif. |
| `export type EmailResult = { ok: true } \| { ok: false; reason: 'INVALID' \| 'REJECTED' \| 'UNAVAILABLE' };` | Résultat d'un envoi. |
| `export interface EmailSender` | Port d'envoi d'e-mails ; ne lève jamais d'exception, renvoie une issue (`ok` ou raison de l'échec). |
| `export function invalidReason(message: EmailMessage): string \| null` | Validation commune avant tout envoi. |

### `modules/notifications/infrastructure/log-email-sender.ts`

| Déclaration | Rôle |
|---|---|
| `export class LogEmailSender implements EmailSender` | Adaptateur de développement et de test : N'ENVOIE RIEN. |
| `async send(message: EmailMessage): Promise<EmailResult>` | N'envoie rien : valide le message, le garde en mémoire (tests) et ne journalise que le domaine du destinataire (le contenu seulement en développement, sur demande explicite). |
| `get sent(): readonly EmailMessage[]` | Messages « envoyés » depuis le démarrage (les plus récents en dernier). |

### `modules/notifications/infrastructure/microsoft-graph-email-sender.ts`

| Déclaration | Rôle |
|---|---|
| `const TOKEN_MARGIN_MS = 120_000;` | Marge avant l'expiration réelle du jeton : on le renouvelle un peu plus tôt. |
| `export class MicrosoftGraphEmailSender implements EmailSender` | Envoi via Microsoft Graph (`POST /users/{expéditeur}/sendMail`) avec les identifiants de l'APPLICATION (flux « client credentials » : aucun utilisateur humain, une boîte d'expédition dédiée, permission `Mail.Send`). |
| `async send(message: EmailMessage): Promise<EmailResult>` | Envoie par Microsoft Graph avec un jeton d'application ; toute erreur devient une issue d'échec sans secret dans les journaux. |
| `private sendUrl(): string` | Adresse de l'API `sendMail` de la boîte d'expédition configurée. |
| `private payload(message: EmailMessage)` | Corps de la requête Graph : sujet, contenu (texte ou HTML) et destinataire. |
| `private async token(): Promise<string \| null>` | Jeton d'application, mis en cache jusqu'à (expiration − marge). |

### `modules/notifications/notifications.module.ts`

| Déclaration | Rôle |
|---|---|
| `export class NotificationsModule {}` | Module de notifications : fournit le port d'envoi d'e-mails (journal en développement, Microsoft 365 en production). |

### `platform/app-config.loader.ts`

| Déclaration | Rôle |
|---|---|
| `function parseEnvironment(raw: string \| undefined): AppEnvironment` | Lit l'environnement d'exécution (`production`, `test`, sinon développement). |
| `function pem(raw: string \| undefined): string \| null` | PEM passés en variable d'environnement : les retours à la ligne sont souvent écrits `\n`. |
| `export function loadAppConfig(env: NodeJS.ProcessEnv = process.env): AppConfig` | Lit et VALIDE la configuration. |

### `platform/app-throttler.guard.ts`

| Déclaration | Rôle |
|---|---|
| `interface RequestLike` | Forme minimale d'une requête pour calculer la clé de limitation de débit. |
| `function sessionHint(authorization: string \| string[] \| undefined): string` | Identifiant de session lu dans le jeton SANS vérifier sa signature (clé de limitation uniquement). |
| `export class AppThrottlerGuard extends ThrottlerGuard` | Limitation de débit : par IP en général (100 req/min) ; pour la connexion, par couple IP + e-mail, afin qu'un attaquant ne puisse ni cibler un compte depuis une IP, ni bloquer un compte depuis une autre IP. |
| `protected async getTracker(req: Record<string, unknown>): Promise<string>` | Clé de limitation : IP + adresse saisie pour la connexion et « mot de passe oublié », IP + session pour le MFA, IP sinon. |

### `platform/health.controller.ts`

| Déclaration | Rôle |
|---|---|
| `export class HealthController` | Sondes de santé : `live` (le processus répond) et `ready` (la base répond). |
| `live()` | Le processus répond. |
| `async ready()` | Vérifie la base de données ; 503 si elle ne répond pas. |

### `platform/origin.guard.ts`

| Déclaration | Rôle |
|---|---|
| `export class OriginGuard implements CanActivate` | Défense CSRF globale en plus de `SameSite=Strict` : toute requête qui MODIFIE (POST, PUT, PATCH, DELETE) et dont l'en-tête `Origin` n'est pas autorisé est refusée, sur TOUTES les routes (aucune route ne peut l'oublier). |
| `canActivate(context: ExecutionContext): boolean` | Défense CSRF globale : une requête qui modifie des données avec une origine non autorisée est refusée ; les méthodes de lecture et les clients sans en-tête `Origin` passent. |

### `platform/platform.module.ts`

| Déclaration | Rôle |
|---|---|
| `export class PlatformModule {}` | Module technique commun : accès base (Prisma), horloge, générateur d'identifiants, unité de travail et configuration. |

### `platform/prisma.service.ts`

| Déclaration | Rôle |
|---|---|
| `export class PrismaService implements OnModuleDestroy, UnitOfWork` | Accès unique à Prisma. |
| `run<T>(work: () => Promise<T>): Promise<T>` | UnitOfWork : agrégat et audit sont écrits atomiquement. |
| `async ping(): Promise<void>` | Requête minimale pour vérifier que la base répond. |
| `async onModuleDestroy(): Promise<void>` | Ferme proprement la connexion à l'arrêt de l'application. |

### `platform/problem-details.filter.ts`

| Déclaration | Rôle |
|---|---|
| `export class ProblemDetailsFilter implements ExceptionFilter` | Traduit les erreurs en RFC 7807 (application/problem+json). |
| `export function describeForLog(exception: unknown): string` | Ce qu'on écrit dans les journaux pour une erreur inattendue. |

### `platform/system-clock.ts`

| Déclaration | Rôle |
|---|---|
| `export class SystemClock implements Clock` | Horloge réelle (remplacée par une horloge contrôlée dans les tests). |
| `now(): Date` | Heure courante. |

### `platform/uuid-v7-generator.ts`

| Déclaration | Rôle |
|---|---|
| `export class UuidV7Generator implements IdGenerator` | UUID v7 (RFC 9562) : 48 bits d'horodatage ms + aléa. |
| `next(): string` | Génère un UUID v7 : triable par date de création (bon pour les index) avec 74 bits d'aléa. |

### `shared-kernel/actor-context.ts`

| Déclaration | Rôle |
|---|---|
| `export interface ActorContext` | Qui agit, depuis où : porté de la requête jusqu'au journal d'audit. |

### `shared-kernel/aggregate-root.ts`

| Déclaration | Rôle |
|---|---|
| `protected record(event: DomainEvent): void` | Retient un événement de domaine à publier après l'enregistrement. |
| `pullEvents(): DomainEvent[]` | Retourne puis vide les événements en attente. |

### `shared-kernel/app-config.ts`

| Déclaration | Rôle |
|---|---|
| `export interface AppConfig` | Configuration validée au démarrage, lue depuis l'environnement (jamais depuis le dépôt). |

### `shared-kernel/domain-error.ts`

| Déclaration | Rôle |
|---|---|
| `export class DomainError extends Error` | Erreur métier typée. |

### `shared-kernel/domain-event.ts`

| Déclaration | Rôle |
|---|---|
| `export interface DomainEvent` | Fait métier passé : nom, date, type et identifiant de l'agrégat concerné. |

### `shared-kernel/ports.ts`

| Déclaration | Rôle |
|---|---|
| `export interface Clock` | Ports techniques transverses, implémentés par l'Infrastructure. |
| `export interface IdGenerator` | Port : génération d'identifiants uniques. |
| `export interface UnitOfWork` | Exécute le travail dans une transaction unique (agrégat + audit atomiques). |
| `export interface Page<T>` | Page de résultats : éléments, total, numéro et taille de page. |

### `shared-kernel/request-context.ts`

| Déclaration | Rôle |
|---|---|
| `export interface RequestLike` | Forme minimale d'une requête HTTP (sans dépendre d'Express) pour construire le contexte d'audit. |
| `export function actorContextFrom(req: RequestLike, identity: { userId: string \| null; sessionId: string \| null } = { userId: null, sessionId: null }` | Qui agit, depuis où : IP et appareil de la requête (l'identité est ajoutée une fois l'utilisateur authentifié). |

## Interface web — pages (Next.js) — 53 déclarations commentées

### `(app)/account/page.tsx`

| Déclaration | Rôle |
|---|---|
| `export default function AccountPage()` | Page « Mon compte » : profil, changement de mot de passe, nouveaux codes de secours et accès aux sessions et à l'historique des connexions de l'utilisateur connecté. |
| `function PasswordForm({ email }: { email: string })` | Formulaire de changement de mot de passe : indications en direct, confirmation obligatoire, message d'erreur du serveur affiché tel quel. |
| `async function submit(event: FormEvent)` | Envoie l'ancien et le nouveau mot de passe ; les champs sont vidés après succès (le serveur coupe les autres sessions). |
| `function RecoveryCodes()` | Régénération des codes de secours : confirmation explicite d'abord (action irréversible), puis code MFA récent si nécessaire, puis affichage UNIQUE des nouveaux codes (copie, fichier, impression). |
| `async function regenerate()` | Appelle la régénération et garde les codes en mémoire uniquement, jusqu'à ce que l'utilisateur ait terminé. |
| `function SessionsLink()` | Lien vers la page « Sessions et connexions » (sessions actives, révocation, historique des connexions). |

### `(app)/account/sessions/page.tsx`

| Déclaration | Rôle |
|---|---|
| `type Pending = { kind: 'one'; session: SessionView } \| { kind: 'others'; count: number };` | Ce que la fenêtre de confirmation s'apprête à faire. |
| `export default function SessionsPage()` | Sessions et connexions (S01 à S03) : mes sessions actives, avec révocation confirmée (une seule, ou toutes les autres d'un coup, avec un MFA récent demandé par l'interface si besoin), et l'historique de mes connexions sur 90 jours. |
| `async function confirm()` | Exécute la révocation confirmée, annonce le résultat puis recharge les deux listes (la révocation est tracée dans le journal). |

### `(app)/admin/users/page.tsx`

| Déclaration | Rôle |
|---|---|
| `export default function UsersPage()` | Page d'administration des utilisateurs : liste, recherche, filtre, pagination et actions (inviter, rôles, désactiver, réinitialiser mot de passe ou MFA, couper les sessions). |
| `async function run(action: () => Promise<unknown>, success: string)` | Exécute une action d'administration, affiche son résultat (succès ou message du serveur), ferme la fenêtre et recharge la liste. |
| `function confirmAction(user: UserView, action: 'disable' \| 'enable' \| 'resetMfa' \| 'revokeSessions' \| 'resend' \| 'resetPassword')` | Associe chaque action de confirmation à son appel d'API et à son message de succès. |
| `function rowActions(user: UserView)` | Actions possibles sur un compte, selon les droits de l'utilisateur connecté (le serveur re-contrôle tout). |
| `function InviteDialog({ roles, managers, onClose, onSubmit }:` | Fenêtre d'invitation : adresse, nom, rôles et responsable facultatif. |
| `async function submit(event: FormEvent)` | Envoie l'invitation avec les rôles cochés (au moins un). |
| `function RolesDialog({ user, roles, isSelf, onClose, onSubmit }:` | Fenêtre de modification des rôles d'un utilisateur ; le changement s'applique immédiatement, y compris aux sessions ouvertes. |

### `(app)/agenda/page.tsx`

| Déclaration | Rôle |
|---|---|
| `export default function AgendaPage()` | L'agenda : rendez-vous et visites visibles selon la portée de l'utilisateur, en vue jour, semaine ou mois. |
| `function AppointmentButton({ appointment: a, compact, onOpen }: { appointment: Appointment; compact?: boolean; onOpen: (a: Appointment) => void })` | Un rendez-vous dans une liste : heure, type, entreprise, état ; ouvre sa fiche. |
| `function DaySection({ day, items, today, onOpen }: { day: string; items: Appointment[]; today: string; onOpen: (a: Appointment) => void })` | Un jour d'une vue jour ou semaine. |
| `function MonthGrid({ anchor, days, byDay, today, title, onOpen, onDay }:` | Grille du mois : une ligne par semaine (du lundi au dimanche), les rendez-vous du jour en liste compacte. |

### `(app)/companies/[id]/page.tsx`

| Déclaration | Rôle |
|---|---|
| `export default function CompanyPage()` | Fiche d'une entreprise (version minimale de S3.6) : identité de l'entreprise et ses documents. |
| `async function exportSheet()` | Exporte la fiche : le serveur contrôle la portée et trace l'export ; le navigateur propose l'enregistrement en PDF. |

### `(app)/companies/page.tsx`

| Déclaration | Rôle |
|---|---|
| `export default function CompaniesPage()` | Entreprises visibles selon la portée de l'utilisateur : tableau du design avec recherche, filtres (statut avec effectifs, pays, secteur), tri par colonne, colonnes au choix, pagination et sélection persistante ; création dans une fenêtre (si le droit existe). |
| `function FilterSelect({ label, value, options, onChange }: { label: string; value: string; options: string[]; onChange: (value: string) => void })` | Liste déroulante d'un filtre (valeurs réellement présentes dans la portée de l'utilisateur). |
| `function ColumnsMenu({ visible, onToggle }: { visible: readonly CompanyColumnId[]; onToggle: (id: CompanyColumnId) => void })` | Menu « Colonnes » : une case par colonne ; la colonne du nom est toujours affichée. |

### `(app)/contacts/page.tsx`

| Déclaration | Rôle |
|---|---|
| `export default function ContactsPage()` | Contacts visibles selon la portée de l'utilisateur (celle de leur entreprise) : recherche, filtre par fonction, pagination, sélection persistante, création dans une fenêtre (l'entreprise se choisit parmi celles de sa portée). |

### `(app)/followups/page.tsx`

| Déclaration | Rôle |
|---|---|
| `export default function FollowupsPage()` | La page « Relances » : la liste « À faire » des offres visibles selon la portée de l'utilisateur, triée par échéance. |

### `(app)/layout.tsx`

| Déclaration | Rôle |
|---|---|
| `export default function AppLayout({ children }: { children: ReactNode })` | Cadre de toutes les pages connectées : n'affiche rien tant que l'utilisateur n'est pas authentifié avec son second facteur, puis place la page dans la coque (navigation, barre supérieure, panneau principal centré). |

### `(app)/offers/page.tsx`

| Déclaration | Rôle |
|---|---|
| `const STATUS_OPTIONS = [{ value: '', label: 'Toutes' }, ...Object.entries(OFFER_STATUS).map(([value, style]) => ({ value, label: style.label }))];` | Filtre par état : « Toutes » puis chaque état de l'offre. |
| `export default function OffersPage()` | Offres visibles selon la portée de l'utilisateur (celle de leur entreprise) : recherche, filtre par état, pagination, sélection persistante, et le cycle d'une offre (créer, modifier, déposer, réponse du client, retirer) depuis le menu d'une ligne. |

### `(app)/opportunities/page.tsx`

| Déclaration | Rôle |
|---|---|
| `export default function OpportunitiesPage()` | Le pipeline commercial : cartes par lignes de six, ou colonnes par étape (bascule), selon la portée de l'utilisateur. |
| `function OpportunityCard({ opportunity: o, rights, onAction, compact }: { opportunity: Opportunity; rights: OpportunityRights; onAction: (a: Opportuni` | Une opportunité en carte : intitulé (ouvre la fiche), entreprise, montant, étape, dernière activité, menu d'actions. |

### `(app)/page.tsx`

| Déclaration | Rôle |
|---|---|
| `export default function HubPage()` | Vue d'ensemble : point d'entrée de l'application (EXD-05). |

### `forgot-password/page.tsx`

| Déclaration | Rôle |
|---|---|
| `export default function ForgotPasswordPage()` | Page « Mot de passe oublié » : accessible sans connexion, réservée aux visiteurs non connectés. |
| `function ForgotPasswordForm()` | Demande un lien de réinitialisation (A08) puis confirme l'envoi (A09). |
| `async function submit(event: FormEvent)` | Demande le lien ; affiche toujours la même confirmation, seule une erreur de limitation ou de panne est signalée. |

### `invitation/page.tsx`

| Déclaration | Rôle |
|---|---|
| `export default function InvitationPage()` | Page d'activation d'un compte invité (A13) : lit le jeton dans le fragment de l'URL, l'efface de l'adresse, puis laisse choisir le mot de passe. |
| `async function submit(event: FormEvent)` | Envoie le jeton et le mot de passe ; un refus (lien invalide, mot de passe refusé) est affiché et le lien reste utilisable si c'est le mot de passe qui est en cause. |

### `layout.tsx`

| Déclaration | Rôle |
|---|---|
| `export default function RootLayout({ children }: { children: ReactNode })` | Structure HTML commune (langue française) et fournisseur d'authentification de toute l'application. |

### `login/page.tsx`

| Déclaration | Rôle |
|---|---|
| `export default function LoginPage()` | Page de connexion, réservée aux visiteurs non connectés. |
| `function LoginForm()` | Formulaire de connexion (A01) : adresse et mot de passe, lien « Mot de passe oublié ». |
| `async function submit(event: FormEvent)` | Tente la connexion ; en cas d'échec affiche le message du serveur et vide le mot de passe. |

### `mfa/page.tsx`

| Déclaration | Rôle |
|---|---|
| `export default function MfaPage()` | Page du second facteur : vérification d'un code, ou première configuration si le MFA n'est pas encore en place. |
| `function MfaScreen()` | Choisit l'écran (configuration ou vérification) selon l'état de la session. |
| `function AccountFooter()` | Pied des écrans MFA : compte connecté et possibilité d'en changer. |
| `function Verification()` | Saisie du code du second facteur (A02) ou d'un code de secours à usage unique (A03). |
| `async function submit(event: FormEvent)` | Envoie le code ; un échec est affiché et le champ vidé (une seule requête par tentative). |
| `function groupSecret(secret: string): string` | Présente la clé manuelle par groupes de 4 caractères pour la saisir plus facilement. |
| `function Enrollment()` | Première configuration du MFA en trois écrans : introduction (A04), QR code et confirmation du premier code (A05, A06), codes de secours à affichage unique (A07). |
| `async function begin()` | Démarre la configuration (un seul appel : chaque appel génère un nouveau secret et invaliderait le QR affiché). |
| `async function confirm(event: FormEvent)` | Confirme l'enrôlement avec le code saisi ; en cas de succès les codes de secours sont affichés et le secret effacé de la mémoire. |

### `reset-password/page.tsx`

| Déclaration | Rôle |
|---|---|
| `export default function ResetPasswordPage()` | Page ouverte depuis le lien reçu par e-mail (A10 à A12). |
| `async function submit(event: FormEvent)` | Envoie le jeton et le nouveau mot de passe ; le serveur coupe toutes les sessions, l'utilisateur doit se reconnecter avec son second facteur. |

## Interface web — composants — 103 déclarations commentées

### `admin/rights-preview.tsx`

| Déclaration | Rôle |
|---|---|
| `export function RightsPreview({ roles, selected }: { roles: RoleView[]; selected: string[] })` | Aperçu en LECTURE SEULE des droits qu'obtiendra la personne avec les rôles cochés, regroupés par module (EXD-14). |

### `admin/role-picker.tsx`

| Déclaration | Rôle |
|---|---|
| `export function RolePicker({ roles, selected, onChange, original, locked }:` | Choix des rôles d'un utilisateur (EXD-14) : les rôles sont rangés par FAMILLE, chacun est une carte entièrement cliquable, un compteur annoncé dit combien de rôles et de permissions sont choisis, « Tout désélectionner » vide la sélection, et l'aperçu des droits effectifs (par module) se met à jour à chaque choix. |

### `app-shell.tsx`

| Déclaration | Rôle |
|---|---|
| `export const FOCUS_SEARCH_EVENT = 'investally:focus-search';` | Événement envoyé au hub pour mettre le focus dans la recherche globale (raccourci Ctrl/⌘ K, bouton de la barre). |
| `export function AppShell({ children }: { children: ReactNode })` | Coque de toutes les pages connectées (EXD-01, EXD-05, EXD-10, EXD-11) : - navigation complète sur la Vue d'ensemble, rail compact ailleurs avec un bouton-pictogramme pour la déplier ; - panneau principal centré sur la fenêtre (marge gauche ≥ navigation, repli automatique quand la fenêtre est étroite) ; - sur mobile, la navigation devient un tiroir ouvert par le bouton de menu. |
| `const openSearch = useCallback(()` | Va à la recherche globale du hub (ou y met le focus si l'on y est déjà). |
| `function ShellLink({ href, icon, label, current, railOnly, centered, rail }: { href: string; icon: IconName; label: string; current: boolean; railOnly` | Lien de navigation : pictogramme + libellé (le libellé reste lu par les lecteurs d'écran quand le rail est replié). |
| `function ThemeToggle()` | Bascule clair / sombre (le choix est mémorisé ; sans choix, l'application suit le réglage de l'appareil). |

### `appointments/appointment-dialogs.tsx`

| Déclaration | Rôle |
|---|---|
| `export interface PlanDefaults` | Valeurs imposées à la planification (depuis une entreprise ou une offre) ; l'entreprise imposée n'est pas modifiable. |
| `export type AppointmentDialogState` | Fenêtre ouverte sur un rendez-vous, ou pour en planifier un. |
| `export function AppointmentDialogs({ dialog, rights, onOpen, onClose, onDone }:` | Toutes les fenêtres du cycle d'un rendez-vous (fiche, planifier, modifier, reporter, tenir, annuler), rendues UNE fois par l'écran hôte. |
| `function ConflictNotice({ appointment, onClose }: { appointment: Appointment; onClose: () => void })` | Avertissement de conflit d'horaire : le rendez-vous est enregistré, mais l'organisateur en a un autre sur le même créneau. |
| `function DetailDialog({ appointment: a, rights, onOpen, onClose }: { appointment: Appointment; rights: AgendaRights; onOpen: (d: AppointmentDialogStat` | Fiche d'un rendez-vous : tous ses éléments, et les actions possibles selon son état et les droits. |
| `function AppointmentFormDialog({ appointment, defaults, rights, onClose, onDone }:` | Planification (entreprise imposée ou choisie dans la portée) et modification d'un rendez-vous à venir. |
| `function PostponeDialog({ appointment, onClose, onDone }: { appointment: Appointment; onClose: () => void; onDone: (saved?: Appointment) => Promise<vo` | Report : nouvelle date et heure (dans le futur) et motif obligatoire. |
| `function ClosingDialog({ appointment, closing, onClose, onDone }: { appointment: Appointment; closing: 'hold' \| 'cancel'; onClose: () => void; onDone` | Marquer tenu (compte rendu obligatoire) ou annuler (motif obligatoire) un rendez-vous à venir. |

### `appointments/appointments-panel.tsx`

| Déclaration | Rôle |
|---|---|
| `const SPAN_DAYS = 60;` | Fenêtre de lecture : le serveur borne une recherche à 63 jours ; on lit donc deux fenêtres de 60 jours, avant et après aujourd'hui. |
| `export function AppointmentsPanel({ company }: { company: { id: string; name: string } })` | Rendez-vous d'une entreprise, dans sa fiche (vue 360°) : lecture seule, les 60 derniers et les 60 prochains jours. |

### `approvals/approval-dialogs.tsx`

| Déclaration | Rôle |
|---|---|
| `export type ApprovalDialogState` | Fenêtre ouverte sur un agrément, ou pour en enregistrer un. |
| `export function ApprovalDialogs({ dialog, onClose, onDone }: { dialog: ApprovalDialogState \| null; onClose: () => void; onDone: () => Promise<void> }` | Toutes les fenêtres du cycle d'un agrément, rendues UNE fois par le panneau hôte, hors du tableau. |
| `function DocumentDialog({ approval, onClose }: { approval: Approval; onClose: () => void })` | Le document signé de l'agrément : consultation (liste, téléchargement) et ajout si l'envoi initial a échoué. |
| `function RegisterApprovalDialog({ company, onClose, onDone }: { company: { id: string; name: string }; onClose: () => void; onDone: () => Promise<void` | Enregistrement d'un agrément : l'opportunité (accord de principe obtenu), le montant et/ou les places, la devise, les dates et le document signé. |
| `function CloseApprovalDialog({ approval, action, onClose, onDone }: { approval: Approval; action: ApprovalAction; onClose: () => void; onDone: () => P` | Honorer (confirmation), déclarer expiré ou annuler (motif obligatoire) un agrément reçu. |

### `approvals/approvals-panel.tsx`

| Déclaration | Rôle |
|---|---|
| `export function ApprovalsPanel({ company, archived, onChanged }: { company: { id: string; name: string }; archived: boolean; onChanged: () => Promise<` | Agréments d'une entreprise, dans sa fiche : liste, enregistrement (opportunité à l'accord de principe, document signé), document, honorer, déclarer expiré, annuler. |

### `auth/auth-layout.tsx`

| Déclaration | Rôle |
|---|---|
| `const BARS = [35, 52, 44, 68, 60, 82, 100];` | Barres décoratives de la carte d'accueil (hauteurs en %), reprises du prototype de design. |
| `export function AuthLayout({ title, documentTitle, description, step, children, footer }:` | Gabarit des écrans d'accès (EXD-06) : carte sombre d'accueil à gauche (masquée sur mobile), formulaire à droite avec logo, indicateur d'étape, titre et description. |

### `auth/auth-notice.tsx`

| Déclaration | Rôle |
|---|---|
| `export function AuthNotice({ tone, role, title, children }: { tone: Exclude<Tone, 'neutral'>; role: 'alert' \| 'status'; title?: string; children?: Re` | Encadré de message des écrans d'accès (confirmation, avertissement, erreur). |

### `auth/new-password-fields.tsx`

| Déclaration | Rôle |
|---|---|
| `export function NewPasswordFields({ password, confirmation, onPassword, onConfirmation }:` | Champs « nouveau mot de passe » + confirmation, avec les règles visibles en direct (chacune annoncée « respectée » ou « à respecter » aux lecteurs d'écran) et l'alerte de non-concordance. |

### `auth/otp-input.tsx`

| Déclaration | Rôle |
|---|---|
| `export function OtpInput({ label, value, onChange, disabled = false, autoFocus = false }:` | Saisie du code à 6 chiffres en six cases (EXD-06, DDR-0009). |

### `auth/password-field.tsx`

| Déclaration | Rôle |
|---|---|
| `export function PasswordField({ label, value, onChange, autoComplete, autoFocus, invalid, required = true }:` | Champ mot de passe avec bouton « œil » (EXD-12). |

### `auth/secret-codes-panel.tsx`

| Déclaration | Rôle |
|---|---|
| `export function SecretCodesPanel({ codes, saved, onSavedChange }: { codes: string[]; saved: boolean; onSavedChange: (saved: boolean) => void })` | Codes de secours affichés UNE SEULE FOIS (EXD-13), avec copie, fichier texte et impression (« Enregistrer au format PDF »). |
| `function print()` | Imprime uniquement le bloc des codes (feuille de style d'impression) ; « Enregistrer au format PDF » produit le PDF. |

### `companies/company-dialog.tsx`

| Déclaration | Rôle |
|---|---|
| `function Field({ name, label, error, children }: { name: FieldName; label: string; error?: string; children: ReactNode })` | Champ de formulaire : libellé relié, puis le contrôle, puis le message d'erreur écrit sous le champ. |
| `export function CompanyDialog({ company, onClose, onDone }: { company?: Company; onClose: () => void; onDone: () => Promise<void> })` | Fenêtre de création OU de modification d'une entreprise (`company` fourni = modification, préremplie) : coordonnées, puis « mise en relation » (facilitateur existant ou nouveau, méthode de contact, commission). |
| `const field = (key: FieldName) => ({ id: `company-${key}`, 'aria-invalid': errors[key] ? (true as const) : undefined, 'aria-describedby': errors[key] ` | Attributs d'un champ : état non conforme annoncé et relié à son message. |
| `async function submit(event: FormEvent)` | Enregistre l'entreprise saisie ; en cas d'échec le message de l'API s'affiche dans la fenêtre. |

### `companies/company-lifecycle-dialogs.tsx`

| Déclaration | Rôle |
|---|---|
| `export function CompanyStatusDialog({ company, action, onClose, onDone }: { company: Company; action: StatusAction; onClose: () => void; onDone: () =>` | Changement de statut d'une entreprise (CU-C-05) : confirmation ; le serveur refuse « Qualifiée » sans contact. |
| `export function CompanyOwnerDialog({ company, onClose, onDone }: { company: Company; onClose: () => void; onDone: () => Promise<void> })` | Changement de responsable (D17) : le choix se limite aux personnes de la portée de l'utilisateur (liste du serveur) et une confirmation explicite précède l'enregistrement, car la portée des droits sur l'entreprise, ses opportunités, offres et rendez-vous suit son responsable. |

### `companies/facilitation-panel.tsx`

| Déclaration | Rôle |
|---|---|
| `export function FacilitationPanel({ facilitation }: { facilitation: Facilitation \| null \| undefined })` | Bloc « Mise en relation » de la fiche entreprise. |

### `confirm-dialog.tsx`

| Déclaration | Rôle |
|---|---|
| `export function ConfirmDialog({ title, confirmLabel, cancelLabel = 'Annuler', busy = false, onConfirm, onCancel, children }:` | Fenêtre de confirmation d'une action irréversible (EXD-13). |

### `contacts/contact-dialog.tsx`

| Déclaration | Rôle |
|---|---|
| `export function ContactDialog({ contact, company, onClose, onDone }:` | Fenêtre de création OU de modification d'un contact (`contact` fourni = modification, préremplie). |

### `contacts/contacts-panel.tsx`

| Déclaration | Rôle |
|---|---|
| `export function ContactsPanel({ company }: { company: { id: string; name: string } })` | Contacts d'une entreprise, dans sa fiche : liste, création, modification, suppression (avec confirmation). |

### `data/badge.tsx`

| Déclaration | Rôle |
|---|---|
| `export type Tone = 'ok' \| 'warn' \| 'bad' \| 'info' \| 'neutral';` | Teinte d'un badge : le sens est porté par le TEXTE et le point, jamais par la couleur seule (WCAG 1.4.1). |
| `export function Badge({ tone = 'neutral', children }: { tone?: Tone; children: ReactNode })` | Badge d'état (statut, rôle, indicateur) : pastille arrondie, point de couleur et libellé. |

### `data/card.tsx`

| Déclaration | Rôle |
|---|---|
| `export function Card({ children, className = '' }: { children: ReactNode; className?: string })` | Surface de contenu (tableau, formulaire, bloc) : fond blanc, bord fin, coins arrondis (jetons du design). |

### `data/data-table.tsx`

| Déclaration | Rôle |
|---|---|
| `export interface Column<T>` | Colonne d'un tableau : en-tête, rendu de la cellule, alignement. |
| `export interface TableSort` | Tri courant d'un tableau et son gestionnaire (le tri est fait par le serveur, sur toutes les pages). |
| `export interface TableSelection` | Sélection persistante d'un tableau : l'ensemble des identifiants et son gestionnaire. |
| `const INTERACTIVE = 'button, a, input, label, select, textarea, summary, [role="button"], [role="menuitem"]';` | Éléments sur lesquels un clic ne doit PAS basculer la sélection de la ligne. |
| `export function DataTable<T>(` | Tableau de données du design. |

### `data/entity-cell.tsx`

| Déclaration | Rôle |
|---|---|
| `export function initialsOf(name: string): string` | Initiales (deux lettres au plus) d'un nom, pour l'étiquette graphique d'une ligne. |
| `export function EntityCell({ name, subtitle, round = false }: { name: string; subtitle?: string \| null; round?: boolean })` | Cellule « entité » des tableaux : étiquette à initiales (carrée pour une organisation, ronde pour une personne), nom en gras et ligne secondaire. |

### `data/page-header.tsx`

| Déclaration | Rôle |
|---|---|
| `export function PageHeader({ eyebrow, title, description, actions }: { eyebrow?: string; title: string; description?: string; actions?: ReactNode })` | En-tête de page du design : fil d'Ariane (retour à la Vue d'ensemble), domaine, titre (qui renseigne aussi le titre du document), description et actions principales à droite. |

### `data/pagination.tsx`

| Déclaration | Rôle |
|---|---|
| `export function pageRange(page: number, pageSize: number, total: number): { from: number; to: number }` | Bornes affichées « de – à » pour une page (1-indexée) ; `0–0` quand il n'y a aucun résultat. |
| `export function Pagination({ page, pageSize, total, onPage }: { page: number; pageSize: number; total: number; onPage: (page: number) => void })` | Pied de tableau : « 1–20 sur 48 » et boutons Précédent / Suivant. |

### `data/row-actions.tsx`

| Déclaration | Rôle |
|---|---|
| `const MENU_WIDTH = 224;` | Largeur du menu (px) : sert à le placer à gauche du bouton sans recouvrir les boutons des lignes voisines. |
| `export function RowActions({ label, children }: { label: string; children: ReactNode })` | Menu d'actions d'une ligne (bouton « ⋯ ») : motif de divulgation `details`/`summary`, qui se manipule au clavier (Entrée ou Espace ouvre, Échap ferme et rend le focus au bouton). |
| `export function RowAction({ children, onClick, danger = false }: { children: ReactNode; onClick: () => void; danger?: boolean })` | Action d'un menu de ligne : bouton plein largeur, aligné à gauche, discret. |

### `data/selection-bar.tsx`

| Déclaration | Rôle |
|---|---|
| `export function SelectionBar({ count, onClear, children }: { count: number; onClear: () => void; children?: ReactNode })` | Barre de sélection (EXD-02) : apparaît tant que des lignes ou des cartes sont sélectionnées, annonce le nombre aux lecteurs d'écran et propose « Tout désélectionner ». |

### `data/toolbar.tsx`

| Déclaration | Rôle |
|---|---|
| `export function Toolbar({ children }: { children: ReactNode })` | Barre d'outils d'un tableau : filtres rapides à gauche, recherche et réglages à droite. |
| `export interface FilterOption` | Option d'un filtre rapide (`count` facultatif : seulement s'il est connu de l'API). |
| `export function QuickFilters({ label, value, options, onChange }: { label: string; value: string; options: FilterOption[]; onChange: (value: string) =` | Filtres rapides sous forme de boutons à bascule (un seul actif). |
| `export function SearchField({ label, placeholder = 'Rechercher', delay = 300, onSearch }: { label: string; placeholder?: string; delay?: number; onSea` | Champ de recherche à saisie différée : n'appelle `onSearch` qu'après une courte pause (pas à chaque touche) ni au premier rendu. |

### `documents/documents-panel.tsx`

| Déclaration | Rôle |
|---|---|
| `type Dialog` | Ce que la fenêtre ouverte est en train de faire. |
| `function scanBadge(scan: string)` | Teinte et texte de l'état d'analyse antivirus : tant que le service n'existe pas, le fichier est « non analysé ». |
| `async function downloadVersion(documentId: string, fileName: string, versionNumber?: number): Promise<void>` | Télécharge une version : le fichier est demandé avec le jeton (jamais d'adresse directe), puis proposé à l'enregistrement. |
| `export function DocumentsPanel({ ownerType, ownerId }: { ownerType: string; ownerId: string })` | Panneau « Documents » d'un objet (une entreprise aujourd'hui, offres et opportunités ensuite) : liste, envoi, nouvelle version, historique des versions, téléchargement et archivage. |
| `async function download(document: DocumentView, versionNumber?: number)` | Télécharge et signale une erreur sans casser la page. |
| `function UploadDialog({ rules, title, ownerType, ownerId, existing, onClose, onDone }:` | Fenêtre d'envoi d'un fichier : nouveau document (titre, catégorie) ou nouvelle version d'un document existant. |
| `async function submit(event: FormEvent)` | Envoie le fichier en corps binaire ; le message du serveur s'affiche tel quel en cas de refus. |
| `function HistoryDialog({ document, canDownload, onClose, onError }: { document: DocumentView; canDownload: boolean; onClose: () => void; onError: (mes` | Historique des versions d'un document : chaque version reste téléchargeable, avec son empreinte SHA-256. |

### `followups/followup-dialogs.tsx`

| Déclaration | Rôle |
|---|---|
| `export type FollowupDialogState` | Fenêtre ouverte sur une relance, ou pour en planifier une (éventuellement sur une offre imposée). |
| `export function FollowupDialogs({ dialog, onClose, onDone }: { dialog: FollowupDialogState \| null; onClose: () => void; onDone: () => Promise<void> }` | Toutes les fenêtres du cycle d'une relance (planifier, modifier, terminer, annuler), rendues UNE fois par l'écran hôte, hors des lignes d'un tableau (un clic dans une fenêtre ne doit pas basculer la sélection d'une ligne). |
| `function FollowupFormDialog({ followup, offer, onClose, onDone }:` | Planification (offre imposée, ou choisie parmi les offres en cours de sa portée) et modification d'une relance à faire. |
| `function ClosingDialog({ followup, closing, onClose, onDone }: { followup: Followup; closing: 'complete' \| 'cancel'; onClose: () => void; onDone: () ` | Terminer (résultat obligatoire) ou annuler (motif obligatoire) une relance à faire. |

### `form-field.tsx`

| Déclaration | Rôle |
|---|---|
| `export function fieldProps(prefix: string, name: string, error?: string)` | Attributs d'un contrôle de formulaire : identifiant, état non conforme annoncé et relié à son message d'erreur. |
| `export function FormField({ prefix, name, label, error, children }: { prefix: string; name: string; label: string; error?: string; children: ReactNode` | Champ de formulaire : libellé relié, contrôle, puis message d'erreur écrit sous le champ (avec pictogramme : la couleur ne porte jamais seule l'état, EXD-16). |

### `gate.tsx`

| Déclaration | Rôle |
|---|---|
| `export function Gate({ allow, children }: { allow: readonly Exclude<AuthStatus, 'loading'>[]; children: ReactNode })` | Laisse passer uniquement les états attendus ; sinon redirige vers l'écran qui correspond à l'état réel. |

### `global-search.tsx`

| Déclaration | Rôle |
|---|---|
| `const TYPING_DELAY = 250;` | Délai (ms) entre la dernière frappe et l'appel au serveur. |
| `export function GlobalSearch()` | Recherche globale du hub (EXD-05, CAD-H1-4) : un champ, des résultats groupés par type. |

### `icon.tsx`

| Déclaration | Rôle |
|---|---|
| `const PATHS` | Tracés des pictogrammes (jeu unique, libre de droits, repris du prototype de design v0.4.1). |
| `export type IconName = keyof typeof PATHS;` | Nom d'un pictogramme du jeu. |
| `export function Icon({ name, className = 'size-5', ...rest }: { name: IconName; className?: string } & Omit<SVGProps<SVGSVGElement>, 'name'>)` | Pictogramme décoratif (`aria-hidden`) : le libellé accessible est toujours porté par le bouton ou le lien qui l'entoure. |

### `modal.tsx`

| Déclaration | Rôle |
|---|---|
| `export function Modal({ title, onClose, children, size = 'default' }: { title: string; onClose: () => void; children: ReactNode; size?: 'default' \| '` | Fenêtre modale accessible : Échap ferme, le focus entre dans la fenêtre, le fond est rendu inerte (`inert`), Tab reste dans la fenêtre et le focus revient à l'élément d'origine à la fermeture. |

### `offers/offer-dialog.tsx`

| Déclaration | Rôle |
|---|---|
| `export function OfferDialog({ offer, company, onClose, onDone }:` | Fenêtre de création OU de modification d'une offre (`offer` fourni = modification d'un brouillon, préremplie). |

### `offers/offer-dialogs.tsx`

| Déclaration | Rôle |
|---|---|
| `export type OfferDialogState` | Fenêtre ouverte sur une offre ou pour en créer une. |
| `export function OfferDialogs({ dialog, onClose, onDone, onRefresh }:` | Toutes les fenêtres du cycle d'une offre (créer, modifier, déposer, accepter, refuser, retirer), rendues UNE fois par l'écran hôte, hors des lignes d'un tableau (un clic dans une fenêtre ne doit pas basculer la sélection d'une ligne). |
| `function OfferDocumentsDialog({ offer, onClose }: { offer: Offer; onClose: () => void })` | Documents d'une offre (par exemple le fichier envoyé au client) : le panneau des documents, dans une fenêtre. |

### `offers/offer-row-actions.tsx`

| Déclaration | Rôle |
|---|---|
| `export function useOfferRights(): OfferRights & { create: boolean }` | Droits de l'utilisateur sur les offres, pour `availableActions` (le serveur re-contrôle chaque requête). |
| `export type OfferDialogAction = Exclude<OfferAction, 'followups' \| 'appointment'>;` | Actions qui ouvrent une fenêtre (toutes sauf « Relances » et « Planifier un rendez-vous », qui ouvrent une autre page). |

### `offers/offers-panel.tsx`

| Déclaration | Rôle |
|---|---|
| `export function OffersPanel({ company, archived }: { company: { id: string; name: string }; archived: boolean })` | Offres d'une entreprise, dans sa fiche : liste, création, modification d'un brouillon, dépôt, réponse du client, retrait. |

### `offers/receipt-dialog.tsx`

| Déclaration | Rôle |
|---|---|
| `export function ReceiptDialog({ offer, onClose, onChanged }: { offer: Offer; onClose: () => void; onChanged: () => Promise<void> })` | Décharge signée d'une offre : consulter (avec son fichier), enregistrer (offre déposée) ou annuler (motif obligatoire). |

### `opportunities/opportunities-panel.tsx`

| Déclaration | Rôle |
|---|---|
| `export function OpportunitiesPanel({ company }: { company: { id: string; name: string } })` | Opportunités d'une entreprise, dans sa fiche (vue 360°) : lecture seule. |

### `opportunities/opportunity-dialogs.tsx`

| Déclaration | Rôle |
|---|---|
| `export type OpportunityDialogState` | Fenêtre ouverte sur une opportunité, ou pour en créer une (éventuellement pour une entreprise imposée). |
| `export function OpportunityDialogs({ dialog, rights, onOpen, onClose, onDone }:` | Toutes les fenêtres du cycle d'une opportunité (fiche, créer, modifier, avancer, dérogation, clôtures), rendues UNE fois par l'écran hôte, hors des cartes (un clic dans une fenêtre ne doit pas déclencher une carte). |
| `function DetailDialog({ opportunity: o, rights, onOpen, onClose }: { opportunity: Opportunity; rights: OpportunityRights; onOpen: (d: OpportunityDialo` | Fiche : tous les éléments de l'opportunité et les actions possibles selon son état et les droits. |
| `function OpportunityFormDialog({ opportunity, company, onClose, onDone }:` | Création (entreprise imposée, ou choisie dans la portée) et modification d'une opportunité ouverte. |
| `function AdvanceDialog({ opportunity, rights, onOpen, onClose, onDone }:` | Confirmation d'un passage d'étape ; un refus de la règle du rendez-vous décideur renvoie vers la dérogation. |
| `function WaiverDialog({ opportunity, onClose, onDone }: { opportunity: Opportunity; onClose: () => void; onDone: () => Promise<void> })` | Dérogation à la règle du rendez-vous décideur : justification obligatoire. |
| `function CloseLostDialog({ opportunity, onClose, onDone }: { opportunity: Opportunity; onClose: () => void; onDone: () => Promise<void> })` | Clôture « perdue » : motif de la liste fermée, précision obligatoire pour « autre ». |
| `function CloseWonDialog({ opportunity, onClose, onDone }: { opportunity: Opportunity; onClose: () => void; onDone: () => Promise<void> })` | Clôture « gagnée » (Responsable commercial, après l'accord de principe) : confirmation. |

### `page-heading.tsx`

| Déclaration | Rôle |
|---|---|
| `export function PageHeading({ children, title, className }: { children: string; title?: string; className?: string })` | Titre de page (`h1`) qui renseigne aussi le titre du document : le lecteur d'écran l'annonce à chaque changement de page (WCAG 2.4.2) et l'onglet du navigateur dit où l'on se trouve. |

### `step-up-dialog.tsx`

| Déclaration | Rôle |
|---|---|
| `export function StepUpDialog({ onDone }: { onDone: (ok: boolean) => void })` | Demande un code frais du second facteur avant une action sensible (modification de rôles, désactivation, etc.). |
| `async function submit(event: FormEvent)` | Vérifie le code ; en cas de succès le nouveau jeton remplace l'ancien et l'action sensible est rejouée. |

## Interface web — bibliothèque — 205 déclarations commentées

### `api.ts`

| Déclaration | Rôle |
|---|---|
| `export class ApiError extends Error` | Erreur renvoyée par l'API : statut HTTP, code stable (`FORBIDDEN`, `MFA_REQUIRED`…) et message lisible. |
| `export function setAccessToken(token: string \| null): void` | Installe (ou efface) le jeton d'accès, gardé uniquement en mémoire. |
| `export function hasAccessToken(): boolean` | Vrai si un jeton d'accès est actuellement en mémoire. |
| `export function setStepUpHandler(handler: (() => Promise<boolean>) \| null): void` | Enregistre la fonction qui demande un code frais à l'utilisateur quand l'API exige un MFA récent. |
| `export function setSessionLostHandler(handler: (() => void) \| null): void` | Enregistre la fonction appelée quand la session est définitivement perdue (rafraîchissement refusé). |
| `export function resetApiClient(): void` | Remise à zéro (tests, déconnexion). |
| `export interface ProblemBody` | Corps d'erreur `application/problem+json` de l'API (RFC 7807). |
| `export function describeProblem(status: number, body: ProblemBody \| null): { code: string; message: string }` | Message lisible : le `detail` de l'API s'il est textuel ou une liste de textes (validation), sinon un message générique. |
| `async function toError(res: Response): Promise<ApiError>` | Lit la réponse d'erreur et la transforme en `ApiError`. |
| `export function refreshAccessToken(): Promise<boolean>` | Échange le cookie de rafraîchissement contre un nouveau jeton d'accès. |
| `function requestStepUp(): Promise<boolean>` | Demande un code frais à l'utilisateur ; plusieurs actions simultanées ne posent qu'une seule question. |
| `export interface RequestOptions` | Options d'un appel : méthode, corps JSON, et `auth: false` pour les routes publiques. |
| `async function send(path: string, options: RequestOptions): Promise<Response>` | Envoie une requête vers `/api/v1` avec le jeton en en-tête (jamais dans l'URL) et sans mise en cache. |
| `function isTokenRejected(res: Response): boolean` | Vrai si l'API accuse le jeton (`WWW-Authenticate: invalid_token`) : seul cas où un rafraîchissement automatique est justifié. |
| `export async function api<T = unknown>(path: string, options: RequestOptions = {}): Promise<T>` | Appel d'API de toute l'interface : rafraîchit le jeton une fois si le jeton est refusé, demande un code MFA et rejoue une fois si l'action est sensible, sinon remonte l'erreur lisible. |

### `appointments.ts`

| Déclaration | Rôle |
|---|---|
| `export const APPOINTMENT_TYPES = [` | Types de rendez-vous (codes de l'API → libellés). |
| `export const DEFAULT_APPOINTMENT_MINUTES = 60;` | Durée proposée, minimale et maximale, en minutes (valeurs proposées, à confirmer ; les mêmes que le serveur). |
| `export interface AgendaRights` | Droits de l'utilisateur sur l'agenda, tels que le profil les annonce (le serveur re-contrôle tout). |
| `export interface AppointmentForm` | Ce que l'utilisateur saisit pour planifier ou modifier un rendez-vous (date et heure en heure locale). |
| `export const localDay = (iso: string \| Date): string` | Jour local « AAAA-MM-JJ » d'un instant. |
| `export const localTime = (iso: string \| Date): string` | Heure locale « hh:mm » d'un instant. |
| `export function toInstant(date: string, time: string): string \| null` | Instant (ISO) d'un jour et d'une heure LOCAUX saisis ; `null` si l'un ou l'autre est illisible. |
| `export const startOfLocalDay = (day: string): string => new Date(`${day}T00:00:00`).toISOString();` | Premier instant (ISO) d'un jour local. |
| `export function validateAppointmentFields(form: AppointmentForm, context: { now: Date; editing: boolean }): AppointmentErrors` | Contrôles de saisie rapides, champ par champ (le serveur refait tous les contrôles) : type connu, entreprise choisie, date et heure réelles et dans le futur (à la planification seulement), durée entière de 15 minutes à 8 heures, lieu de 200 caractères et note de 500 au plus. |
| `export function buildAppointmentBody(form: AppointmentForm, options: { version?: number } = {}): Record<string, unknown>` | Corps de la planification (type, entreprise, heure ; contact, offre, lieu et note seulement s'ils sont renseignés) ou de la modification (la version lue, jamais le type, l'entreprise ni l'heure : un changement d'heure est un report). |
| `export function appointmentActions(appointment: Pick<Appointment, 'status' \| 'type' \| 'startsAt'>, rights: AgendaRights, now: Date = new Date()): Ap` | Actions proposées : seulement sur un rendez-vous À VENIR, selon les droits de l'utilisateur pour ce type (une visite relève du droit « visite », son annulation de la modification), et « tenu » seulement une fois l'heure de début venue (le serveur re-contrôle tout). |
| `export const canPlan = (type: string, rights: AgendaRights): boolean => (type === 'VISIT' ? rights.visitCreate : rights.create);` | Vrai si l'utilisateur peut planifier ce type de rendez-vous. |
| `export const plannableTypes = (rights: AgendaRights) => APPOINTMENT_TYPES.filter((t) => canPlan(t.value, rights));` | Types que l'utilisateur peut planifier. |
| `export const timeRange = (a: Pick<Appointment, 'startsAt' \| 'endsAt'>): string => `${localTime(a.startsAt)} – ${localTime(a.endsAt)}`;` | Heure de début et durée d'un rendez-vous, lisibles (« 09:00 – 10:00 »). |
| `const weekdayIndex = (day: string): number => (new Date(`${day}T00:00:00Z`).getUTCDay() + 6) % 7;` | Jour de la semaine (0 = lundi … 6 = dimanche) d'un jour « AAAA-MM-JJ ». |
| `function shiftMonth(day: string, months: number): string` | Le premier du mois qui suit ou précède `day` de `months` mois. |
| `export const mondayOf = (day: string): string => addDays(day, -weekdayIndex(day));` | Lundi de la semaine qui contient `day`. |
| `export function agendaWindow(mode: AgendaMode, anchor: string): AgendaWindow` | Fenêtre d'une vue autour d'un jour : un jour, la semaine du lundi au dimanche, ou la grille du mois (4 à 6 semaines). |
| `export function shiftAnchor(mode: AgendaMode, anchor: string, direction: -1 \| 1): string` | Jour d'ancrage de la vue précédente (`-1`) ou suivante (`1`) : un jour, une semaine, ou un mois (même jour, borné au mois). |
| `export function agendaTitle(mode: AgendaMode, anchor: string): string` | Titre de la vue : « lundi 9 novembre 2026 », « Semaine du 9 au 15 novembre 2026 », « novembre 2026 ». |
| `export const dayHeading = (day: string): string => longDay(day, { weekday: 'long', day: 'numeric', month: 'long' });` | Libellé d'un jour pour un titre de section (« lundi 9 novembre »). |
| `export function groupByDay(items: readonly Appointment[]): Map<string, Appointment[]>` | Rendez-vous regroupés par jour LOCAL, chaque jour trié par heure (l'ordre du serveur est conservé). |
| `export function agendaParams(window: Pick<AgendaWindow, 'from' \| 'to'>, type: string): URLSearchParams` | Paramètres de la requête d'agenda : la fenêtre, le type éventuel et la taille de page maximale. |

### `approvals.ts`

| Déclaration | Rôle |
|---|---|
| `const APPROVABLE_STAGES = ['AGREEMENT_IN_PRINCIPLE', 'ACCREDITATION'];` | Étapes à partir desquelles un agrément peut être enregistré (l'accord de principe a été obtenu). |
| `export const eligibleOpportunities = (items: readonly Opportunity[]): Opportunity[]` | Opportunités d'une entreprise pour lesquelles on peut enregistrer un agrément : accord de principe obtenu, pas perdue (le serveur reste juge). |
| `export interface ApprovalForm` | Ce que l'utilisateur saisit pour enregistrer un agrément ; le document signé s'ajoute à part. |
| `export function validateApprovalFields(form: ApprovalForm, context: { today: string }): ApprovalErrors` | Contrôles de saisie rapides, champ par champ (le serveur refait tous les contrôles) : opportunité choisie, montant et/ou places (au moins l'un des deux, positifs), devise de trois lettres, date de réception réelle et pas dans le futur, fin de validité réelle et pas avant la réception. |
| `export function buildApprovalBody(form: ApprovalForm): Record<string, unknown>` | Corps de l'enregistrement d'un agrément : seuls les champs renseignés partent. |
| `export function coverageText(a: Pick<Approval, 'amount' \| 'currency' \| 'places'>): string` | Ce que couvre l'agrément : « 12 500 000 FCFA · 8 places » (l'un ou l'autre, ou les deux). |
| `export function approvalActions(approval: Pick<Approval, 'status'>, rights: ApprovalRights): ApprovalAction[]` | Les actions proposées sur un agrément : seul un agrément « reçu » se clôt ; honorer et annuler ont chacun leur droit. |
| `export function validateReason(text: string): string \| null` | Motif obligatoire pour déclarer expiré ou annuler : trois caractères au moins, 500 au plus. |

### `auth-context.tsx`

| Déclaration | Rôle |
|---|---|
| `export type AuthStatus = 'loading' \| 'anonymous' \| 'mfa-enroll' \| 'mfa-verify' \| 'ready';` | loading : on vérifie s'il existe une session (cookie de rafraîchissement) anonymous : personne n'est connecté mfa-enroll : mot de passe valide, second facteur jamais configuré (obligatoire) mfa-verify : mot de passe valide, code du second facteur à saisir ready : mot de passe + second facteur vérifiés |
| `export interface EnrollmentStart` | Début de configuration du MFA : secret et URI du QR code. |
| `export interface EnrollmentConfirmed` | Configuration confirmée : codes de secours à afficher une seule fois. |
| `interface AuthContextValue` | Ce que l'interface peut faire avec la session : état, profil, connexion, MFA, déconnexion. |
| `confirmEnrollment(code: string): Promise<EnrollmentConfirmed>;` | Le jeton vérifié par MFA est installé, mais l'état ne change qu'à l'appel de `refreshState` (le temps d'afficher les codes de secours). |
| `export function useAuth(): AuthContextValue` | Accès à l'état d'authentification depuis n'importe quel composant. |
| `interface TokenResponse` | Réponse de l'API contenant un nouveau jeton d'accès. |
| `export function AuthProvider({ children }: { children: ReactNode })` | Fournisseur d'authentification : retrouve la session au chargement (cookie de rafraîchissement), pilote les états `anonymous`, `mfa-enroll`, `mfa-verify` et `ready`, et affiche la fenêtre de confirmation MFA quand il le faut. |

### `auth-errors.ts`

| Déclaration | Rôle |
|---|---|
| `export const RATE_LIMIT_WAIT_SECONDS = 60;` | Durée (secondes) d'attente affichée après un refus pour trop de tentatives (la limite du serveur est d'une minute). |
| `export function isRateLimited(error: unknown): boolean` | Vrai si le serveur refuse pour trop de tentatives (limitation de débit, HTTP 429). |
| `export function authErrorMessage(error: unknown, fallback: string): string` | Message à afficher pour un échec d'authentification : le message du serveur (identique pour un compte connu ou inconnu, jamais enrichi ici), un texte propre à la limitation de débit, ou un texte de repli pour une panne réseau. |
| `export function secondsLeft(until: number, now: number): number` | Secondes restantes avant `until` (en millisecondes depuis l'époque), jamais négatives. |

### `company-lifecycle.ts`

| Déclaration | Rôle |
|---|---|
| `const ORDER = ['TARGET', 'CONTACTED', 'QUALIFIED'] as const;` | Ordre des statuts pour distinguer avancer et revenir. |
| `export function statusActions(status: string): StatusAction[]` | Les changements de statut proposés depuis l'état actuel. |
| `export interface OwnerCandidate` | Une personne à qui confier une entreprise (liste fournie par le serveur, dans la portée de l'utilisateur). |
| `export const otherOwners = (candidates: readonly OwnerCandidate[], currentOwnerId: string \| null \| undefined): OwnerCandidate[]` | Les candidats, hors le responsable actuel (on ne confie pas une entreprise à qui l'a déjà). |

### `company-table.ts`

| Déclaration | Rôle |
|---|---|
| `export type CompanySortField = 'createdAt' \| 'name' \| 'country' \| 'sector' \| 'status';` | Champs sur lesquels l'API sait trier les entreprises. |
| `export interface CompanyFilters` | Filtres du tableau ; chaîne vide = pas de filtre. |
| `export function nextSort(current: CompanySort, field: CompanySortField): CompanySort` | Clic sur un en-tête : nouveau champ → croissant ; même champ → inverse ; troisième clic sur « Créée le » repart du tri par défaut. |
| `export function listParams(filters: CompanyFilters, sort: CompanySort, page: number, pageSize: number): URLSearchParams` | Paramètres de la liste pour l'API. |
| `export function overviewParams(filters: CompanyFilters): URLSearchParams` | Paramètres de la synthèse : mêmes filtres que la liste, SAUF le statut (les compteurs par statut doivent rester lisibles). |
| `export interface CompanyOverview` | Synthèse renvoyée par l'API. |
| `export function statusOptions(counts: Record<string, number> \| null): { value: string; label: string; count?: number }[]` | Boutons de filtre par statut : « Toutes » + chaque statut, avec son effectif quand la synthèse est connue. |
| `export const COMPANY_COLUMNS = [` | Colonnes affichables. |
| `export function parseStoredColumns(raw: string \| null): CompanyColumnId[]` | Relit les colonnes mémorisées : toute valeur douteuse retombe sur le défaut ; la colonne verrouillée est toujours présente. |
| `export function toggleColumn(visible: readonly CompanyColumnId[], id: CompanyColumnId): CompanyColumnId[]` | Active ou masque une colonne ; une colonne verrouillée ne se masque pas. |
| `export function openValueText(open: Company['openOpportunities']): string \| null` | Valeur des opportunités ouvertes d'une entreprise pour la colonne « Valeur » : « 3 · 3 000 000,50 FCFA ». |

### `contacts.ts`

| Déclaration | Rôle |
|---|---|
| `export const CONTACT_ROLES = [` | Fonction du contact dans l'entreprise (codes de l'API → libellés). |
| `export interface ContactForm` | Ce que l'utilisateur saisit dans la fenêtre d'un contact. |
| `export function validateContactFields(form: ContactForm): ContactErrors` | Contrôles de saisie rapides, champ par champ, dans l'ordre de la page (le serveur refait tous les contrôles). |
| `export function formFromContact(contact: Contact): ContactForm` | Formulaire prérempli avec le contact à modifier. |
| `export function buildContactBody(form: ContactForm, options: { version?: number; allowDuplicate?: boolean } = {}): Record<string, unknown>` | Corps de la création (l'entreprise est incluse) ou de la modification (la version lue, jamais l'entreprise : un contact ne change pas d'entreprise ici). |
| `export const isDuplicateConflict = (status: number, message: string): boolean => status === 409 && /existe déjà/i.test(message);` | Vrai si l'erreur de l'API est un doublon probable (conflit « existe déjà »), pas une modification concurrente. |

### `countries.ts`

| Déclaration | Rôle |
|---|---|
| `export const COUNTRY_SUGGESTIONS = [` | Suggestions de pays pour la fiche d'une entreprise (la saisie reste libre : un pays absent de la liste est accepté). |

### `device.ts`

| Déclaration | Rôle |
|---|---|
| `export function deviceLabel(userAgent: string): string` | Libellé court et lisible d'un User-Agent (« Chrome sur Windows »). |

### `export-sheet.ts`

| Déclaration | Rôle |
|---|---|
| `export async function openCompanySheet(companyId: string): Promise<void>` | Ouvre la fiche d'une entreprise dans une nouvelle fenêtre et lance l'impression (le navigateur propose « Enregistrer au format PDF »). |

### `facilitation.ts`

| Déclaration | Rôle |
|---|---|
| `export const CONTACT_METHODS = [` | Façons de prendre contact via le facilitateur (codes de l'API → libellés). |
| `export interface CompanyForm` | Ce que l'utilisateur saisit dans la fenêtre de création d'une entreprise. |
| `export const DEFAULT_CURRENCY = 'XAF';` | Devise par défaut : franc CFA d'Afrique centrale (le serveur applique la même). |
| `export type FieldName` | Champs de la fiche qui peuvent porter une erreur, dans l'ordre de la page. |
| `export function validateCompanyFields(form: CompanyForm): FieldErrors` | Contrôles de saisie rapides, champ par champ, pour mettre en évidence ce qui n'est pas conforme (le serveur refait tous les contrôles). |
| `export function validateCompanyForm(form: CompanyForm): string[]` | Les mêmes contrôles sous forme de liste de messages (récapitulatif annoncé avant l'envoi). |
| `export function buildCompanyBody(form: CompanyForm): Record<string, unknown>` | Corps de la requête de création : les champs vides sont omis ; sans facilitateur, aucune facilitation ni commission n'est envoyée. |
| `export function normalizeCurrency(raw: string): string` | Devise saisie → code : vide ou « FCFA » = XAF (franc CFA d'Afrique centrale), sinon les trois lettres en majuscules. |
| `export function formatCommission(commission: Commission): string` | « 7,50 % » ou « 1 500,00 XAF » (format français). |
| `export interface EditCapabilities` | Ce que l'utilisateur a le droit de modifier dans la mise en relation (le serveur re-contrôle chaque droit). |
| `export function editCapabilities(company: Company, canManageCommission: boolean): EditCapabilities` | Capacités d'édition d'une fiche existante, d'après ce que l'API a fourni (les clés absentes disent ce qu'on ne voit pas). |
| `export function formFromCompany(company: Company): CompanyForm` | Formulaire prérempli avec la fiche à modifier. |
| `export function buildCompanyUpdateBody(form: CompanyForm, company: Company, caps: EditCapabilities): Record<string, unknown>` | Corps de la modification : la version lue (verrou optimiste) et les champs de la fiche (une zone vidée est envoyée vide, pour être effacée). |

### `followups.ts`

| Déclaration | Rôle |
|---|---|
| `export const FOLLOWUP_CHANNELS = [` | Canaux d'une relance (codes de l'API → libellés). |
| `export const DEFAULT_FOLLOWUP_DELAY_DAYS = 7;` | Délai proposé par défaut pour la première relance (valeur proposée, à confirmer) et nombre maximum par offre. |
| `export function addDays(from: string, days: number): string` | Date « AAAA-MM-JJ » à `days` jours de `from` (UTC). |
| `export interface FollowupForm` | Ce que l'utilisateur saisit pour planifier ou modifier une relance. |
| `export function validateFollowupFields(form: FollowupForm, context: { today: string; keepDueOn?: string; needsOffer: boolean }): FollowupErrors` | Contrôles de saisie rapides, champ par champ (le serveur refait tous les contrôles) : offre choisie, échéance réelle et non passée (sauf si on garde l'échéance déjà passée d'une relance en retard), canal connu, note de 500 caractères au plus. |
| `export function buildFollowupBody(form: FollowupForm, options: { version?: number } = {}): Record<string, unknown>` | Corps de la planification (l'offre est incluse) ou de la modification (la version lue, jamais l'offre). |
| `export function validateClosingText(text: string, max: number): string \| null` | Texte obligatoire d'une clôture (résultat ou motif) : 3 caractères au moins, la limite donnée au plus. |
| `export function followupActions(status: string, rights: { complete: boolean; update: boolean }): FollowupAction[]` | Actions proposées : seulement sur une relance À FAIRE, selon les droits de l'utilisateur (le serveur re-contrôle tout). |
| `export const FOLLOWUP_FILTERS = [` | Filtres rapides de la liste : un seul actif, chacun traduit en paramètres de requête. |
| `export function followupListParams(filter: FollowupFilter, page: number, pageSize: number, offerId?: string): URLSearchParams` | Paramètres de la liste : page, taille, filtre rapide et offre éventuelle. |

### `format.ts`

| Déclaration | Rôle |
|---|---|
| `export function formatDate(iso: string \| null \| undefined): string` | Date seule au format français (ex. |
| `export function formatBytes(bytes: number): string` | Taille lisible en français (« 850 o », « 12,4 Ko », « 3,2 Mo ») ; « — » si la valeur n'est pas un nombre positif. |
| `export function extensionOf(fileName: string): string` | Extension en minuscules, sans le point (« Rapport.PDF » → « pdf ») ; vide s'il n'y en a pas. |
| `export function precheckFile(file: { name: string; size: number }, rules: { maxBytes: number; formats: readonly string[] }): string \| null` | Contrôle de confort AVANT l'envoi (le serveur reste seul juge : il reconnaît le format par le contenu) : renvoie le message à afficher si le fichier est vide, trop gros ou d'une extension non acceptée, sinon `null`. |

### `invitation.ts`

| Déclaration | Rôle |
|---|---|
| `export function parseInvitationFragment(hash: string): string \| null` | Le jeton d'invitation est dans le FRAGMENT de l'URL (`#token=…`) : le navigateur ne l'envoie ni au serveur ni dans l'en-tête Referer. |

### `login-events.ts`

| Déclaration | Rôle |
|---|---|
| `export function describeLoginEvent(event: LoginEvent): { label: string; detail: string; tone: Tone }` | Texte et teinte d'une ligne de l'historique : réussite, ou échec avec l'étape où il s'est produit (sans motif précis). |
| `export function formatDateTime(iso: string): string` | Date et heure en français (heure locale de l'utilisateur) ; « — » si la date est illisible. |

### `modules.ts`

| Déclaration | Rôle |
|---|---|
| `export interface AppModule` | Un module de l'application tel que le hub et la navigation le présentent. |
| `export function availableModules(profile: Profile \| null): AppModule[]` | Modules livrés et que le profil a le droit d'ouvrir. |
| `export function upcomingModules(): AppModule[]` | Modules pas encore livrés (présentés « À venir » sur le hub). |

### `offers.ts`

| Déclaration | Rôle |
|---|---|
| `export type OfferAction = 'edit' \| 'submit' \| 'receipt' \| 'followups' \| 'appointment' \| 'accept' \| 'refuse' \| 'withdraw' \| 'documents';` | Actions possibles sur une offre ; la disponibilité dépend de son état ET des droits (le serveur re-contrôle tout). |
| `export interface OfferRights` | Droits de l'utilisateur sur les offres, leurs décharges et leurs documents. |
| `export function availableActions(status: string, rights: OfferRights): OfferAction[]` | Actions proposées pour un état donné : un brouillon se modifie, se dépose ou se retire ; une offre déposée (ou dont la décharge est reçue) attend la réponse du client ou se retire, et sa décharge se consulte, s'enregistre ou s'annule ; acceptée, refusée et retirée sont définitives (on ne peut plus que consulter la décharge et les documents). |
| `export function formatAmount(amount: string, currency: string): string` | Montant lisible : « 4 500 000 FCFA » (XAF s'écrit FCFA), deux décimales seulement si elles existent. |
| `export interface OfferForm` | Ce que l'utilisateur saisit dans la fenêtre d'une offre. |
| `export const normalizeAmount = (raw: string): string => raw.replace(/\s/g, '').replace(',', '.');` | Montant saisi → texte décimal sans espaces, virgule remplacée par un point (« 4 500 000,5 » → « 4500000.5 »). |
| `export function isValidAmount(raw: string): boolean` | Montant valide : positif, douze chiffres au plus, deux décimales au plus. |
| `export function validateOfferFields(form: OfferForm): OfferErrors` | Contrôles de saisie rapides, champ par champ, dans l'ordre de la page (le serveur refait tous les contrôles). |
| `export function formFromOffer(offer: Offer): OfferForm` | Formulaire prérempli avec l'offre à modifier. |
| `export function buildOfferBody(form: OfferForm, options: { version?: number } = {}): Record<string, unknown>` | Corps de la création (l'entreprise est incluse, les champs vides omis) ou de la modification (la version lue, jamais l'entreprise ; une note vidée est envoyée vide pour être effacée). |

### `opportunities.ts`

| Déclaration | Rôle |
|---|---|
| `export const OPPORTUNITY_STAGES = [` | Étapes du pipeline dans l'ordre (codes de l'API → libellés ; noms du prototype, à confirmer). |
| `export interface OpportunityForm` | Ce que l'utilisateur saisit pour créer ou modifier une opportunité. |
| `export function validateOpportunityFields(form: OpportunityForm, context: { needsCompany: boolean }): OpportunityErrors` | Contrôles de saisie rapides, champ par champ (le serveur refait tous les contrôles) : entreprise choisie (à la création), intitulé de 200 caractères au plus, montant positif à deux décimales au plus, devise de trois lettres, source connue. |
| `export function buildOpportunityBody(form: OpportunityForm, options: { version?: number } = {}): Record<string, unknown>` | Corps de la création (l'entreprise est incluse) ou de la modification (la version lue, jamais l'entreprise). |
| `export function validateRequiredText(text: string, max: number): string \| null` | Motif ou justification obligatoire : trois caractères au moins, la limite donnée au plus. |
| `export function validateLoss(reason: string, note: string): { reason?: string; note?: string }` | Contrôle du formulaire de clôture « perdue » : motif choisi dans la liste, précision obligatoire pour « autre ». |
| `export interface OpportunityRights` | Droits de l'utilisateur sur les opportunités, tels que le profil les annonce (le serveur re-contrôle tout). |
| `export const AGREEMENT_STAGE = 'AGREEMENT_IN_PRINCIPLE';` | Étape à partir de laquelle une opportunité peut être gagnée, et étape qui exige le rendez-vous décideur. |
| `export function opportunityActions(o: Pick<Opportunity, 'status' \| 'stage' \| 'nextStage' \| 'waivedAt'>, rights: OpportunityRights): OpportunityActi` | Actions proposées pour une opportunité : la fiche toujours ; sur une opportunité OUVERTE seulement, selon les droits : modifier, passer à l'étape suivante, accorder la dérogation (avant l'accord de principe, une seule fois), clore perdue, clore gagnée (une fois l'accord de principe obtenu). |
| `export const advanceLabel = (nextStage: string \| null): string => `Déplacer vers « ${stageLabel(nextStage)} »`;` | Libellé de l'action « avancer » avec l'étape visée (alternative au glisser-déposer : « Déplacer vers… »). |
| `export function groupByStage(items: readonly Opportunity[]): { stage: string; label: string; items: Opportunity[] }[]` | Opportunités regroupées par étape, dans l'ordre du pipeline ; l'ordre reçu du serveur est conservé dans chaque colonne. |
| `export function totalAmount(items: readonly Opportunity[]): { amount: string; currency: string } \| null` | Total des montants (une seule devise à la fois) : « — » si les devises diffèrent. |
| `export const OPPORTUNITY_FILTERS = [` | Filtres rapides sur l'état : un seul actif, chacun traduit en paramètres de requête. |
| `export function opportunityListParams(filter: OpportunityFilter, search: string): URLSearchParams` | Paramètres de la liste : taille maximale (le pipeline s'affiche en entier), filtre rapide et recherche. |

### `otp.ts`

| Déclaration | Rôle |
|---|---|
| `export const OTP_LENGTH = 6;` | Longueur du code du second facteur (TOTP) : six chiffres. |
| `export function digitsOnly(raw: string): string` | Ne garde que les chiffres (le collage « 123 456 » ou « 123-456 » devient « 123456 »). |
| `export function applyInput(value: string, index: number, raw: string, length = OTP_LENGTH): string` | Valeur après saisie de `raw` dans la case `index`. |
| `export function backspaceOnEmpty(value: string, index: number): string` | Valeur après « Retour arrière » sur une case vide : le chiffre précédent est effacé. |
| `export function nextFocus(value: string, length = OTP_LENGTH): number` | Index de la case qui doit recevoir le focus après une saisie aboutissant à `value`. |

### `password.ts`

| Déclaration | Rôle |
|---|---|
| `export const PASSWORD_MIN_LENGTH = 12;` | Longueur minimale d'un mot de passe (la même règle que côté serveur, qui reste seul juge). |
| `export function passwordHints(password: string, email = ''): string[]` | Indications affichées pendant la saisie (longueur, identifiant e-mail contenu) ; la règle qui fait foi est celle du serveur. |
| `export interface PasswordRule` | Une règle de mot de passe affichée en direct, avec son état. |
| `export function passwordRules(password: string, email = ''): PasswordRule[]` | Règles du mot de passe avec leur état (respectée ou non), pour la liste affichée pendant la saisie. |
| `export const PASSWORD_AUTO_HIDE_MS = 30_000;` | Délai (ms) après lequel un mot de passe affiché est automatiquement remasqué. |

### `permissions.ts`

| Déclaration | Rôle |
|---|---|
| `export function can(profile: Profile \| null, permission: string): boolean` | Informatif seulement (menus, boutons) : le serveur re-contrôle chaque requête. |
| `export const roleLabel = (code: string): string => ROLE_LABELS[code] ?? code;` | Libellé français d'un rôle (le code brut si le rôle est inconnu). |

### `receipts.ts`

| Déclaration | Rôle |
|---|---|
| `export interface ReceiptForm` | Ce que l'utilisateur saisit pour enregistrer une décharge signée. |
| `export const todayIso = (now: Date = new Date()): string => now.toISOString().slice(0, 10);` | Date du jour au format « AAAA-MM-JJ » (UTC, comme le serveur : une date « de demain » serait refusée). |
| `export function isRealDate(text: string): boolean` | Vrai pour une date « AAAA-MM-JJ » qui existe (le 31 février non). |
| `export function validateReceiptFields(form: ReceiptForm, context: { today: string; submittedOn: string \| null }): ReceiptErrors` | Contrôles de saisie rapides, champ par champ (le serveur refait tous les contrôles) : date réelle, ni dans le futur ni avant le dépôt de l'offre ; nom obligatoire de 150 caractères au plus. |
| `export function buildReceiptBody(offerId: string, form: ReceiptForm): Record<string, unknown>` | Corps de l'enregistrement d'une décharge. |

### `roles.ts`

| Déclaration | Rôle |
|---|---|
| `export type ScopeCode = 'OWN' \| 'TEAM' \| 'ALL';` | Portée d'un droit, de la plus étroite à la plus large (même ordre que le serveur). |
| `export interface RoleGroup { id: string; label: string; description: string; roles: readonly string[] }` | Familles de rôles, dans l'ordre d'affichage. |
| `export function groupRoles(roles: readonly RoleView[]): GroupedRoles[]` | Range les rôles de l'API par famille ; un rôle inconnu va dans « Autres rôles », un rôle absent de l'API est ignoré. |
| `export const MODULE_ORDER = ['bd', 'training', 'docs', 'reporting', 'audit', 'iam'] as const;` | Modules du catalogue, dans l'ordre d'affichage, avec leur libellé. |
| `export function mergeGrants(roles: readonly RoleView[], selected: readonly string[]): Map<string, ScopeCode>` | Droits obtenus en cumulant les rôles choisis : pour une même permission, la portée la plus large l'emporte (règle du serveur, `widestScope`). |
| `export function effectiveRights(roles: readonly RoleView[], selected: readonly string[]): EffectiveRights` | Droits effectifs regroupés par module puis par ressource, pour l'aperçu en lecture seule. |
| `export function diffRoles(original: readonly string[], selected: readonly string[]): { added: string[]; removed: string[] }` | Rôles ajoutés et retirés par rapport à l'état d'origine, dans l'ordre de leur apparition. |
| `export function sameRoles(a: readonly string[], b: readonly string[]): boolean` | Vrai si les deux listes contiennent les mêmes rôles (l'ordre ne compte pas). |
| `export function toggleRole(list: readonly string[], code: string): string[]` | Ajoute le code à la liste s'il n'y est pas, le retire sinon (sans modifier la liste d'origine). |
| `export function selectionSummary(roleCount: number, permissionCount: number): string` | Phrase du compteur de sélection, annoncée aux lecteurs d'écran. |

### `search.ts`

| Déclaration | Rôle |
|---|---|
| `export interface SearchHit` | Un résultat de la recherche globale. |
| `export const MIN_QUERY_LENGTH = 2;` | Nombre minimal de caractères avant d'interroger le serveur. |
| `export const HITS_PER_TYPE = 5;` | Résultats demandés par type. |
| `export async function searchAll(query: string, profile: Profile \| null, signal?: AbortSignal): Promise<SearchHit[]>` | Recherche globale (CAD-H1-4) : interroge en parallèle les listes que le profil a le droit de lire (entreprises, utilisateurs). |

### `secret-codes.ts`

| Déclaration | Rôle |
|---|---|
| `export const CODES_FILE_NAME = 'investally-codes-de-secours.txt';` | Nom des fichiers de codes de secours : aucune donnée personnelle (le fichier peut être perdu ou partagé). |
| `export function codesFileText(codes: readonly string[], generatedAt: Date): string` | Contenu du fichier texte et de la copie dans le presse-papiers. |

### `selection.ts`

| Déclaration | Rôle |
|---|---|
| `export type Selection = ReadonlySet<string>;` | Sélection persistante (EXD-02) : ensemble d'identifiants, conservé d'une page à l'autre jusqu'à désélection. |
| `export function toggleId(selection: Selection, id: string): Set<string>` | Ajoute l'identifiant s'il n'y est pas, le retire sinon (renvoie un nouvel ensemble). |
| `export function allSelected(selection: Selection, ids: readonly string[]): boolean` | Vrai si tous les identifiants donnés sont sélectionnés (et qu'il y en a au moins un). |
| `export function someSelected(selection: Selection, ids: readonly string[]): boolean` | Vrai si une partie seulement des identifiants est sélectionnée (case d'en-tête « indéterminée »). |
| `export function setMany(selection: Selection, ids: readonly string[], selected: boolean): Set<string>` | Sélectionne ou désélectionne tous les identifiants donnés, sans toucher à la sélection des autres pages. |

### `status.ts`

| Déclaration | Rôle |
|---|---|
| `export interface StatusStyle` | Libellé et teinte d'un statut (le sens reste porté par le texte). |
| `export function statusStyle(table: Record<string, StatusStyle>, code: string): StatusStyle` | Style d'un statut ; un statut inconnu garde son code brut en teinte neutre (jamais d'erreur d'affichage). |

### `theme.ts`

| Déclaration | Rôle |
|---|---|
| `export type ThemeChoice = 'light' \| 'dark' \| 'system';` | Choix de thème de l'utilisateur : `system` suit le réglage de l'appareil. |
| `export function readTheme(): ThemeChoice` | Choix mémorisé (jamais bloquant : `system` si le stockage est indisponible ou illisible). |
| `export function applyTheme(choice: ThemeChoice): void` | Applique le choix à la page (attribut `data-theme`, absent = réglage de l'appareil) et le mémorise. |
| `export function effectiveTheme(choice: ThemeChoice): 'light' \| 'dark'` | Thème réellement affiché (le choix, ou le réglage de l'appareil pour `system`). |

### `types.ts`

| Déclaration | Rôle |
|---|---|
| `export interface Profile` | Profil de l'utilisateur connecté : identité, rôles, droits (avec portée) et état du MFA. |
| `export interface Page<T>` | Page de résultats paginés renvoyée par l'API. |
| `export interface UserView` | Utilisateur tel que l'API l'expose à l'administration. |
| `export interface RoleView` | Rôle et ses permissions, tels que l'API les expose. |
| `export interface SessionView` | Session de connexion telle que l'API l'expose (la courante est marquée). |
| `export interface Company` | Entreprise cible telle que l'API l'expose. |
| `export interface Contact` | Contact : interlocuteur d'une entreprise. |
| `export interface Offer` | Offre faite à une entreprise (le montant est un texte décimal : jamais converti en nombre avant l'affichage). |
| `export interface Receipt` | Décharge signée d'une offre déposée (le fichier signé est un document rattaché à la décharge). |
| `export interface Followup` | Relance d'une offre en cours : à faire à une échéance, terminée (avec son résultat) ou annulée (avec son motif). |
| `export interface Appointment` | Rendez-vous ou visite d'une entreprise, dans l'agenda de son organisateur. |
| `export interface Opportunity` | Opportunité commerciale d'une entreprise (pipeline). |
| `export interface Approval` | Agrément : promesse de paiement signée par l'entreprise cliente pour une opportunité. |
| `export interface Facilitator` | Facilitateur : personne qui met en relation avec une entreprise. |
| `export interface Facilitation` | Lien entreprise ↔ facilitateur. |
| `export interface LoginEvent` | Une connexion de l'historique (réussie ou échouée) : étape de l'échec, adresse IP et appareil. |
| `export interface LoginHistoryPage` | Page de l'historique : `nextBefore` est le curseur de la page suivante (nul s'il n'y en a pas). |
| `export interface DocumentVersionView` | Une version d'un document (le contenu est immuable ; l'empreinte SHA-256 en atteste l'intégrité). |
| `export interface DocumentView` | Un document avec sa version courante. |
| `export interface DocumentDetailView extends DocumentView` | Détail d'un document : toutes ses versions, de la plus récente à la plus ancienne. |
| `export interface UploadRules` | Règles d'envoi publiées par l'API (taille maximale, extensions, catégories). |

### `use-cooldown.ts`

| Déclaration | Rôle |
|---|---|
| `export function useCooldown(): { remaining: number; start: (seconds: number) => void }` | Compte à rebours d'attente (après un refus pour trop de tentatives) : `start(seconds)` le lance, `remaining` donne les secondes restantes (0 = on peut réessayer). |
