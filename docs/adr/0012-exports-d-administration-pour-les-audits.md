# ADR-0012 — Exports d'administration pour les audits

| | |
|---|---|
| **Statut** | Accepté (2026-11-11, décision D66 de la Direction produit : « Super administrateur uniquement », puis « applique les recommandations » pour le fichier d'audit). |
| **Contexte** | Un audit demande la liste des comptes, des droits et des sessions. Ces données sont sensibles (identités, adresses IP, appareils, matrice des droits) : un export mal protégé est un risque en lui-même. |
| **Lié à** | SECURITY.md (MFA, step-up, audit), ADR-0009 (même principe de trace avant remise que les exports de fiches) |

## Options considérées
1. **Statu quo** : consulter les écrans d'administration. Impossible à archiver, à filtrer ou à remettre à un auditeur.
2. **Export ouvert à plusieurs rôles** (Direction, Support…) : plus pratique, mais élargit l'accès à des données de sécurité. Écartée par la Direction produit.
3. **Export réservé au Super administrateur, protégé et tracé (retenue).**

## Décision
- **Trois exports** `GET /admin/exports/{users|rights|sessions}` en **CSV** (UTF-8 avec marque d'ordre des octets, séparateur « ; », CRLF).
- **Autorisation** : nouvelle permission `iam.export.read`, **portée Tous**, détenue par le **seul Super administrateur** ; **second facteur récent exigé** (step-up) ; le cas d'usage revérifie la portée sans se fier au seul contrôleur.
- **Trace avant remise** : chaque export écrit une ligne d'audit (auteur, session, adresse, nature, nombre de lignes, nom du fichier, période) **avant** de répondre ; si l'écriture échoue, **rien n'est remis**. La trace ne recopie jamais le contenu.
- **Aucun secret par construction** : le lecteur de données **sélectionne ses colonnes une à une** ; hachage du mot de passe, secret du second facteur, dernier pas TOTP, compteur d'échecs, codes de secours et jetons ne sont **jamais lus**. Le cas d'usage n'écrit que des colonnes nommées : un champ ajouté par erreur au lecteur ne fuit pas.
- **Injection de formule** : un texte qui commence par `=`, `+`, `-`, `@`, tabulation ou retour chariot reçoit une apostrophe en tête.
- **Volume** : au-delà de 10 000 utilisateurs ou 50 000 sessions, l'export est **refusé** (réduire la période) plutôt que tronqué ; sessions sur 1 à 365 jours (90 par défaut).
- Réponse jamais mise en cache (`no-store`, `nosniff`, `default-src 'none'`), téléchargement forcé (`attachment`).

## Conséquences
- (+) Un audit se prépare sans accès à la base, avec une trace de chaque remise de données.
- (+) La fuite d'un secret par ce canal est impossible sans modifier le lecteur ET le cas d'usage ; des tests le vérifient (hachage et secret de base absents du fichier).
- (−) **Dette D177** : le fichier de sessions contient des **données personnelles** (adresses IP, appareils) ; la durée de conservation du fichier et la base légale restent à fixer (avis juridique, comme D65 sur les contacts) ; le fichier une fois téléchargé échappe au contrôle de la plateforme.
- (−) **Dette D178** : CSV seulement (pas de PDF ni de signature d'intégrité du fichier), pas d'export des tentatives de connexion échouées ni du journal d'audit.
- À revoir si : un autre rôle doit exporter (créer une permission distincte, jamais élargir celle-ci), ou si le volume dépasse les limites (export différé).
