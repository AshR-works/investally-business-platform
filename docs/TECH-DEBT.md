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
| D32 | **Styles « legacy »** : les contrôles de formulaire (champs, boutons, libellés) de tous les écrans, et les blocs de Mon compte (profil, mot de passe, codes de secours) ; les écrans d'accès ont le gabarit du design depuis H2a gardent leurs classes CSS dans la couche `legacy` de `globals.css` (aux jetons du design) au lieu des classes Tailwind | H1 | Claude | À retirer écran par écran (H2 pour l'accès, S4 pour le métier) |
| D33 | **Thème appliqué après le premier rendu** : un utilisateur dont le choix explicite diffère du réglage de l'appareil peut voir un bref clignotement. Corriger avec un script de pré-rendu à `nonce` (lié à D20) | H1 | Claude | Aucun impact sécurité ; défaut visuel mineur |
| D34 | **Recherche globale côté interface** (une requête par type : 2 aujourd'hui) | H1, CAD-H1-4 | Claude | À remplacer par une route dédiée quand 4 types existent (S4.1 à S5) |
| D35 | **Logos en PNG** (SVG officiels attendus) ; thème sombre obtenu par filtre CSS monochrome (DDR-0002), le symbole sombre n'est pas une variante dessinée | H1 | Direction produit | Fournir SVG et variante sombre avant mise en ligne |
| D36 | **Bouton de dépliage** : pictogramme provisoire et bouton masqué sur la Vue d'ensemble (DDR-0007, points ouverts 1 et 2) | H1 | Direction produit | À confirmer (version 0.4.2 du design si changement) |
| D37 | **Barre de sélection sans actions groupées** : la sélection fonctionne (EXD-02) mais aucune route ne permet d'agir sur plusieurs lignes (exporter, réassigner, couper les sessions) | H1b | Claude | Cadrage de sécurité dédié (export, réassignation) après le cadrage UX, puis livraison (ARB-API-3) |
| D38 | **Colonnes et filtres métier absents des tableaux** (responsable, valeur, dernière activité, compteurs par statut, Filtres, Colonnes, Export) : l'API ne les fournit pas | H1b | Direction produit | Échéance S4.1 (ARB-API-1 C) ; Pays et Créée le déjà affichés ; voir `cadrages/ECART-MOCKUP-VS-REEL.md` |
| D39 | **Nombre de codes de secours restants non affiché** (écran A03) : l'API ne le fournit pas | H2a | Claude | Ajouter le compteur à la route de profil si la direction produit le souhaite (H2b) |
| D40 | **Adresse IP des sessions et de l'historique** : exacte seulement si le proxy de production est configuré (`TRUST_PROXY`) ; sinon elle montrera l'adresse du proxy | H2b | Claude | À vérifier à la mise en production (S7.1) |
| D41 | **Stockage des documents sur disque local** : ne convient pas à plusieurs serveurs ; adaptateur S3 (versionné, chiffré) et sauvegarde du dossier à livrer (ADR-0008, CAD-S36-1) | S3.6 | Claude | S7.1 |
| D42 | **Aucune analyse antivirus** : chaque version est `PENDING` (« non analysé »). **Condition bloquante de la mise en production** (CAD-S36-2) | S3.6 | Claude | S7.2 |
| D43 | **Un seul type d'objet propriétaire déclaré (entreprises)** : offres, opportunités, agréments, sessions et incidents doivent déclarer leur résolveur dans le registre des documents (refus par défaut tant que non fait) | S3.6 | Claude | S4.2 à S6.3, au fil des modules |
| D44 | **Fichier lu en entier en mémoire** (≤ 10 Mo) à l'envoi et au téléchargement pour calculer et vérifier l'empreinte ; à repasser en flux si la taille maximale augmente | S3.6 | Claude | Si la limite dépasse 10 Mo |
| D45 | **Durée de conservation des documents archivés et catégories** : valeurs par défaut appliquées (pas de purge ; 6 catégories) faute de réponse de la direction produit | S3.6 | Direction produit | À confirmer avec l'avis juridique (Étape 0) |
| D46 | **PDF des codes de secours par impression navigateur** : ce n'est pas un téléchargement en un clic. Un générateur interne (≈ 80 lignes, 83/105 au cadrage) reste possible si le un-clic est exigé | S3.7 | Claude | À la demande |
| D47 | **Garde de sortie des codes de secours** : couvre la fermeture, le rechargement et les liens internes, **pas** le bouton « Précédent » du navigateur ni le bouton de déconnexion ; les codes non conservés sont alors perdus (il faut en régénérer) | S3.7 | Claude | À évaluer avec l'écoute réelle (D31) |
| D48 | **E-mail d'information après régénération des codes de secours** (bonne pratique) : dépend de l'envoi d'e-mail réel (Microsoft 365, S7) | S3.7 | Claude | S7 |
| D49 | **Prototype de design non mis à jour** : œil du mot de passe, fenêtre `danger`, panneau des codes ; à ajouter à la version 0.5.0 (DDR-0010 et, depuis S3.8, DDR-0011 : sélecteur de rôles) | S3.7 | Claude | Prochaine mise à jour du design |
| D50 | **Libellés des modules, ressources et actions dupliqués dans l'interface** (`lib/roles.ts`) : un test de complétude les compare au catalogue du serveur, mais l'idéal est de les exposer par l'API | S3.8 | Claude | À l'ajout d'un module (S4) |
| D51 | **Familles de rôles codées dans l'interface** : un nouveau rôle apparaît dans « Autres rôles » jusqu'à son rangement ; une métadonnée de famille côté API supprimerait la duplication | S3.8 | Claude | À l'ajout d'un rôle |
| D52 | **Aperçu des droits calculé côté interface** (règle de cumul reprise du serveur) : sa cohérence est testée sur les 1 024 combinaisons, mais toute évolution de la règle serveur impose de mettre à jour l'interface | S3.8 | Claude | Permanent (test de cohérence) |
| D53 | **Facilitateur : ni modification ni suppression**, un seul facilitateur par entreprise, lien non modifiable après la création (seule la création est livrée) | S4.0 | Claude | S4.1 (fiche entreprise 360°) |
| D54 | **Commission : aucun suivi des versements** (due, déblocage des fonds par la direction administrative et financière, versée par le chargé de compte, date) : *devenu un besoin réel le 2026-10-29* puisque le chargé de compte verse la commission ; seul le principe convenu est enregistré. À cadrer avec la Finance | S4.0 | Claude | Prochain lot après S4.1, à confirmer |
| D55 | **Données personnelles du facilitateur (tiers)** : base légale, information de la personne, durée de conservation et droit d'effacement à faire valider ; en attendant, mêmes protections que les autres données (portée, audit des créations) | S4.0 | Direction produit | Avis juridique S7 |
| D56 | ~~Devise de la commission saisie à chaque fois~~ **Réglée le 2026-10-29** : devise par défaut le FCFA d'Afrique centrale (XAF) ; une liste fermée de devises reste possible | S4.0 | Direction produit | Fait |
| D57 | **Pays de l'entreprise en saisie libre** (avec suggestions) : des fautes de frappe fausseraient les rapports par pays ; une liste fermée de pays (ou un code ISO) serait plus fiable | S4.0 | Direction produit | Avant S6 (tableaux de bord) |
| D58 | ~~Fiche entreprise non téléchargeable~~ **Réglée le 2026-10-30** : export de la fiche (qui voit exporte, trace d'audit) au format HTML imprimable ; gabarit provisoire à remplacer par la charte des documents | S4.0 | Claude | Charte des documents |
| D59 | **Export d'une liste entière non réalisé** : règle retenue (option C) = lecture donne l'export, avec confirmation récente de la double authentification et alerte dans l'audit ; à construire avec les listes exportables | S4.0 | Claude | Premier export de liste |
| D60 | **Vues partagées** (rapports des employés, agendas partagés) : elles suivent une audience (tous, service, équipe) et non une portée par propriétaire ; concept d'audience à modéliser, et contenu sensible (performances des employés) à valider avec le juridique et les RH | S4.0 | Direction produit | Agenda (S4.2b) et rapports (S6.3) |
| D61 | **PDF réel côté serveur** : aujourd'hui le navigateur imprime la fiche en PDF ; un PDF produit par le serveur (même rendu pour tous, un seul clic) demande d'ajouter une bibliothèque au projet, à décider | S4.0 | Direction produit | Charte des documents |
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
