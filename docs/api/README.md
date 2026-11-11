# API Investally : guide, documentation et tests Postman

## Quel type d'API ?
Une **API REST en JSON sur HTTP**, construite avec **NestJS** (Node.js), décrite en **OpenAPI 3** (Swagger).

| Sujet | Réponse |
|---|---|
| Style | REST : ressources (`/companies`, `/learners`…), verbes HTTP (GET, POST, PUT, DELETE), JSON dans les deux sens. Ni GraphQL, ni gRPC |
| Adresse de base | `/api/v1/…` (préfixe versionné). Deux routes de santé hors préfixe : `/health/live` et `/health/ready` |
| Description | OpenAPI 3 : interface `/api/docs`, document `/api/docs-json` (désactivés en production). Une copie enrichie est dans [`openapi.json`](openapi.json) |
| Authentification | Jeton d'accès **Bearer (JWT)** dans l'en-tête `Authorization`, jeton de rafraîchissement en **cookie** `HttpOnly`, **second facteur (MFA) obligatoire** sur toutes les routes protégées |
| Autorisation | Permissions `module.ressource.action` avec **portée** (Propre, Équipe, Tous) ; un objet hors portée répond **404 « introuvable »**, jamais « interdit » (pas de fuite d'existence) |
| Erreurs | « Problem details » (RFC 7807) : `type`, `title`, `status`, `detail` |
| Concurrence | **Verrou optimiste** : un champ `version` à renvoyer pour modifier ; une version périmée répond 409 |
| Protection | En-tête `Origin` contrôlé sur les requêtes qui modifient, limitation de débit (429), en-têtes de sécurité |
| Données | Identifiants en UUID, dates en ISO 8601, **montants en texte décimal** (`"150000.00"`), jours civils `AAAA-MM-JJ` |

**Pas à pas pour charger l'API et la tester** : [GUIDE-CHARGER-ET-TESTER-L-API.html](GUIDE-CHARGER-ET-TESTER-L-API.html) (page autonome, à ouvrir dans un navigateur). **Les tests en JSON** : [`tests-api.json`](tests-api.json) (catalogue lisible) et [`postman/Investally-API.postman_collection.json`](postman/Investally-API.postman_collection.json) (exécutable).

La liste exhaustive des routes, avec la permission de chacune, est dans [REFERENCE-DES-ROUTES.md](REFERENCE-DES-ROUTES.md) (générée). La base de données est décrite dans [`../base-de-donnees/`](../base-de-donnees/README.md).

## Se connecter (3 appels)
```bash
# 1. Connexion : renvoie un jeton d'accès (pas encore vérifié par le second facteur)
curl -s -X POST http://127.0.0.1:3001/api/v1/auth/login -H "Content-Type: application/json" -H "Origin: http://127.0.0.1:3000" \
     -d '{"email":"…","password":"…"}'
# 2. Second facteur : le code à 6 chiffres de l'application d'authentification (ou un code de secours)
curl -s -X POST http://127.0.0.1:3001/api/v1/auth/mfa/verify -H "Authorization: Bearer <jeton du 1>" -H "Content-Type: application/json" -H "Origin: http://127.0.0.1:3000" \
     -d '{"code":"123456"}'          # renvoie le jeton VÉRIFIÉ : à utiliser pour tout le reste
# 3. Appeler une route
curl -s http://127.0.0.1:3001/api/v1/companies?pageSize=5 -H "Authorization: Bearer <jeton du 2>"
```
Un compte qui n'a pas encore de second facteur l'enrôle par `POST /auth/mfa/enroll/start` puis `/auth/mfa/enroll/confirm` (voir le dossier « 00b » de la collection). **Les routes qui modifient** (POST, PUT, DELETE) exigent un en-tête `Origin` autorisé (`ALLOWED_ORIGINS`).

## Conventions
- **Liste paginée** : `?page=1&pageSize=20` (100 au plus) ; réponse `{ "items": […], "total": 123, "page": 1, "pageSize": 20 }`.
- **Erreur** : `{ "type": "…", "title": "NOT_FOUND", "status": 404, "detail": "Entreprise introuvable" }`. Statuts usuels : 400 validation, 401 non authentifié, 403 droit ou second facteur manquant (`MFA_REQUIRED`), 404 introuvable ou hors portée, 409 conflit (doublon, version périmée), 415 type de contenu, 429 trop de requêtes.
- **Modifier** : `PUT /companies/{id}` avec `{ "version": 3, … }` ; la réponse porte la nouvelle version.
- **Rien n'est supprimé** : archivage, annulation avec motif, suppression logique.
- **Audit** : toute action qui modifie (et chaque export) laisse une trace avec l'auteur, la session et l'adresse.

## Tests Postman
Fichiers dans [`postman/`](postman/) :
- `Investally-API.postman_collection.json` : la collection **avec ses tests** (générée, ne pas modifier à la main) ;
- `Investally-local.postman_environment.json` : l'environnement, **sans aucun secret** ;
- [`tests-api.json`](tests-api.json) : le **catalogue des tests** en JSON, lisible sans Postman (chaque route, sa permission, ses statuts attendus, la liste de ses tests) ; généré avec la collection.

### Utiliser
1. Postman › Import : les deux fichiers.
2. Choisir l'environnement « Investally — local » et renseigner **`email`**, **`password`** et **`mfaSecret`** (le secret du second facteur du compte de test, celui du QR code) ; `baseUrl` vaut `http://127.0.0.1:3001` (l'API locale).
3. Lancer **« 00 — Authentification »** (connexion, puis second facteur : le code à 6 chiffres est **calculé automatiquement** depuis `mfaSecret`). Le jeton est conservé et utilisé par tout le reste.
4. Lancer le dossier voulu, ou toute la collection (Collection Runner).

