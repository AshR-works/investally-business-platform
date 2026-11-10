# RH-1 — annuaire du personnel (RH légère) : recette

*Fusionné dans `main` avec N1 à N6 (PR #52, étiquette `n-validated`) ; cette recette et ses fiches de test arrivent par une PR de documentation · 2026-11-09 · décisions D55 à D59 prises sur le cadrage [CADRAGE-RH](cadrages/CADRAGE-RH.md) (« Applique les recommandations »), [ADR-0009](adr/0009-rh-legere-dans-le-crm.md) qui amende l'ADR-0005. Trois lots : RH-1a (API, `a63aba3`), RH-1b (écrans et démonstration, `a95c04c` et `cf4d82a`), RH-1c (cette recette, les mutants et les fiches de test).*

## Ce qui est livré

| Demande (décision) | Réponse |
|---|---|
| **La RH vit dans le CRM, sans donnée sensible** (D55, ADR-0009) | Module `hr` du monolithe, **schéma PostgreSQL `hr` propre**, migration `20261116000000_rh_1a_employees` ; **aucune clé étrangère vers un autre schéma** (vérifié par un test sur le catalogue de la base) ; la seule clé est la hiérarchie interne, en `RESTRICT` ; lecture des comptes par un port (`UserDirectory`), sans dépendre du modèle IAM |
| **Périmètre 1 : annuaire et organigramme** (D56) | Fiche d'employé à **identité professionnelle seulement** : matricule (facultatif, libre, en majuscules), nom, prénom, poste, service, responsable, compte lié (facultatif), e-mail et téléphone professionnels, dates d'entrée et de sortie ; liste, fiche, création, modification sous verrou de version, **sortie du personnel = archivage réversible** (date, motif, jamais de suppression) |
| **Données, droits et traces** (D57) | **Aucune donnée sensible** : ni colonne, ni champ, ni route de salaire, naissance, adresse personnelle ou pièce d'identité ; un champ inconnu envoyé à l'API est refusé (400). Permissions `hr.employee.read/create/update/archive` et `hr.directory.read` : **l'annuaire est lisible de tous** les rôles en portée Tous ; la **fiche détaillée suit la portée du compte lié** (RH, Direction, Super administrateur : toutes ; Responsable commercial et Responsable Investudy : leur équipe ; les autres : leur propre fiche) ; **seuls la RH et le Super administrateur écrivent** ; hors portée = « introuvable », identique à un identifiant inexistant ; création, modification, sortie et réintégration **auditées avant/après** ; **chaque lecture détaillée est tracée** (action `VIEW`) |
| **Employé, compte et organigramme** (D58) | Employé distinct du compte (lien 0 ou 1, jamais deux fois, unique en base) ; l'organigramme RH **ne modifie jamais** `users.manager_id` (qui pilote la portée « Équipe » de tous les droits) ; `GET /hr/employees/hierarchy-gaps` **signale** les écarts à la RH et à la Direction (portée Tous exigée dès la garde), sans les corriger |
| **Règles de la hiérarchie** | Pas son propre responsable ; responsable existant et **en poste** ; **aucune boucle** (directe ou indirecte) ; un responsable qui a des collaborateurs en poste **ne sort pas** ; un archivé est gelé ; double sortie et réintégration d'un actif refusées |
| **Annuaire, organigramme, personnel** (écrans) | `/hr` **Annuaire** (personnes en poste, contacts professionnels, recherche, filtre par service) ; `/hr/org-chart` **Organigramme** (arbre repliable au clavier, personne jamais perdue, boucle sans effet d'affichage) ; `/hr/employees` **Personnel** (états En poste / Sortis / Tous, service, recherche, création, modification, sortie, réintégration, encadré des écarts) ; `/hr/employees/[id]` **fiche** (lecture, avec la mention que sa consultation est enregistrée) |
| **Choisir le compte à lier** | `GET /hr/linkable-users` : comptes actifs ou en attente **non encore liés**, **nom seulement** (jamais d'e-mail), réservé au droit de modification : la RH n'a pas accès à la liste des utilisateurs, sans cela le lien aurait été impossible |
| **Menu** | Domaine « Ressources humaines » : **Annuaire** et **Organigramme** pour tout utilisateur ; **Personnel** pour la seule portée Tous (`allScope`) ; plus de module « à venir » dans ce domaine |
| **Jeu de démonstration** | Bloc **« rh »** : 11 fiches fictives (fonctions, noms inventés, e-mails du domaine réservé `@staff.investally.test`), dont une **sortie** ; hiérarchie alignée sur les comptes de démonstration sauf la **Finance** (écart voulu, pour montrer le signalement) ; créé par la RH à travers les vrais cas d'usage ; se charge **seul** sur une démo plus ancienne |
| **Documentation** | Registre D55 à D59, ADR-0009, ARCHITECTURE, RBAC (**régénéré depuis le code**), plan de production, dette D162, cadrage RH ; fiches de test 24 à 27 et fiche de session `rh-1` |

## Preuves

| Contrôle | Résultat |
|---|---|
| Types (`tsc`, API et web), architecture (`pnpm arch`), build de l'interface | 0 erreur · **294 modules, aucune violation** · le build compile `/hr`, `/hr/org-chart`, `/hr/employees` et `/hr/employees/[id]` |
| Tests unitaires de l'API | **1 092 réussis**, 1 ignoré (63 suites) ; nouveaux : domaine de l'employé (11), cas d'usage (création, modification, boucle, unicités, comptes, archivage, portée, trace de lecture, annuaire, écarts, comptes à lier : 20), matrice des rôles (2), plan de démonstration (4) |
| Tests d'intégration (PostgreSQL jetable) | **Rejoués : personnel de bout en bout, 10 passed** (cycle, refus, droits et portée, annuaire, archivage, écarts, règles de la base dont l'absence de clé étrangère sortante, verrou optimiste sur deux modifications simultanées **et au niveau du dépôt**, audit) ; **jeu de démonstration, 8 passed** (dont le bloc « rh » : 11 fiches, un écart, chargement seul) ; avant les écrans : contrat IDOR, `core-schema`, administration (8 suites, 180 passed). **La passe d'intégration complète n'a pas été rejouée** (D149) |
| IDOR | 4 routes classées « objet » (`POST /hr/employees`, `GET`, `PUT` et `POST …/status` d'une fiche), chacune avec sa sonde : même réponse et même corps pour la fiche d'un collègue et pour un identifiant inexistant, aucune fuite (le test cherche le nom de l'employé dans les réponses refusées) ; contrôle positif joué par la RH |
| Tests de l'interface | **669 tests** (34 fichiers) ; nouveaux : saisie **comparée au domaine réel de l'employé côté serveur** (18 cas), corps de création et de modification, aucune donnée sensible saisissable, sortie, actions selon l'état et les droits, aucune suppression, organigramme (tri, racines, boucle), menu et portée Tous, pages en lecture seule |
| **Mutants** | **56 / 56 tués** (script `scripts/mutants/rh1-personnel.py`) : domaine de l'employé (12 : matricule, son propre responsable, archivé gelé, double sortie, réintégration, sortie avant l'entrée, champs obligatoires, longueurs, dates), cas d'usage (18 : droit de création, portée, versions, boucle, responsable archivé ou inconnu, compte inconnu ou déjà lié, unicités, sortie d'un responsable, **lecture non tracée**, portée de la liste, écarts ouverts à tous ou faux, comptes à lier), base (11 : verrou optimiste, annuaire des archivés, portée en base, trois index uniques, état et dates cohérents, pas son propre responsable, sortie après l'entrée, cascade, version positive), matrice des droits (5), interface (8), jeu de démonstration (2). **Un survivant au premier passage, rejoué et tué : B1** (verrou optimiste de la base retiré) : le test « deux modifications simultanées » passait par l'API, où la seconde requête relit la fiche déjà modifiée et échoue au contrôle du cas d'usage ; **un test direct sur le dépôt** (deux fiches lues à la même version, la seconde sauvegarde refusée) a été ajouté, comme pour les ambassadeurs et les sessions |
| **Navigateur réel (Edge + axe-core)** | **Non rejoué** (D160) : aucune des quatre pages n'a été ouverte dans un navigateur ; rendu, repli de l'organigramme, focus, tailles d'écran et lecteur d'écran **non vérifiés** |
| Fiches de test | Fiches d'interface 24 « Annuaire », 25 « Organigramme », 26 « Personnel », 27 « Fiche d'un employé » ; fiche de session `rh-1` |

## Défauts trouvés en chemin et corrigés

- **Une modification refusée laissait la fiche modifiée en mémoire** : le cas d'usage appliquait les changements avant de contrôler le responsable et le compte. Rien n'était enregistré en base (une requête = un objet rechargé), mais le « tout ou rien » n'était pas tenu et un test l'a montré. **Corrigé** : les contrôles qui dépendent d'autres employés ou comptes se font **avant** la modification.
- **Le générateur de `docs/RBAC.md` avait perdu une règle écrite à la main** (« 6 bis », MFA récent pour le changement de responsable d'une entreprise) et la matrice des droits de la Finance était périmée. **Corrigé** : la règle est dans le générateur ; la matrice est régénérée depuis le code.
- **L'écran d'administration des utilisateurs aurait affiché le module `hr` en code brut** (libellés manquants dans l'aperçu des droits). **Corrigé** et deux tests existants adaptés.
- **La RH ne pouvait pas lier un compte** (elle ne lit pas la liste des utilisateurs). **Corrigé** par la route `GET /hr/linkable-users`, nom seulement.
- Le test de la matrice des rôles affirmait « aucun droit métier pour la RH et la Fiscalité » : il distingue désormais les droits commerciaux et Investudy (aucun) des droits sur le personnel (RH : gère ; Fiscalité : sa propre fiche et l'annuaire).

## Réserves sur la recette

- **Écrans non contrôlés dans un navigateur réel** (voir ci-dessus) : le repli de l'organigramme, la mise en page de la liste et des fenêtres sont à regarder en priorité.
- **Valeurs par défaut non confirmées (D59)** : la DGA gère le personnel, un seul responsable par employé, matricule libre, annuaire visible de tous, formateurs externes hors de l'annuaire, démonstration fictive. **Les règles de congés n'ont aucun défaut** : le périmètre 2 (absences et congés) n'est pas commencé.
- **Pas d'export du personnel** (D57 le mentionnait « audité ») : aucune route ni permission d'export n'a été créée ; à ajouter si la RH le demande.
- **Les données du personnel vivent dans la base du CRM** (D162) : l'identité est professionnelle, mais la **durée de conservation et la loi applicable ne sont pas validées** (D11, D65) ; à faire valider avant la production.
- **Bornes** : l'organigramme et les écarts lisent au plus **1 000** employés en poste ; l'annuaire et la liste sont paginés (100 au plus par page).
- **Responsable et accès** : le responsable d'une fiche est une information d'annuaire ; **« voir la fiche de son équipe » repose sur la hiérarchie des comptes** (`users.manager_id`), pas sur l'organigramme RH ; un employé sans compte n'est visible que par la portée Tous.
- **Archivés et comptes** : un compte lié à une fiche sortie n'est plus proposé à un autre employé (unicité pour tous).
- **Base de test partagée** : la CI de la PR #52 a échoué une fois sur un test de la liste des contacts (le contrat IDOR crée un contact par test et, au-delà de 100, ils remplissaient la première page triée par nom). Test corrigé (`d9ea364`) ; la fragilité de fond est la dette D163.

## Dette et à confirmer

- **D162** (migration des données RH vers l'ERP) ; **D59** (valeurs par défaut) ; D11 et D65 (conservation des données du personnel).

## À valider

1. Réinitialiser la pile locale (migrations `20261113…` à `20261116…`) : `node scripts/local-stack.mjs reset`, puis `node scripts/local-stack.mjs --demo --rebuild`.
2. **Annuaire et organigramme** avec plusieurs rôles : mêmes 10 personnes, contacts professionnels seulement ; l'ancien employé sorti n'y est pas.
3. **Personnel** avec le compte RH : créer une fiche (champs obligatoires, unicités), choisir responsable et compte, modifier, enregistrer une sortie, réintégrer ; vérifier qu'un responsable avec collaborateurs ne sort pas et qu'une boucle est refusée.
4. **Droits** : la Direction lit sans action ; le chargé de compte n'a pas l'entrée « Personnel » et ne voit que sa fiche ; une fiche d'un collègue répond « introuvable ».
5. **Écarts** : l'encadré signale la Finance ; aucun bouton de correction ; la hiérarchie des comptes (Administration › Utilisateurs) est inchangée.
6. **Audit** : chaque ouverture d'une fiche laisse une trace de lecture.
7. Répondre aux questions restées ouvertes du cadrage (§ 7), en particulier **qui gère le personnel**, **les services et l'organigramme réels**, et **les règles de congés** (pour lancer RH-2).
8. **Validé** (« Je valide RH-1 », avec N1 à N6) : PR #52 fusionnée, étiquette `n-validated`.
