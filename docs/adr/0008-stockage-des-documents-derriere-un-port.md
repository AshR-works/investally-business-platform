# ADR-0008 — Stockage des documents : port `ObjectStorage`, adaptateur disque maintenant, adaptateur S3 en S7.1

| | |
|---|---|
| **Statut** | Accepté (2026-10-21, décision CAD-S36-1 option B de la direction produit) |
| **Contexte** | S3.6 livre les documents (pièces jointes). `ARCHITECTURE.md` prévoit un stockage objet compatible S3, hors base. Aucun service de stockage n'existe ; Docker n'est exécuté « pour de vrai » qu'en S7. |
| **Lié à** | `docs/cadrages/CADRAGE-S3-6-DOCUMENTS.md`, `docs/SECURITY.md` §6.1 |

## Options considérées
1. **S3 (MinIO) dès S3.6** : conforme à l'architecture, mais un service de plus pour les tests et le développement.
2. **Fichiers dans PostgreSQL (`bytea`)** : simple, mais contredit l'architecture (documents hors base, ≈ 2 Go/an) et alourdit sauvegardes et base.
3. **Port + adaptateur disque maintenant, adaptateur S3 en S7.1 (retenue)** : tests rapides sans service externe, aucune perte de conception.

## Décision
- Les contenus passent par le port `ObjectStorage` (`put`, `get`, `removeOrphan`) ; le domaine et les cas d'usage ne connaissent aucun fichier ni chemin.
- Adaptateur actuel : `LocalDiskObjectStorage`, dossier `DOCUMENTS_DIR` **hors racine web** (absolu et obligatoire en production), dossiers 0700, fichiers 0600, écriture atomique, clé contrôlée à chaque appel (forme `xx/yy/` + 48 caractères hexadécimaux : aucune sortie du dossier possible).
- Le **port n'a aucune méthode de suppression publique** : un fichier ne disparaît jamais (la suppression est logique, statut `ARCHIVED`). Seul `removeOrphan` retire l'objet qu'un envoi vient d'écrire quand l'enregistrement en base échoue.
- Clé de stockage **aléatoire** (jamais le nom fourni) ; contenu vérifié par **SHA-256** à chaque téléchargement ; versions **immuables** (déclencheurs SQL qui refusent la modification du contenu et toute suppression).

## Conséquences
- **Dette D41** : l'adaptateur disque ne convient pas à une exploitation sur plusieurs serveurs ; l'adaptateur S3 (versionné, chiffré) est à livrer et recetter en **S7.1**, avec le même test de contrat.
- **Sauvegarde** : le dossier des documents doit être sauvegardé avec la base (à inscrire au plan de sauvegarde S7.1).
- Réversible : un seul adaptateur à remplacer, les clés restent valables si le contenu est copié tel quel.
