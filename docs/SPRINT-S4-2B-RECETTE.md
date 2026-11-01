# S4.2b — décharges signées des offres : recette

*Branche `sprint/s4-2b-decharges` · 2026-11-02 · cas d'usage CU-C-21 ; flux C2 ; DDR-0018 ; décision D33. Deuxième des trois lots de S4.2 : offres (S4.2a, validé), décharges (ce lot), relances (S4.2c).*

## Ce qui est livré
| Demande | Réponse |
|---|---|
| **Décharge signée** | Action « Décharge signée » dans le menu d'une offre (fiche entreprise et page « Offres »), qui ouvre une fenêtre : enregistrer, consulter, annuler |
| **Enregistrement** | Date de réception, personne qui a remis la décharge, **fichier signé obligatoire** (contrôlé par son contenu comme tout document) ; seulement pour une offre **déposée** |
| **Une seule décharge valide par offre** | Garantie par le serveur ET par la base (deux enregistrements simultanés : un succès, un conflit) |
| **Effet sur l'offre** | L'enregistrement la fait passer à « Décharge reçue » ; l'annulation la ramène à « Déposée » ; impossible une fois que le client a répondu |
| **Annulation** | Motif obligatoire ; la décharge annulée reste dans l'historique ; une nouvelle décharge peut être enregistrée |
| **Fichiers** | Le fichier signé est un document de la décharge ; l'offre peut aussi recevoir des documents (action « Documents de l'offre », D72 soldée) ; jamais plus accessibles que l'offre |
| **Droits et audit** | Chargé de compte (Propre), Responsable commercial (Équipe), Direction en lecture ; l'enregistrement et l'annulation sont tracés **avec** le changement d'état de l'offre, dans la même transaction |

## Preuves
| Contrôle | Résultat |
|---|---|
| Types (`tsc`), architecture (`pnpm arch`) | 0 erreur · aucune violation (191 modules) |
| Tests unitaires de l'API | **626 / 626** (1 ignoré, antérieur) ; 44 nouveaux (décharge : 18 ; cas d'usage : 22 ; propriétaires de documents : 3 ; transition de l'offre : 1) |
| **Tests d'intégration (PostgreSQL jetable)** | **251 / 251** (18 suites) ; 13 nouveaux (9 de bout en bout et 4 sondes IDOR) : cycle complet avec fichier, unicité y compris en course, refus (brouillon, date, offre acceptée), portée et droits, fichiers inaccessibles à un collègue, règles de la base, verrou optimiste au niveau de la base, entreprise archivée, audit |
| **IDOR** | Les quatre routes de décharge sont classées « objet » et sondées : même réponse pour la décharge d'un collègue et pour un identifiant inexistant, aucune écriture, aucune fuite ; la décharge de Marie reste valide et l'offre en attente n'a reçu aucune décharge piège |
| Règles garanties par la base | Une seule décharge valide par offre, annulation cohérente (motif et date ensemble), version positive : chacune vérifiée par une écriture directe refusée |
| Tests de l'interface | **281 / 281** (22 nouveaux) : saisie, corps de la requête, actions selon l'état et les droits ; **cohérence avec le domaine réel du serveur** sur 13 saisies |
| **Mutants** | **12 / 12 tués** (date future, date antérieure au dépôt, offre en brouillon acceptée, offre non passée à « décharge reçue », seconde décharge non signalée, offre non ramenée à « déposée », annulation sous le droit de lecture, portée des fichiers, unicité et cohérence de la base, verrou optimiste, historique masqué) |
| **Navigateur réel (Edge + axe-core)** | Parcours complet **143 contrôles, 0 échec, 0 avertissement** (dont tous ceux des décharges : champs refusés, enregistrement avec fichier, annulation avec motif, historique) ; résultats `docs/accessibilite/resultats/axe-2026-11-02-s42b.json`, captures `docs/accessibilite/s42b-captures/` (voir les réserves) |

## Défauts trouvés par la recette et corrigés
- **Fenêtre de décharge fermée aussitôt après l'enregistrement** (l'audit l'a révélé) : l'utilisateur ne voyait ni la confirmation ni l'éventuel échec d'envoi du fichier. La fenêtre reste maintenant ouverte et affiche le résultat.
- **Menu d'actions d'une ligne** (offres, et contacts depuis S4.1a) : les actions n'avaient pas le style des menus et ne fermaient pas le menu après le clic ; elles utilisent maintenant le composant commun.
- **Mutants mal mesurés au premier passage** : trois « survivants » venaient d'un test qui ne compilait pas et d'un neutralisateur de condition que TypeScript refusait ; relus après correction, ils sont tués.

## Réserves sur la recette
- **Le navigateur sans fenêtre de la machine reste instable** (captures d'écran et chargements qui n'aboutissent pas, sans lien avec le code). Trois exécutions sont à retenir : une exécution **complète sans aucun échec** (143 contrôles) ; une exécution après la correction du menu, qui a **réussi tous les contrôles des offres et des décharges** puis s'est arrêtée sur un contrôle de tri du lot précédent (S4.1b) ; une exécution limitée aux offres et aux décharges, **68 contrôles réussis, aucun échec**. Aucune exécution complète n'a été refaite après la correction du menu, et plusieurs captures n'ont pas pu être produites : la capture « décharge enregistrée » n'est pas archivée, car celle de l'exécution complète montrait encore l'ancien menu non fermé.
- **Le fichier est exigé par l'interface, pas par le serveur** (D76) : la décharge puis son fichier sont deux appels ; si le second échoue, la décharge existe sans fichier, l'interface le signale et propose de l'ajouter.
- Pas de passage au lecteur d'écran réel ; testé sous Node 26.7, pas rejoué sous Node 22.
- Le prototype et le wireframe 14 ne sont pas à jour (D49).

## Dette et à confirmer
- **D76 à D79** (`docs/TECH-DEBT.md`) ; **D70** (« décharge reçue » atteignable) et **D72** (fichier de l'offre) avancées ou soldées.
- **D33 — à confirmer** : fichier obligatoire ; annulation ouverte au chargé de compte (ou réservée au Responsable commercial par un droit dédié, D77).

## À valider
1. Les écrans (menu d'une offre, fenêtre de décharge, documents de l'offre) et les valeurs par défaut de D33.
2. « Je valide S4.2b » → fusion avec commit de fusion et étiquette `s4-2b-validated`.