### Ce que contient la collection
| Dossier | Contenu | Tests |
|---|---|---|
| 00 — Authentification | Connexion puis second facteur | Jeton remis, jeton vérifié |
| 00b — Première connexion | Enrôler le second facteur d'un compte neuf | Secret remis, 10 codes de secours remis |
| 01 — Sécurité (173 requêtes) | **Chaque route protégée appelée sans jeton** | Refusée (401) au format « problem details » |
| 02 — Santé | `/health/live`, `/health/ready` | 200 |
| 90 — Parcours de bout en bout | 39 étapes qui créent leurs propres données : entreprise (créer, lire, modifier, exporter), formation (programme, certificat, salle, formateur, session, **étudiant sans entreprise et payeur**, inscription, confirmation, annulation), congés (règles, types, jours fériés), **contrats et parcours** (types, contrat à durée déterminée, second contrat refusé, prolonger, terminer avec un motif de la liste, échéances, lancer un parcours, cocher, décocher, annuler) | Statuts, valeurs métier (montant dû, absence d'agrément, nature), erreur de validation attendue |
| 10 à 34 — une requête par route (172) | Une requête par route, regroupées par domaine, avec la permission dans la description | **Pas d'erreur serveur, jeton accepté, statut prévu, temps de réponse, JSON, erreur au format RFC 7807, champs documentés présents, liste paginée** |
| 98 — Actions de session | Déconnexion, changement de mot de passe, rafraîchissement, second facteur, régénération des codes de secours | À lancer **à part** : elles ferment la session ou changent un secret |

Les parcours (90) s'exécutent **avant** les requêtes de route : ils enregistrent les identifiants qu'ils créent (`companyId`, `learnerId`, `sessionId`…) dans l'environnement, que les requêtes de route réutilisent pour viser de **vrais objets**. Les autres identifiants valent un UUID inexistant : la route répond alors « introuvable », ce qui prouve que la route existe, que le jeton est accepté et que la portée est contrôlée.

### En ligne de commande (Newman)
```bash
npm install -g newman
node scripts/api-docs/run-newman.mjs --env mon-environnement.json --report rapport.json
```
La commande exclut automatiquement les dossiers 00b et 98 ; `--only 00,01,90` choisit des dossiers.

**Résultat de référence** (pile jetable, jeu de démonstration, compte Super administrateur) : **424 requêtes, 1 584 assertions, 0 échec**, en 52 secondes ; 98 : 10 requêtes, 50 assertions, 0 échec ; 00b : 2 requêtes, 4 assertions, 0 échec.

### Régénérer (à chaque changement de route)
```bash
cd apps/crm-api && npx tsc -p tsconfig.build.json --outDir dist-docs && cd ../..
DATABASE_URL=<base jetable> node scripts/api-docs/export-openapi.cjs --dist apps/crm-api/dist-docs --out docs/api/openapi.json
node scripts/api-docs/build-postman.mjs
```
La construction **échoue** si une étape d'un parcours vise une route qui n'existe plus : la collection ne peut pas dériver du code sans qu'on le voie.

### Précautions
- **Ne jamais viser une base de production** : les parcours créent des données (préfixées « Postman »).
- Gardez `password` et `mfaSecret` dans un environnement **hors du dépôt** (type « secret » dans Postman).
- Les requêtes de route qui créent (POST sans identifiant dans l'adresse) envoient **volontairement un corps vide** : la route doit refuser (400) sans rien créer ; les créations réelles sont dans les parcours.

## Ce que ces tests ne couvrent pas
- **Les droits par rôle** : la collection tourne avec **un seul compte** (Super administrateur). La matrice des permissions par rôle est vérifiée par les tests automatiques du projet (`roles.spec`, contrat anti-IDOR, tests d'intégration), pas par Postman. Pour essayer un autre rôle, changez `email`/`password`/`mfaSecret` : les routes refusées répondront 403 ou 404, ce que les tests acceptent.
- **Les routes qui reçoivent des fichiers** (documents, pièces jointes) : le corps envoyé est vide ; un envoi réel se fait à la main.
- **Le cookie de rafraîchissement** n'est exercé que dans le dossier 98.
- **Les réponses exactes** (contenu métier) hors parcours : les tests de route contrôlent la forme (statut, JSON, champs documentés), pas chaque valeur.
