# Dette technique et conventions

## Smell Inventory
| # | Smell | Où | Décision | Statut |
|---|---|---|---|---|
| D1 | Risque de *classitis* : une classe par commande/requête/DTO/mapper/port pour des CRUD triviaux | Tous modules | Pour les contextes **supporting/generic** (HR, Tax, Documents), un use case peut regrouper des opérations CRUD d'un même agrégat ; les use cases séparés sont réservés au Core et aux flux à règles | Adopté |
| D2 | Fuite d'information : une même règle (ex. transitions d'état d'`Opportunity`) répétée en validation DTO, use case et SQL | BD, Training | La règle vit **une seule fois dans l'agrégat** ; le DTO ne valide que le format ; la base ne garde que des contraintes d'intégrité | Adopté |
| D3 | Mapping Domain ↔ Prisma répétitif | Infrastructure | Dette acceptée (ADR-0003) ; gabarit de module + tests de mappers en S1 | Acceptée |
| D4 | Duplication volontaire de données entre contextes (événements avec données copiées) | BD→Training→Finance | Dette acceptée ; contrats d'événements versionnés | Acceptée |
| D6 | js-yaml ≤5.4.0 (moyenne, CPU DoS) via @nestjs/swagger ; Swagger n'analyse que du contenu généré par l'application | S1 | Risque accepté ; remonter @nestjs/swagger à la prochaine mise à jour qui embarque js-yaml ≥5.4.1 | Ouverte |
| D7 | Liste de mots de passe courants embarquée courte (~100 entrées) | S3.1 | Remplacer par une liste de 10 000 entrées | S7 |
| D8 | Limitation de débit en mémoire (une seule instance) | S3.1 | Stockage partagé si plusieurs instances | Ouverte |
| D9 | Verrouillage de compte exploitable pour empêcher volontairement un utilisateur de se connecter | S3.1 | Compromis assumé (jamais définitif, paliers) ; alerte et déverrouillage par un administrateur en S3.3 | Acceptée |
| D10 | Pas de rotation automatique des clés de signature JWT | S3.1 | Procédure et plusieurs `kid` | S7 |
| D11 | Envoi d'e-mails sans outbox, sans nouvel essai différé ni disjoncteur ; une seule tentative après un 401 | S3.2 | Outbox transactionnelle (ARCHITECTURE.md) quand un flux d'e-mail critique existe | S3.3 |
| D12 | Une seule clé de chiffrement MFA, pas de rotation ; clé perdue = tous les secrets perdus | S3.2 | Identifiant de clé (`kid`) dans le chiffré, procédure de rotation, sauvegarde en coffre | S7 |
| D13 | Première inscription au MFA protégée par le seul mot de passe (confiance à la première utilisation) | S3.2 | Enrôlement lié à un lien d'invitation par e-mail | S3.3 |
| D14 | Pas de récupération en libre-service du MFA (réinitialisation par un SuperAdmin seulement) | S3.2 | API d'administration `iam.user.reset_mfa` + step-up | S3.3 |
| D15 | Droits relus en base à chaque requête (2 requêtes), sans cache | S3.3 | Volontaire (révocation immédiate) ; cache court avec invalidation seulement si la charge l'exige | Acceptée |
| D16 | Modifier le responsable d'un utilisateur change la visibilité (portée Équipe) sans step-up | S3.3 | Décider : exiger un MFA récent pour ce champ | S3.4 |
| D17 | Entreprises sans propriétaire (avant S3.3) et pas de réattribution de propriétaire | S3.3 | Écran et cas d'usage de réattribution | S4.1 |
| D18 | Pas de révocation explicite d'une invitation (seulement renvoi ou désactivation) | S3.3 | Ajouter si le besoin se confirme | Ouverte |
| D19 | La portée Équipe inclut les subordonnés directs désactivés ou en attente | S3.3 | À confirmer avec le métier (départ d'un salarié) | S4.1 |
| D20 | CSP avec `'unsafe-inline'` pour les scripts (Next.js sans nonce) | S3.4 | CSP à nonce par requête (pages dynamiques) | S7 |
| D21 | ~~Pas de récupération de mot de passe oublié~~ **Soldée en S3.5** : demande libre-service (lien 60 min, anti-énumération, plafonds, audit) et déclenchement par un administrateur | S3.4 | — | Fermée |
| D22 | Tests du front : logique (client HTTP, parseurs) en tests unitaires ; **parcours d'écran vérifiés à la main dans un vrai navigateur**, non automatisés | S3.4 | Tests de bout en bout automatisés (Playwright) avec base jetable | S7 |
| D23 | Interface en français uniquement, mise en page de base (fonctionnelle sur mobile, non maquettée) | S3.4 | Cadrage UX avant S4.1 | Cadrage UX |
| D24 | Le rafraîchissement du jeton n'est pas anticipé : il se fait au premier `401` (un aller-retour de plus après 15 min) | S3.4 | Rafraîchir avant l'expiration si cela gêne | Ouverte |
| D25 | « Mot de passe oublié » : un tiers peut invalider le lien légitime d'une victime en redemandant un lien (3 fois par heure au plus) ; aucune limite globale par IP au-delà des 100 requêtes/minute générales | S3.5 | Alerte sur les rafales `THROTTLED` (tableau de bord Sécurité) ; limite par IP dédiée si besoin | S6.2 |
| D26 | Le traitement « mot de passe oublié » se poursuit après la réponse (en mémoire) : une panne du processus entre la réponse et l'envoi perd la demande (l'utilisateur redemande) | S3.5 | File de messages durable si l'envoi devient critique | Ouverte |
| D27 | L'e-mail de confirmation de changement de mot de passe n'est pas envoyé après un changement fait depuis « Mon compte » (seulement après une réinitialisation) | S3.5 | Même notification pour tout changement | S3.6 |
| D28 | **Module Stocks hébergé provisoirement dans le monolithe du CRM** (dérogation à ADR-0005, voir ADR-0007) | ADR-0007 | Extraire vers l'ERP (ou un service) ; réévaluer au démarrage de l'ERP, ou avant la fin de S4 si l'ERP est décidé | ERP |
| D29 | Deux états de la coque (hub complet, rail compact) à maintenir et tester (navigation B+, DDR-0004) | DEC-002 | Un seul composant à deux états ; tests de focus et d'info-bulles ; essai avec 3 utilisateurs | H1 |
| D30 | Vue « Par étape » des Opportunités sans alternative clavier (DDR-0005) | DEC-003 | Menu « Déplacer vers… » ; mesurer l'usage après deux semaines | S4.3 |
| D31 | **Écoute réelle avec lecteurs d’écran non faite** (audit automatique seulement) ; audit non branché en CI ; prototype de design non audité | A11Y-1 | Product owner / Claude | Protocole `docs/accessibilite/PROTOCOLE-LECTEUR-D-ECRAN.md` ; audit rejouable à la main |
| D5 | Hypothèses de charge et de périmètre non confirmées | Phase 3 | Revue à la fin de S1 avec les chiffres réels | Ouverte |

## Adopted Conventions
- **Nommage** : vocabulaire du glossaire (`docs/ARCHITECTURE.md`) dans le code, les tests et l'API. Code en anglais, libellés UI en français. Un terme du glossaire = un seul nom de code.
- **Où vit le comportement** : dans les entités/agrégats (`opportunity.advanceTo(stage)`), pas dans des `*Manager`/`*Helper`.
- **Un module = une interface publique** (`index.ts`) ; tout le reste est interne.
- **Erreurs** : le Domain lève des erreurs métier typées ; la Presentation les traduit en réponses HTTP (RFC 7807 `application/problem+json`).
- **Pas de décorateur de framework** dans `domain/`. Validation d'entrée dans les DTO de `presentation/`.
- **Commandes vs requêtes** : une commande modifie l'état via un agrégat ; une requête retourne un read model et peut lire la base directement via un port de lecture dans `infrastructure/`.
- **Temps et identifiants** injectés (`Clock`, `IdGenerator`) pour des tests déterministes.
- **Pas d'abstraction spéculative** : une interface ne se crée que pour une frontière réelle (persistance, service externe, autre contexte).
- **Dette tracée** : tout raccourci est ajouté à ce tableau avec un propriétaire.
