# S3.6 — Documents : recette

*Branche `sprint/s3-6-documents` · 2026-10-22 · décisions du cadrage : **CAD-S36-1 B** (port de stockage + disque local, S3 en S7.1, ADR-0008), **CAD-S36-2 A** (contrôles de base maintenant, antivirus en S7 **bloquant pour la mise en production**), **CAD-S36-3 A** (droits hérités de l'objet propriétaire). Valeurs par défaut appliquées faute de réponse (D22, dette D45) : formats **PDF, JPG, PNG, DOCX, XLSX**, taille **10 Mo**, 6 catégories, aucune purge.*

## Ce qui est livré
### API — nouveau module `documents`
| Route | Rôle | Permission |
|---|---|---|
| `POST /documents` | Envoie un nouveau document (version 1) sur un objet propriétaire | `docs.document.create` |
| `POST /documents/:id/versions` | Ajoute une version (les précédentes restent intactes) | `docs.document.create` |
| `GET /documents?ownerType&ownerId` | Liste les documents d'un objet (archivés sur demande) | `docs.document.read` |
| `GET /documents/:id` | Détail et toutes les versions | `docs.document.read` |
| `GET /documents/:id/download?version` | Télécharge (SHA-256 vérifié, audité) | `docs.document.download` |
| `POST /documents/:id/archive` | Archive (suppression **logique**) | `docs.document.delete` |
| `GET /documents/meta` | Règles publiées : taille, extensions, catégories | `docs.document.read` |

Aucune nouvelle permission : celles de `docs.document.*` existaient déjà au catalogue et dans la matrice des rôles.

**Garde-fous** (détail dans `docs/SECURITY.md` §6.1) : format reconnu par la **signature du contenu**, extension cohérente, macros refusées, taille bornée avant réception complète ; nom de fichier assaini et **jamais utilisé comme chemin** (clé de stockage aléatoire) ; **SHA-256** calculé à l'envoi et revérifié à chaque téléchargement ; **versions immuables** (déclencheurs SQL : aucune modification de contenu, aucune suppression) ; archivage seul, rien n'est effacé ; droits = permission **et** accès à l'objet propriétaire, tout refus « introuvable » ; en-têtes de téléchargement durcis (`attachment`, `nosniff`, CSP `sandbox`, `no-store`) ; chaque envoi, version, téléchargement et archivage **audité** ; **aucun antivirus encore** : chaque version est `PENDING` (« non analysé »), signalé partout.

### Interface
- **Première fiche entreprise** `/companies/{id}` (identité + documents ; le nom dans la liste devient un lien). Contacts, offres et rendez-vous : S4.1.
- **Panneau « Documents »** réutilisable : liste, envoi en fenêtre (titre, catégorie, fichier ; contrôle de confort avant envoi), nouvelle version, historique des versions avec empreinte, téléchargement avec le jeton (jamais d'adresse directe), archivage confirmé, avertissement « non analysé ».

## Preuves
| Contrôle | Résultat |
|---|---|
| API, tests unitaires | **434 / 434** (1 ignoré sous Windows : droits de fichiers) — dont 42 nouveaux : politique des fichiers (17), cas d'usage avec droits par portée (19), stockage disque (6) |
| API, tests d'intégration (PostgreSQL jetable + disque) | **160 / 160** — dont 11 nouveaux : cycle complet avec audit et fichiers sur disque, 404 identique pour un étranger à l'équipe, rôles (Direction lecture seule, Support aucun droit), 415 / 413 / 400, aucun fichier laissé par un refus, fichier altéré jamais servi, **déclencheurs d'immutabilité**, ajouts de version simultanés sans doublon de numéro |
| Matrice des droits (rôle × route) | 7 routes ajoutées ; chaque rôle vérifié |
| Architecture | **0 violation** (148 modules) ; le module Documents ne dépend d'aucun module métier (le registre inverse la dépendance) |
| Mutants | **12 / 12 tués** (contrôle d'accès à l'objet, vérification SHA-256, cohérence extension/contenu, macros, archivé qui accepte des versions, clé de stockage non contrôlée, orphelin non retiré, téléchargement non audité, chemin du nom non retiré, droit de suppression ignoré, taille non contrôlée, archivage non idempotent) |
| Interface | **65 / 65** tests ; typage sans erreur |
| Navigateur réel, audit axe-core | **39 états, 0 violation** ; parcours réel : envoi refusé (PNG nommé `.pdf`), envoi accepté, téléchargement, nouvelle version, historique, archivage, **envoi de 10 Mo pile à travers le proxy Next.js**, 10,5 Mo refusé avant l'envoi |
| Politique de contenu (CSP) | 0 violation |

**À vérifier à la main (4)** : axe ne détermine pas le fond du paragraphe des fenêtres de confirmation ni d'un petit bouton de l'historique (« recouvrement partiel »). Contrôle manuel : texte `#1D1D1B` sur fond blanc (≈ 17 : 1), même jeton que partout.

Défaut trouvé et corrigé en recette : la limite du proxy Next.js (10 Mo exactement, enveloppe comprise) aurait pu tronquer un fichier pile à la taille maximale → `proxyClientMaxBodySize` relevé à 12 Mo. Autres retouches : alignement de la case « Afficher les documents archivés », titre pré-rempli qui suit le fichier choisi tant qu'il n'est pas édité.

Captures : `docs/accessibilite/s36-captures/`.

## Dette et réserves
- **D41** stockage sur disque local (adaptateur S3 et sauvegarde du dossier en S7.1) · **D42 aucun antivirus : condition bloquante de la mise en production (S7.2)** · **D43** un seul type d'objet propriétaire déclaré (entreprises) : les autres modules déclarent leur résolveur à leur livraison · **D44** fichier lu en mémoire (≤ 10 Mo) · **D45** durée de conservation et catégories par défaut, à confirmer.
- **Sauvegarde** : le dossier `DOCUMENTS_DIR` doit être sauvegardé avec la base.
- **Production** : `DOCUMENTS_DIR` (chemin absolu hors racine web) est **obligatoire** ; l'application refuse de démarrer sans.
- Aucune vue de recherche plein texte, aucune prévisualisation, aucune signature électronique (hors périmètre).
- L'écoute avec un vrai lecteur d'écran (D31) doit couvrir le panneau Documents (fenêtres, tableau, envoi de fichier).

## À valider
1. Les **valeurs par défaut** (formats, 10 Mo, catégories, pas de purge) : à confirmer ou à modifier (une seule constante à changer, `documents/domain/document-policy.ts`).
2. « Je valide S3.6 » → fusion `--no-ff` dans `main` et étiquette `s3-6-validated`.
