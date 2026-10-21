# Index des fonctions et composants (généré)

> Document **généré** par `node scripts/gen-function-index.mjs` à partir des commentaires du code. Ne pas le modifier à la main : corriger le commentaire dans le fichier source, puis relancer le script.

**535 déclarations commentées au total.**


## API (NestJS) — 459 déclarations commentées

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

### `cli/seed-core.ts`

| Déclaration | Rôle |
|---|---|
| `async function main()` | `pnpm crm-api seed:core` — synchronise rôles et permissions (idempotent, sans utilisateur). |

### `main.ts`

| Déclaration | Rôle |
|---|---|
| `async function bootstrap()` | Démarre l'API : charge la configuration (refuse de démarrer si elle est dangereuse en production), monte l'application et écoute sur l'adresse locale uniquement. |

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
| `export class AuditModule {}` | Module d'audit : fournit l'enregistreur (`AUDIT_RECORDER`) aux autres modules ; le journal est en ajout seul, partitionné par mois. |

### `modules/audit/domain/audit-entry.ts`

| Déclaration | Rôle |
|---|---|
| `export interface AuditEntry` | Entrée immuable du journal : qui, quoi, quand, d'où, avant, après. |

### `modules/audit/domain/audit-repository.ts`

| Déclaration | Rôle |
|---|---|
| `export interface AuditRepository` | Append-only : aucune méthode de modification ni de suppression. |

### `modules/audit/infrastructure/prisma-audit.repository.ts`

| Déclaration | Rôle |
|---|---|
| `const asJson = (value: Record<string, unknown> \| null)` | Convertit une valeur facultative en JSON Prisma (`null` devient NULL en base, pas la chaîne « null »). |
| `export class PrismaAuditRepository implements AuditRepository` | Écrit et relit le journal d'audit dans PostgreSQL (schéma `audit`). |
| `async append(entry: AuditEntry): Promise<void>` | Ajoute une entrée immuable au journal (acteur, session, IP, appareil, entité, action, avant/après). |
| `async listByEntity(entityType: string, entityId: string): Promise<AuditEntry[]>` | Historique d'une entité, du plus ancien au plus récent (500 entrées au plus). |

### `modules/business-development/application/company-view.ts`

| Déclaration | Rôle |
|---|---|
| `export interface CompanyView` | Modèle de lecture exposé par l'Application (pas l'entité). |
| `export function toCompanyView(company: Company): CompanyView` | Transforme une entreprise du domaine en représentation publique (aucun objet interne n'est exposé). |

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

### `modules/business-development/application/register-company.use-case.ts`

| Déclaration | Rôle |
|---|---|
| `export interface RegisterCompanyCommand` | Données d'enregistrement d'une entreprise cible ; le propriétaire vient de l'identité de l'appelant, jamais du corps de la requête. |
| `export class RegisterCompanyUseCase` | Cas d'usage : enregistrer une entreprise cible, refuser un doublon de nom, tracer l'opération. |
| `async execute(command: RegisterCompanyCommand): Promise<CompanyView>` | Crée l'entreprise et son audit dans une même transaction ; un nom déjà pris (sans tenir compte de la casse ni des espaces) est un conflit. |

### `modules/business-development/business-development.module.ts`

| Déclaration | Rôle |
|---|---|
| `export class BusinessDevelopmentModule {}` | Module « Développement commercial » : entreprises cibles (première brique du pipeline commercial). |

### `modules/business-development/domain/company-name.ts`

| Déclaration | Rôle |
|---|---|
| `export class CompanyName` | Objet-valeur : nom d'entreprise normalisé (espaces nettoyés, longueur bornée) avec une clé de comparaison sans casse. |
| `get normalized(): string` | Clé de comparaison pour la détection de doublons. |

### `modules/business-development/domain/company-repository.ts`

| Déclaration | Rôle |
|---|---|
| `export interface CompanyRepository` | Port de persistance des entreprises : enregistrer, retrouver, tester l'unicité du nom et lister selon les propriétaires autorisés. |
| `list(query: { page: number; pageSize: number; search?: string; ownerIds?: readonly string[] }): Promise<Page<Company>>;` | `ownerIds` : restreint aux entreprises de ces propriétaires (liste vide = aucune) ; absent = pas de restriction (portée Tous). |

### `modules/business-development/domain/company.ts`

| Déclaration | Rôle |
|---|---|
| `export interface CompanyProps` | État interne d'une entreprise (identité, nom, statut, propriétaire, horodatages). |
| `export class Company extends AggregateRoot` | Entreprise cible : racine d'agrégat du pipeline commercial. |
| `static rehydrate(props: CompanyProps): Company` | Reconstitution depuis la persistance : aucun événement émis. |
| `archive(): void` | Archive l'entreprise ; refuse de l'archiver deux fois (règle métier). |

### `modules/business-development/domain/events/company-registered.ts`

| Déclaration | Rôle |
|---|---|
| `export class CompanyRegistered implements DomainEvent` | Événement de domaine : une entreprise vient d'être enregistrée (sera publié vers d'autres contextes plus tard). |

