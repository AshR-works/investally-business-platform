# Méthode complète pour tester l'API à la main

*2026-11-14. Ce document explique **comment** tester l'API manuellement (environnement, Postman, vérification en base) et **pourquoi** chaque choix a été fait. Il complète [`README.md`](README.md) (référence Postman) sans le remplacer, et s'inscrit dans la [charte de tests](../CHARTE-DE-TESTS.md) du projet (§3, niveau « Intégration »). Décision d'environnement : [ARBITRAGE-ENVIRONNEMENTS-DE-TEST](../cadrages/ARBITRAGE-ENVIRONNEMENTS-DE-TEST.md).*

## 1. Ce que ce document couvre, et ce qu'il ne couvre pas

Il couvre le test **manuel** de l'API par la Direction produit, avec de vraies requêtes HTTP contre une vraie base locale — pas les tests automatiques (unitaires, cas d'usage, intégration Jest) qui tournent en continu sur le code et sont décrits dans la charte de tests. Les deux se complètent : les tests automatiques prouvent que le code respecte ses règles à chaque changement ; le test manuel prouve que l'API **réellement démarrée** répond et écrit comme attendu, dans les conditions où on la fera tourner.

## 2. L'environnement local

### 2.1 Un seul environnement, un seed nommé

Une seule pile, pilotée par `node scripts/local-stack.mjs`, à laquelle on indique le **seed** (jeu de données) voulu au démarrage :

```bash
node scripts/local-stack.mjs --seed=demo                   # jeu fictif complet, un compte par rôle
node scripts/local-stack.mjs --seed=organisation            # 10 fiches réelles, administrateur lié à sa fiche
node scripts/local-stack.mjs --seed=organisation-complete   # + catalogue réel + personas
node scripts/local-stack.mjs --seed=organisation --sans-interface   # n'importe quel seed, sans interface (API seule)
```
**Toujours `reset` avant de changer de seed** (`node scripts/local-stack.mjs reset`, taper OUI) : on ne charge jamais un seed par-dessus un autre.

**Justification** : un seul jeu de secrets, un seul port à retenir, un état propre en une commande — voir la grille de l'arbitrage pour le détail des critères face aux cinq dossiers séparés que ce système remplace. Implémenté et vérifié le 2026-11-14 (§6 de l'arbitrage).

### 2.2 Dossiers annexes restants

Les quatre anciens dossiers séparés par usage (`investally-local-api-backend`, `investally-local-api-tests`, les scripts de lancement de `investally-local-demo-dg`, `investally-local-v1-prod`) sont redondants depuis §2.1, mais **pas supprimés** : `investally-local-demo-dg` garde en particulier son rôle de porte-données (`employes-reels.json`, lu par les seeds `organisation*` via `ORGANISATION_DATA_DIR`). Leur retrait reste une décision séparée de la Direction produit.

### 2.3 Pourquoi une base locale, jamais la base de travail

**Jamais contre une base de production ou une base partagée.** Les parcours de bout en bout créent des données (préfixées « Postman »), les requêtes de route peuvent écrire, et une erreur de manipulation (mauvais environnement sélectionné dans Postman) doit rester sans conséquence. C'est pour ça que `baseUrl` est systématiquement vérifié avant d'écrire (§4), et que la collection le rappelle dans sa description : « Ne jamais viser une base de production ».

## 3. La collection Postman : structure et justification

La collection (`docs/api/postman/Investally-API.postman_collection.json`) n'est **jamais écrite à la main** : elle est régénérée depuis la description OpenAPI réelle de l'API (`node scripts/api-docs/build-postman.mjs`, qui lit `docs/api/openapi.json`).

**Pourquoi générée plutôt qu'écrite à la main** : une collection à la main dérive inévitablement du code (une route renommée, un champ ajouté, et la collection teste encore l'ancienne forme sans qu'on s'en aperçoive). En la dérivant d'OpenAPI, la **construction échoue** si un parcours (dossier 90) vise une route qui n'existe plus — la collection ne peut matériellement pas mentir sur ce que l'API expose aujourd'hui.

