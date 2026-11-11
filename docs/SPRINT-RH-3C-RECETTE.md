# RH-3c — écrans des contrats et des parcours, données de démonstration : recette

*Branche `feat/rh-3c-ecrans` · 2026-11-12 · décisions D67 et D68 ([ADR-0013](adr/0013-contrats-du-personnel-sans-donnees-sensibles.md), [ADR-0014](adr/0014-parcours-d-integration-et-de-depart.md)).*

Troisième tranche de RH-3 (après 3a et 3b, l'API). Reste **3d** : recette complète, mutants, Newman, fiches de test.

## Ce qui est livré
| Écran | Pour qui | Contenu |
|---|---|---|
| **Contrats** (`/hr/contracts`) | RH et Super administrateur : tout voir et gérer ; Direction : tout lire ; employé : « Mon contrat » (le sien) ; responsables et collègues : rien | Liste filtrable (en cours, terminés) : employé, type, début, fin, fin d'essai, état, motif de fin ; **Nouveau contrat** ; menu de ligne **Ajuster** (prolonger la fin, déplacer l'essai) et **Mettre fin** (date et **motif choisi dans une liste**) ; section **Types de contrat** (créer, modifier, désactiver) |
| **Contrats à échéance** (`/hr/contracts/deadlines`) | RH et Super administrateur seulement | Fins de contrat et fins d'essai à venir (30, 60, 90, 180 ou 365 jours), jours restants en pastille (rouge dans la semaine, orange dans le mois) ; aucun courriel |
| **Parcours** (`/hr/journeys`) | RH et Super administrateur : tout ; Direction : lecture ; employé : « Mes parcours » | Liste (état, nature), avancement, retards ; **Lancer un parcours** (employé, nature, date de référence facultative) |
| **Un parcours** (`/hr/journeys/:id`) | idem | Tâches avec responsable, échéance, **case à cocher** (la RH coche et décoche), date et auteur de chaque coche, pastille « En retard », barre d'avancement, **Annuler le parcours** |
| **Modèles de parcours** (`/hr/journeys/templates`) | RH et Super administrateur : modifier ; Direction : lire | Un modèle par nature ; titre, responsable, échéance (avec phrase en clair : « 3 jours avant l'entrée »), **monter, descendre, retirer, ajouter** une tâche, 30 au plus |
| **Menu** | selon les droits | Quatre entrées dans « Ressources humaines » : Contrats, Contrats à échéance, Parcours, Modèles de parcours |
| **Données de démonstration** | `--demo` | Bloc **contrats** (12 contrats dont deux terminés, un CDI après un CDD, quatre échéances proches) et bloc **parcours** (une intégration en cours avec un retard, une terminée, un départ) ; chargés **par les cas d'usage**, chacun seul sur une démo existante |

Aucun salaire, aucun document, aucune zone de texte libre dans ces écrans (testé).

## Preuves
| Contrôle | Résultat |
|---|---|
| Types | `tsc` propre (API et interface) |
| Tests de l'interface | **813 réussis** (30 nouveaux dans `rh-3c.test` : règles de saisie identiques à celles du serveur, actions par état et droit, réordonnancement, menu par profil, aucun champ de rémunération ni de texte libre) |
| Tests du plan de démonstration | **41 réussis** (nouveaux : un seul contrat en cours par employé, pas de chevauchement, essai dans le contrat, aucun contrat avant l'entrée, au moins trois échéances dans les 30 jours, coches après le lancement) |
| Intégration (base jetable) | `seed-demo` : **10 réussis**, dont 12 contrats (2 terminés pour fin de CDD, 10 en cours), 3 parcours (1 terminé), 9 tâches cochées avec date et auteur ; blocs rechargés seuls |
| Contrôle visuel (navigateur, pile jetable avec démonstration, compte Super administrateur) | **Contrats** : 10 contrats en cours, filtres, « Nouveau contrat » (second contrat en cours refusé avec le message du serveur) ; **échéances** : 4 lignes avec pastilles rouge et orange ; **parcours** : liste, parcours avec trois tâches cochées (date et auteur), une tâche « En retard », cochage d'une tâche (avancement 67 %, retard levé) ; **modèles** : cinq tâches de départ avec phrase d'échéance en clair. Pile **supprimée** ensuite |

## Limites connues
- **Pas d'écran dans la fiche d'un employé** : les contrats et parcours d'un employé se retrouvent depuis leurs listes, pas depuis sa fiche.
- **Seule la RH coche** (dette D182) : l'employé voit ses tâches mais ne les coche pas.
- **Mutants et Newman** : prévus en **3d**.
- **Non vérifié** : mode sombre, 1280 px, clavier, lecteur d'écran.