### `modules/business-development/infrastructure/prisma-company.repository.ts`

| Déclaration | Rôle |
|---|---|
| `function toDomain(row: CompanyRow): Company` | Reconstruit une entreprise du domaine à partir d'une ligne de base de données. |
| `export class PrismaCompanyRepository implements CompanyRepository` | Persistance PostgreSQL des entreprises (suppression logique : une entreprise supprimée est ignorée partout). |
| `async save(company: Company): Promise<void>` | Crée ou met à jour l'entreprise (clé de nom normalisée pour l'unicité). |
| `async findById(id: string): Promise<Company \| null>` | Retrouve une entreprise non supprimée, ou `null`. |
| `async existsByName(name: CompanyName): Promise<boolean>` | Vrai si une entreprise non supprimée porte déjà ce nom (comparaison sans casse). |
| `async list(query: { page: number; pageSize: number; search?: string; ownerIds?: readonly string[] }): Promise<Page<Company>>` | Liste paginée, la plus récente d'abord ; `ownerIds` restreint aux propriétaires autorisés (liste vide = aucune entreprise), absent = aucune restriction. |

### `modules/business-development/presentation/companies.controller.ts`

| Déclaration | Rôle |
|---|---|
| `export class CompaniesController` | Chaque route est protégée : identité + MFA vérifié + permission. |
| `register(@Body() dto: RegisterCompanyDto, @Access() access: AccessContext, @CurrentActor() actor: AuthenticatedActor, @Req() req: Request)` | L'utilisateur qui crée l'entreprise en devient le propriétaire. |

### `modules/business-development/presentation/dto/list-companies.dto.ts`

| Déclaration | Rôle |
|---|---|
| `export class ListCompaniesDto` | Paramètres de requête de la liste (page, taille ≤ 100, recherche) validés avant d'atteindre le cas d'usage. |

### `modules/business-development/presentation/dto/register-company.dto.ts`

| Déclaration | Rôle |
|---|---|
| `export class RegisterCompanyDto` | Corps de la requête d'enregistrement : nom obligatoire, secteur et pays facultatifs, longueurs bornées ; tout autre champ (notamment le propriétaire) est refusé. |

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

## Interface web — pages (Next.js) — 37 déclarations commentées

### `(app)/account/page.tsx`

| Déclaration | Rôle |
|---|---|
| `export default function AccountPage()` | Page « Mon compte » : profil, changement de mot de passe, nouveaux codes de secours et liste des sessions de l'utilisateur connecté. |
| `function PasswordForm({ email }: { email: string })` | Formulaire de changement de mot de passe : indications en direct, confirmation obligatoire, message d'erreur du serveur affiché tel quel. |
| `async function submit(event: FormEvent)` | Envoie l'ancien et le nouveau mot de passe ; les champs sont vidés après succès (le serveur coupe les autres sessions). |
| `function RecoveryCodes()` | Génère de nouveaux codes de secours (les anciens cessent de fonctionner) et les affiche une seule fois ; un code MFA récent est demandé si nécessaire. |
| `async function regenerate()` | Appelle la régénération et garde les codes en mémoire uniquement, jusqu'à ce que l'utilisateur les masque. |
| `function Sessions()` | Liste les sessions actives de l'utilisateur (appareil lisible, IP, dates) et permet de révoquer les autres. |
| `async function revoke(id: string)` | Révoque une session puis recharge la liste. |