| Dossier | Contenu | Ce qu'il prouve | Pourquoi il existe |
|---|---|---|---|
| 00 — Authentification | Connexion, puis second facteur (code TOTP **calculé automatiquement** depuis le secret de l'environnement) | Le jeton est remis, puis vérifié par MFA | Sans ça, aucune autre requête n'est acceptée (MFA obligatoire sur tout) |
| 00b — Première connexion | Enrôlement du second facteur d'un compte neuf | Secret et codes de secours remis | À lancer une seule fois par compte ; exclu des lancements automatiques (Newman) pour ne pas ré-enrôler à chaque passage |
| 01 — Sécurité | Chaque route protégée, appelée **sans jeton** | 401 systématique, au format RFC 7807 | Contrat de sécurité : aucune route protégée ne doit répondre autrement que par un refus sans jeton, aussi bête que ça paraisse à vérifier |
| 02 — Santé | `/health/live`, `/health/ready` | 200 | Vérifie que l'API répond du tout, avant d'aller plus loin |
| 90 — Parcours de bout en bout | Scénarios qui créent leurs propres données et vérifient des règles métier (agrément, payeur, portée, verrou de version, contrat et parcours RH, présences) | Le **comportement réel**, pas juste le format de la réponse | Une requête isolée peut répondre 200 sans que la règle métier soit respectée ; un parcours enchaîne les étapes et vérifie l'état après chacune |
| 91 — Écritures de test | Requêtes d'écriture au corps modifiable à la main, avec le SQL de contrôle en description | Qu'un JSON envoyé par Postman se retrouve **en base**, avec sa trace d'audit | Ajouté le 2026-13/14 novembre pour répondre au besoin exprimé : « soumettre un JSON et vérifier qu'il s'est appliqué, en parcourant la base » — voir §4 |
| 10 à 34 — une requête par route | Une requête par route de l'API, groupée par domaine | Jeton accepté, statut prévu, forme JSON correcte, erreurs au format RFC 7807, champs documentés présents | Couverture systématique : toute route existante a au moins une requête qui l'appelle |
| 98 — Actions de session | Déconnexion, changement de mot de passe, rafraîchissement, régénération des codes de secours | Ces actions fonctionnent | Isolées exprès : elles ferment la session ou changent un secret, donc cassent l'enchaînement si elles tournent au milieu des autres |

## 4. Soumettre un JSON et vérifier qu'il s'applique en base (dossier 91)

C'est le besoin concret exprimé : écrire depuis Postman, puis constater le résultat en base, sans avoir à deviner où chercher.

1. **Lancer l'authentification** (dossier 00) sur l'environnement voulu.
2. **Ouvrir une requête du dossier 91**, modifier son corps JSON (onglet *Body*), l'envoyer.
3. **Lire le résultat affiché par la requête** (statut, identifiant créé, enregistré automatiquement dans l'environnement — `ecrHolidayId`, `ecrCompanyId`…) et la **console Postman**, qui affiche un message explicite.
4. **Contrôler en base** avec le SQL donné dans la description de la requête (copier-coller dans `psql`, via `acces-bd.cmd`, ou dans Prisma Studio) : on y retrouve la ligne, avec les mêmes valeurs, et sa trace dans `audit.audit_logs` (auteur, avant/après).
5. Les requêtes suivantes du dossier (modifier, supprimer) réutilisent l'identifiant enregistré : on peut rejouer le cycle complet (créer → modifier → vérifier → supprimer → vérifier la disparition).

**Pourquoi ce dossier reste à lancer requête par requête, jamais avec le bouton « Run »** : il est fait pour être observé à chaque étape (on regarde la base entre deux requêtes), pas pour tourner seul ; c'est pour ça qu'il est exclu de Newman au même titre que 00b et 98.

## 5. En ligne de commande (Newman) : automatiser sans perdre la preuve

```bash
npm install -g newman        # une fois
node scripts/api-docs/run-newman.mjs --env mon-environnement.json --report rapport.json
```
Exclut automatiquement 00b, 91 et 98 (ils ne doivent jamais tourner seuls, en boucle). **Résultat de référence** (pile jetable, jeu de démonstration, compte Super administrateur) : 443 requêtes, 1 626 assertions, 0 échec. **Pourquoi Newman en plus de Postman à la main** : rejouer toute la collection après un changement, sans cliquer dossier par dossier, avec un rapport JSON qu'on peut comparer dans le temps ou joindre à une recette.

## 6. Vérifications complémentaires, hors Postman

Postman prouve que l'API répond correctement à une requête isolée ou à un parcours ; ces scripts prouvent des propriétés plus larges, difficiles à voir requête par requête :

| Script | Ce qu'il prouve | Pourquoi Postman seul n'y suffit pas |
|---|---|---|
| `verifier-lien-api-bd.mjs` | L'API lit et écrit bien dans **sa propre** base (les chiffres renvoyés par l'API égalent ceux lus directement en base ; une écriture par l'API se relit en base, puis disparaît quand l'API la supprime) | Postman voit la réponse de l'API, jamais la base elle-même : il faut une deuxième lecture indépendante (SQL direct) pour exclure qu'un décalage existe entre ce que l'API dit et ce qui est réellement stocké |
| `verifier-audit.mjs` | Chaque écriture par appel d'API est attribuée (compte, session, adresse, appareil, avant/après) ; la seule écriture sans auteur est la création en ligne de commande du tout premier administrateur | L'obligation d'audit (registre des décisions, §A) porte sur **l'attribution**, pas seulement sur l'existence d'une ligne de journal ; il faut vérifier qui, pas seulement que |
| `scripts/mutants/*.py` (mutation testing) | Que les tests automatiques détectent vraiment une faute injectée délibérément dans le code | Un test qui ne peut pas échouer ne prouve rien (principe n° 3 de la charte de tests) ; la couverture de code ne dit pas si les assertions sont pertinentes, seulement si la ligne a été exécutée |
| `scripts/db-docs/v1-manifest.mjs` et `run-verifications.mjs` | La base part d'un jeu de migrations connu et contrôlé (empreintes), et ne contient aucune référence orpheline entre schémas (décision D70) | Spécifique à la base de référence V1 (`--db-only`), avant tout déploiement ; Postman ne regarde jamais le schéma ni les contraintes inter-schémas |

## 7. Régénérer la collection (après tout changement de route)

```bash
cd apps/api && npx tsc -p tsconfig.build.json --outDir dist-docs && cd ../..
DATABASE_URL=<base jetable> node scripts/api-docs/export-openapi.cjs --dist apps/api/dist-docs --out docs/api/openapi.json
node scripts/api-docs/build-postman.mjs
```
Échoue volontairement si un parcours (90 ou 91) vise une route qui n'existe plus (§3).

## 8. Ce que cette méthode ne couvre pas

- **Les droits par rôle** : la collection tourne avec un seul compte (Super administrateur en général). La matrice des permissions par rôle est vérifiée par les tests automatiques (`roles.spec`, contrat anti-IDOR), pas par ce test manuel.
- **L'envoi de fichiers** (documents, pièces jointes) : à essayer à la main, hors collection.
- **La recette utilisateur** (l'écran convient-il à l'usage) : fiches de test dans `docs/tests/`, rejouées par la Direction produit — un registre différent, voir la charte de tests §9.
