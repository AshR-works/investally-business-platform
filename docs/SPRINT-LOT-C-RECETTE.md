# Lot C — exports d'administration pour les audits : recette

*Branche `feat/lot-c-exports-admin` · 2026-11-11 · décision **D66** (« Super administrateur uniquement », puis « applique les recommandations » pour le fichier d'audit), [ADR-0012](adr/0012-exports-d-administration-pour-les-audits.md).*

## Ce qui est livré
| Demande | Réponse |
|---|---|
| **Trois exports** | `GET /admin/exports/{users\|rights\|sessions}` en **CSV** : **utilisateurs** (identité, statut, rôles en codes et en libellés, responsable, second facteur actif, dernière connexion, création), **droits** (une ligne par rôle et par permission : module, ressource, action, portée en français), **sessions** (connexion, activité, fin ou motif de fin, adresse IP, appareil, niveau de risque, second facteur vérifié) |
| **Super administrateur seulement** | Nouvelle permission `iam.export.read`, **portée Tous**, détenue par le seul Super administrateur (test) ; le cas d'usage revérifie la portée, sans se fier au seul contrôleur ; tout autre rôle : 403 |
| **Second facteur récent** | Gardes dans l'ordre : jeton, second facteur vérifié, permission, second facteur **récent** (10 minutes) ; l'interface redemande le code au clic |
| **Trace avant remise** | Chaque export écrit une ligne d'audit (auteur, session, adresse, nature, nombre de lignes, nom du fichier, période) **avant** de répondre ; si l'écriture échoue, **rien n'est remis** ; la trace ne recopie jamais le contenu ; un export refusé ne laisse pas de trace d'export |
| **Aucun secret** | Le lecteur **sélectionne ses colonnes une à une** : hachage du mot de passe, secret du second facteur, dernier pas TOTP, compteur d'échecs, codes de secours et jetons ne sont jamais lus ; le cas d'usage n'écrit que des colonnes nommées (un champ ajouté par erreur ne fuit pas) ; testé sur le fichier réel contre les valeurs de la base |
| **Injection de formule** | Un texte qui commence par `=`, `+`, `-`, `@`, tabulation ou retour chariot reçoit une apostrophe en tête |
| **Tableur français** | UTF-8 avec marque d'ordre des octets (accents lus par Excel), séparateur « ; », fin de ligne CRLF, valeurs « oui » / « non » |
| **Volume et période** | Au-delà de 10 000 utilisateurs ou 50 000 sessions : export **refusé**, jamais tronqué ; sessions sur 1 à 365 jours (90 par défaut) ; comptes supprimés logiquement exclus |
| **Réponse** | `text/csv`, téléchargement forcé (`attachment`), `no-store`, `nosniff`, `default-src 'none'`, nom daté sans deux-points |
| **Interface** | Page **Administration › Exports** (Super administrateur seulement) : trois cartes avec leur description et leurs colonnes, choix de la période des sessions, encadré « À savoir avant d'exporter » (données personnelles, aucun secret, Excel, volume), message de succès, boutons occupés pendant l'export |
| **Documentation de l'API** | `openapi.json` régénéré (route décrite : types d'export, réponse `text/csv`, permission, step-up), collection Postman avec un test CSV, référence des routes, `docs/RBAC.md` (118 permissions) |

## Preuves
| Contrôle | Résultat |
|---|---|
| Types, architecture | `tsc` propre (API et interface) ; `pnpm arch` : **318 modules, aucune violation** |
| Tests unitaires de l'API | **1 361 réussis** (les 2 suites qui exigent une base ne tournent qu'en intégration) ; nouveaux : `csv.spec` (7), `admin-exports.spec` (20 : contenu des trois exports, aucun secret même si le lecteur en remettait, formules, limites exactes, refus de tout autre rôle, portée Propre ou Équipe insuffisante, trace, trace en échec), `admin-exports.controller.spec` (3 : permission, portée, ordre des gardes) |
| Tests de l'interface | **768 réussis** ; nouveau `lot-c-exports.test` qui interroge le **serveur réel** : types et en-têtes d'accord, périodes, adresse, nom de fichier, menu réservé au Super administrateur |
| Intégration (base jetable) | `admin-exports-http` (**11** tests : trois exports et en-têtes, aucun secret comparé aux valeurs de la base, formule neutralisée, droits, sessions et période, type inconnu, **403 pour les neuf autres rôles**, step-up, trace, compte supprimé, lecture bornée) + `rbac-http`, `idor-contract`, `core-schema` : **168 réussis, 5 suites** |
| **Mutants** | `scripts/mutants/lotc-exports.py` : **55 sur 55 tués**. Premier passage : 50 sur 56, six survivants traités : bornes exactes de volume (2 tests), libellé de ressource (mutant mal construit, refait), permission et second facteur de la route (test des métadonnées), lecture bornée en base (test sur la vraie base). Un mutant **équivalent** retiré : l'en-tête `nosniff` de la route double celui de Helmet |
| Postman (Newman, pile jetable) | **375 requêtes, 1 423 assertions, 0 échec**, dont la nouvelle route (type `text/csv`, téléchargement forcé, jamais en cache, marque d'ordre des octets lue sur les octets bruts) |
| Contrôle visuel (navigateur, compte Super administrateur) | La page s'affiche avec ses trois cartes ; le clic sur Utilisateurs télécharge (requête 200) et affiche « Le fichier … est enregistré. Cet export est tracé dans l'audit. » |

## Limites connues (dettes D177 et D178)
- **Données personnelles** : l'export des sessions contient des adresses IP et des appareils ; durée de conservation du fichier et base légale à fixer (avis juridique) ; le fichier téléchargé échappe au contrôle de la plateforme.
- **CSV seulement** : pas de PDF, pas de signature d'intégrité du fichier, ni tentatives de connexion échouées ni journal d'audit ; pas d'export différé au-delà des limites.
- **Non vérifié** : le second facteur redemandé dans la fenêtre au clic (testé côté serveur, pas rejoué dans le navigateur), l'ouverture du fichier dans Excel, le mode sombre, 1280 et 1920 px, le clavier.
- Trois valeurs de départ prises sans réponse explicite : CSV seul, séparateur « ; », adresses IP et appareils inclus.

## Comment vérifier
1. Démarrer la pile avec démonstration (`node scripts/local-stack.mjs --demo --rebuild`) ; se connecter en Super administrateur ; Administration › Exports ; télécharger les trois fichiers et les ouvrir dans Excel.
2. Rejouer la fiche de session `docs/tests/sessions/lot-c.md` et la fiche d'écran `docs/tests/interfaces/33-exports-d-administration.md`.
3. Rejouer les mutants : `python scripts/mutants/lotc-exports.py` (environ 25 minutes ; `DRY=1` vérifie seulement les motifs ; **jamais deux exécutions à la fois**).