### `(app)/admin/users/page.tsx`

| Déclaration | Rôle |
|---|---|
| `export default function UsersPage()` | Page d'administration des utilisateurs : liste, recherche, filtre, pagination et actions (inviter, rôles, désactiver, réinitialiser mot de passe ou MFA, couper les sessions). |
| `async function run(action: () => Promise<unknown>, success: string)` | Exécute une action d'administration, affiche son résultat (succès ou message du serveur), ferme la fenêtre et recharge la liste. |
| `function confirmAction(user: UserView, action: 'disable' \| 'enable' \| 'resetMfa' \| 'revokeSessions' \| 'resend' \| 'resetPassword')` | Associe chaque action de confirmation à son appel d'API et à son message de succès. |
| `function RoleChoices({ roles, selected, onToggle }: { roles: RoleView[]; selected: string[]; onToggle: (code: string) => void })` | Cases à cocher des rôles, avec leur description. |
| `function toggle(list: string[], code: string): string[]` | Ajoute le code à la liste s'il n'y est pas, le retire sinon (sans modifier la liste d'origine). |
| `function InviteDialog({ roles, managers, onClose, onSubmit }:` | Fenêtre d'invitation : adresse, nom, rôles et responsable facultatif. |
| `async function submit(event: FormEvent)` | Envoie l'invitation avec les rôles cochés (au moins un). |
| `function RolesDialog({ user, roles, onClose, onSubmit }:` | Fenêtre de modification des rôles d'un utilisateur ; le changement s'applique immédiatement, y compris aux sessions ouvertes. |

### `(app)/layout.tsx`

| Déclaration | Rôle |
|---|---|
| `export default function AppLayout({ children }: { children: ReactNode })` | Cadre de toutes les pages connectées : n'affiche rien tant que l'utilisateur n'est pas authentifié avec son second facteur. |
| `function Shell({ children }: { children: ReactNode })` | Barre latérale (menus selon les droits, identité, déconnexion) et zone de contenu. |

### `(app)/page.tsx`

| Déclaration | Rôle |
|---|---|
| `export default function CompaniesPage()` | Page d'accueil : entreprises visibles selon la portée de l'utilisateur et création d'une entreprise (si le droit existe). |
| `async function submit(event: FormEvent)` | Enregistre l'entreprise saisie puis recharge la liste. |

### `forgot-password/page.tsx`

| Déclaration | Rôle |
|---|---|
| `export default function ForgotPasswordPage()` | Page « Mot de passe oublié » : accessible sans connexion, réservée aux visiteurs non connectés. |
| `function ForgotPasswordForm()` | Demande un lien de réinitialisation. |
| `async function submit(event: FormEvent)` | Demande le lien ; affiche toujours la même confirmation, seule une erreur de limitation ou de panne est signalée. |

### `invitation/page.tsx`

| Déclaration | Rôle |
|---|---|
| `export default function InvitationPage()` | Page d'activation d'un compte invité : lit le jeton dans le fragment de l'URL, l'efface de l'adresse, puis laisse choisir le mot de passe. |
| `async function submit(event: FormEvent)` | Envoie le jeton et le mot de passe ; un refus (lien invalide, mot de passe refusé) est affiché et le lien reste utilisable si c'est le mot de passe qui est en cause. |

### `layout.tsx`

| Déclaration | Rôle |
|---|---|
| `export default function RootLayout({ children }: { children: ReactNode })` | Structure HTML commune (langue française) et fournisseur d'authentification de toute l'application. |

### `login/page.tsx`

| Déclaration | Rôle |
|---|---|
| `export default function LoginPage()` | Page de connexion, réservée aux visiteurs non connectés. |
| `function LoginForm()` | Formulaire de connexion (adresse, mot de passe) avec lien « Mot de passe oublié ». |
| `async function submit(event: FormEvent)` | Tente la connexion ; en cas d'échec affiche le message unique du serveur et vide le mot de passe. |

### `mfa/page.tsx`

| Déclaration | Rôle |
|---|---|
| `export default function MfaPage()` | Page du second facteur : vérification d'un code, ou première configuration si le MFA n'est pas encore en place. |
| `function MfaScreen()` | Choisit l'écran (configuration ou vérification) selon l'état de la session et permet de changer de compte. |
| `function Verification()` | Saisie du code TOTP ou d'un code de secours à usage unique. |
| `async function submit(event: FormEvent)` | Envoie le code ; un échec est affiché et le champ vidé (une seule requête par tentative). |
| `function groupSecret(secret: string): string` | Présente la clé manuelle par groupes de 4 caractères pour la saisir plus facilement. |
| `function Enrollment()` | Première configuration du MFA : QR code généré dans le navigateur, clé manuelle, confirmation par un premier code, puis affichage unique des codes de secours. |
| `async function confirm(event: FormEvent)` | Confirme l'enrôlement avec le code saisi ; en cas de succès les codes de secours sont affichés et le secret effacé de la mémoire. |

### `reset-password/page.tsx`

| Déclaration | Rôle |
|---|---|
| `export default function ResetPasswordPage()` | Page ouverte depuis le lien reçu par e-mail. |
| `async function submit(event: FormEvent)` | Envoie le jeton et le nouveau mot de passe ; le serveur coupe toutes les sessions, l'utilisateur doit se reconnecter avec son second facteur. |

## Interface web — composants — 4 déclarations commentées

### `gate.tsx`

| Déclaration | Rôle |
|---|---|
| `export function Gate({ allow, children }: { allow: readonly Exclude<AuthStatus, 'loading'>[]; children: ReactNode })` | Laisse passer uniquement les états attendus ; sinon redirige vers l'écran qui correspond à l'état réel. |

### `modal.tsx`

| Déclaration | Rôle |
|---|---|
| `export function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode })` | Fenêtre modale accessible : Échap ferme, le focus entre dans la fenêtre, le fond est inerte pour les lecteurs d'écran. |

### `step-up-dialog.tsx`

| Déclaration | Rôle |
|---|---|
| `export function StepUpDialog({ onDone }: { onDone: (ok: boolean) => void })` | Demande un code frais du second facteur avant une action sensible (modification de rôles, désactivation, etc.). |
| `async function submit(event: FormEvent)` | Vérifie le code ; en cas de succès le nouveau jeton remplace l'ancien et l'action sensible est rejouée. |

## Interface web — bibliothèque — 35 déclarations commentées

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

### `device.ts`

| Déclaration | Rôle |
|---|---|
| `export function deviceLabel(userAgent: string): string` | Libellé court et lisible d'un User-Agent (« Chrome sur Windows »). |

### `invitation.ts`

| Déclaration | Rôle |
|---|---|
| `export function parseInvitationFragment(hash: string): string \| null` | Le jeton d'invitation est dans le FRAGMENT de l'URL (`#token=…`) : le navigateur ne l'envoie ni au serveur ni dans l'en-tête Referer. |

### `password.ts`

| Déclaration | Rôle |
|---|---|
| `export const PASSWORD_MIN_LENGTH = 12;` | Longueur minimale d'un mot de passe (la même règle que côté serveur, qui reste seul juge). |
| `export function passwordHints(password: string, email = ''): string[]` | Indications affichées pendant la saisie (longueur, identifiant e-mail contenu) ; la règle qui fait foi est celle du serveur. |

### `permissions.ts`

| Déclaration | Rôle |
|---|---|
| `export function can(profile: Profile \| null, permission: string): boolean` | Informatif seulement (menus, boutons) : le serveur re-contrôle chaque requête. |
| `export const roleLabel = (code: string): string => ROLE_LABELS[code] ?? code;` | Libellé français d'un rôle (le code brut si le rôle est inconnu). |

### `types.ts`

| Déclaration | Rôle |
|---|---|
| `export interface Profile` | Profil de l'utilisateur connecté : identité, rôles, droits (avec portée) et état du MFA. |
| `export interface Page<T>` | Page de résultats paginés renvoyée par l'API. |
| `export interface UserView` | Utilisateur tel que l'API l'expose à l'administration. |
| `export interface RoleView` | Rôle et ses permissions, tels que l'API les expose. |
| `export interface SessionView` | Session de connexion telle que l'API l'expose (la courante est marquée). |
| `export interface Company` | Entreprise cible telle que l'API l'expose. |
