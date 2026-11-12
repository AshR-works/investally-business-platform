# Fiche de test — Présences

| | |
|---|---|
| **Route** | `/hr/presences` |
| **Livrée par** | RH-4b (API : RH-4a ; recette et mutants : RH-4c) |
| **Accès** | Lecture : utilisateur qui détient `hr.presence.read` (tous les rôles ; en portée Tous pour la RH, la Direction et le Super administrateur ; sinon sa ligne et celles de ses subordonnés directs). Menu Ressources humaines › Présences. |
| **Droits** | **Déclarer** : `hr.presence.declare` en portée Propre (chacun pour soi) ou Tous (RH, Super administrateur : pour n'importe qui). |
| **Rôles de test** | rh, sa, dir, cc, resp (responsable direct), sans (compte sans fiche employé) |

*Fiche d'interface de la [charte de tests](../../CHARTE-DE-TESTS.md). À rejouer à chaque changement de l'écran. Cocher, dater, signer ; tout écart devient un défaut.*

## Préconditions
Pile locale avec le jeu de démonstration : dix personnes, une semaine et demie de présences (sur site, télétravail, déplacement), un congé validé pour l'agente de support. Valeurs de départ « à confirmer » : fenêtres de saisie 7 et 30 jours (RH : 90 et 90), trois modes, aucune validation par le responsable. **Aucune heure, aucun lieu n'est enregistré.**

## Scénarios
| N° | Scénario | Étapes | Résultat attendu | Constaté (✔ / ✘) | Date et initiales |
|---|---|---|---|---|---|
| 1 | **Lecture (RH)** | Se connecter en RH ; ouvrir Présences. | Tableau de la semaine en cours : une ligne par personne, une colonne par jour ; mode dit par un symbole ET un texte ; jour d'absence validée marqué ✕ ; total du jour ; week-end grisé | ☐ | |
| 2 | **Naviguer** | Semaine précédente, suivante, « Cette semaine » ; filtre par service. | Le titre « Semaine du … au … » change et est annoncé ; le filtre ne garde que le service choisi | ☐ | |
| 3 | **Déclarer pour soi** | Se connecter en chargé de compte ; cliquer sa propre case d'aujourd'hui ; choisir « Télétravail » ; « Enregistrer ». | La fenêtre dit « Où travaillez-vous ce jour-là ? » ; la case passe à ⌂ ; le total du jour suit | ☐ | |
| 4 | **Changer, retirer** | Rouvrir la case ; changer de mode ; puis « Retirer la déclaration ». | Le mode change ; après le retrait la case redevient « + » (non déclaré) ; l'audit garde l'avant et l'après | ☐ | |
| 5 | **Aucun choix** | Ouvrir une case vide ; « Enregistrer » sans choisir. | « Choisissez une des trois possibilités. » ; le groupe de choix est relié à l'erreur ; rien n'est enregistré | ☐ | |
| 6 | **Fenêtre de saisie** | Employé : naviguer 2 semaines en arrière, puis 6 semaines en avant. | Les cases hors de 7 jours en arrière et 30 jours en avant ne sont pas modifiables | ☐ | |
| 7 | **La RH pour un autre** | En RH, cliquer la case d'un autre employé ; choisir un mode. | La fenêtre dit « Où travaille <nom> ce jour-là ? » ; la saisie est marquée « par un autre » côté API | ☐ | |
| 8 | **Absence validée** | Regarder la ligne de l'agente de support sur son congé. | Cases ✕ « absent (absence validée) », non modifiables ; un week-end au milieu du congé reste neutre et n'est pas compté absent | ☐ | |
| 9 | **Responsable** | Se connecter en Responsable commercial. | Sa ligne et celles de ses collaborateurs directs ; seule sa ligne est modifiable ; pas de filtre par service | ☐ | |
| 10 | **Collègue** | Se connecter en chargé de compte d'un autre responsable. | Sa seule ligne ; aucune ligne de collègue | ☐ | |
| 11 | **Direction** | Se connecter en Direction. | Tout le personnel en lecture ; seule sa propre ligne est modifiable (s'il en a une) | ☐ | |
| 12 | **Compte sans fiche** | Se connecter avec un compte sans fiche employé. | Message « Demandez à la RH de la relier » ; aucune case modifiable | ☐ | |
| 13 | **Erreur de chargement** | Couper l'API ; recharger l'écran. | Message d'erreur annoncé ; aucune donnée obsolète affichée | ☐ | |

## Accessibilité
- ☐ Clavier seul : navigation de semaine, filtre, chaque case modifiable, boutons de la fenêtre atteignables ; focus visible ; Échap ferme la fenêtre et le focus revient à la case.
- ☐ Lecteur d'écran : chaque case dit le nom, le jour et le mode (ou « non déclaré », « absent (absence validée) ») ; le titre de semaine est annoncé au changement ; le groupe de choix est nommé.
- ☐ Aucune information portée par la couleur ou le symbole seul ; contraste suffisant des symboles sur fond de mode et fond de week-end.
- ☐ Mode sombre et affichage étroit : tableau défilant horizontalement avec la colonne des noms fixe.
