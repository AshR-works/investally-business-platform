# S4.3b — statuts d'entreprise, responsable, fiche 360° : recette

*Branche `sprint/s4-3b-statuts-fiche-360` (partie de `main`, après S4.3a) · 2026-11-06 · cas d'usage CU-C-05 et CU-C-08 ; flux C5 ; DDR-0022 ; décisions D17 et D37. Deuxième moitié de la session S4.3 ; la colonne « Valeur » et le lien rendez-vous ↔ opportunité (D93) sont reportés à S4.3c (D104).*

## Ce qui est livré
| Demande | Réponse |
|---|---|
| **Statut à la main** | Sur la fiche, à côté du statut : « Marquer comme contactée », « Qualifier l'entreprise », « Revenir à… » ; **un cran à la fois**, avec retour ; confirmation avant enregistrement |
| **Critère « Qualifiée »** | Au moins **un contact** (non supprimé) ; sinon refus clair (422) |
| **Statuts réservés** | « Cliente » (agrément, S4.4) et « Archivée » (archivage) ne se posent **jamais** à la main ; refusés dès la validation de la requête (400) |
| **Changer de responsable (D17)** | Bouton « Changer de responsable » : liste des personnes **actives au rôle commercial dans votre périmètre** (nom seulement, jamais d'e-mail), **case de confirmation** obligatoire ; droit dédié `bd.company.reassign` (Responsable commercial, Équipe ; administrateur) |
| **Ce qui suit** | La portée de visibilité suit l'entreprise : l'ancien responsable la perd aussitôt (introuvable), le nouveau la gagne, avec ses opportunités |
| **Responsable visible** | Nommé sur la fiche ; **colonne « Responsable »** du tableau des entreprises, visible par défaut |
| **Fiche 360°** | Panneaux **Opportunités** (étape, montant, état, dérogation) et **Rendez-vous** (60 derniers et 60 prochains jours) en lecture ; les actions restent dans les modules |
| **Audit** | Changement de statut et de responsable tracés (ancienne et nouvelle valeur, session) |

## Preuves
| Contrôle | Résultat |
|---|---|
| Types (`tsc`, API et web), architecture (`pnpm arch`) | 0 erreur · aucune violation (217 modules) |
| Tests unitaires de l'API | **797 réussis**, 0 échec (les suites d'intégration, qui exigent la base, sont ignorées dans cette passe) ; 17 nouveaux (domaine : 8 ; cas d'usage : 9) |
| **Tests d'intégration (PostgreSQL jetable)** | **319 / 319** (22 suites) ; 11 nouveaux de bout en bout : cycle de statut, refus (saut, même statut, « Cliente », version périmée, champ inconnu), nom du responsable, portée et droits, réattribution et effet sur la visibilité, refus de réattribution, liste des destinataires (équipe seulement, sans e-mail, comptes désactivés et rôles sans portefeuille écartés), contact supprimé non compté, entreprise archivée, audit |
| **IDOR** | Les deux routes `POST /companies/:id/status` et `/owner` sont classées « objet » et sondées : même réponse pour l'entreprise d'un collègue et pour un identifiant inexistant, aucune écriture |
| Tests de l'interface | **400 / 400** (10 nouveaux) : actions de statut proposées, **transitions comparées au domaine réel du serveur**, destinataires, colonne « Responsable » |
| **Mutants** | **21 / 21 tués** (qualifiée sans contact, étape sautée, même statut, « Cliente » à la main, retour impossible, même propriétaire, propriétaire vide, droit de réattribution, destinataires hors portée, verrou optimiste, contacts non comptés, destinataire non contrôlé, nom du responsable, ancien statut non tracé, droits des deux routes, statuts acceptés par la route, comptes désactivés, rôles sans portefeuille, nom en liste, contacts supprimés) |
| **Navigateur réel (Edge + axe-core)** | **Parcours ciblé** (connexion, création d'une entreprise, puis le bloc de ce lot) : **38 contrôles réussis, aucun échec** ; fiche 360° (**0 violation**, 60 éléments annoncés), fenêtre de changement de statut, fenêtre de changement de responsable ; colonne « Responsable » et nom du responsable vérifiés. Le seul ✘ est l'arrêt volontaire de fin de parcours. Un parcours plus long (jusqu'aux opportunités) a, lors d'un essai, validé aussi la colonne et la fiche (107 contrôles). Résultats `docs/accessibilite/resultats/axe-2026-11-06-s43b.json`, captures `docs/accessibilite/s43b-captures/` |

## Défauts trouvés par la recette et corrigés
- **Audit : processus orphelins** (outil, pas l'application) : à chaque exécution, le script laissait des processus du navigateur (jusqu'à 184, 0,9 Go de mémoire libre sur 15,8) ; l'arrêt du navigateur ferme maintenant tout son arbre de processus.
- **Audit : parcours trop long pour une seule passe** : le navigateur sans fenêtre décrochait au même endroit (agenda, vue « mois ») ; un mode `AUDIT_COMPANY_ONLY` permet de contrôler ce lot seul.
- Aucun défaut de l'application n'a été trouvé par l'audit sur ce lot.

## Réserves sur la recette
- **Parcours navigateur ciblé** : les écrans des lots antérieurs ne sont pas revérifiés par ce lot. Le parcours complet a décroché six fois sur dix essais, systématiquement dans l'agenda (écran antérieur, hors de ce lot).
- **Deux captures manquantes** : « changement de statut » et « changement de responsable » (le contrôle a réussi, le navigateur n'a pas répondu à la capture) ; la capture de la fiche 360° est fournie.
- **Choix du responsable non exercé dans le navigateur** : l'audit n'avait qu'un seul utilisateur commercial, donc la fenêtre affichait « Personne d'autre n'est disponible » ; le choix, la confirmation et le changement sont couverts par les tests d'intégration et les mutants, pas par le navigateur.
- **Statut « Cliente » jamais posé** tant que l'agrément n'existe pas (D105) ; confirmation par case à cocher, **sans second facteur récent** (D102, D17 le prévoyait) ; pas de notification (D101) ; pas d'historique lisible (D100) ; fiche 360° limitée (D103).
- Pas de passage au lecteur d'écran réel ; testé sous Node 26.7, pas rejoué sous Node 22. Le prototype n'est pas à jour (D49).

## Dette et à confirmer
- **D100 à D105** (`docs/TECH-DEBT.md`) ; D99 soldée, sauf la colonne « Valeur » (D104).
- **D37 — à confirmer** : statut manuel d'un cran avec retour, critère « Qualifiée » (un contact), droit de modification pour le statut, droit dédié et confirmation par case pour le responsable, colonne « Responsable » par défaut.

## À valider
1. Les écrans (fiche avec statut, responsable et panneaux 360°, fenêtres de changement de statut et de responsable, colonne « Responsable ») et les valeurs par défaut de D37.
2. « Je valide S4.3b » → fusion avec commit de fusion et étiquette `s4-3b-validated`.
