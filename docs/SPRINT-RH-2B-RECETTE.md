# RH-2b — absences et congés (écrans et démonstration) : recette

*Branche `sprint/rh-2b-ecrans` · 2026-11-11 · décision D64, cadrage [CADRAGE-RH-COMPLETE](cadrages/CADRAGE-RH-COMPLETE.md), suite de [RH-2a](SPRINT-RH-2A-RECETTE.md) · **Toutes les règles de congés restent des valeurs de départ « à confirmer »**, modifiables par la RH depuis l'écran « Paramètres RH ».*

## Ce qui est livré
| Écran | Pour qui | Ce qu'on y fait |
|---|---|---|
| **Mes absences** (`/hr/leave`) | Tout employé | Voir son solde de l'année (disponible, acquis, ajustements, pris, en attente), **demander une absence** (type, dates, demi-journées, motif libre facultatif), suivre l'historique et **annuler** une demande ; un compte sans fiche employé le voit dit en clair |
| **À valider** (`/hr/leave/approvals`) | Les responsables (organigramme RH) ; la RH et la Direction voient aussi « Toutes les demandes » | **Valider** ou **refuser** (refus : motif obligatoire) ; jamais sa propre demande |
| **Calendrier d'équipe** (`/hr/leave/calendar`) | Tout employé | Mois par mois : une ligne par personne absente, une colonne par jour ; week-ends et jours fériés grisés ; journée entière, matinée seule ou après-midi seul dits **par un symbole et par du texte** (jamais la couleur seule) ; un collègue voit seulement « absent » |
| **Soldes** (`/hr/leave/balances`) | RH (portée Tous) | Le solde de chaque employé en poste, par année ; **ajuster** un solde (report, correction) avec motif obligatoire ; historique des ajustements de l'année |
| **Paramètres RH** (`/hr/leave/settings`) | RH (portée Tous) | Jours acquis par mois (avec le total annuel pour vérifier le règlement), samedi compté ou non, demi-journées, solde négatif ; **types d'absence** (créer, modifier, désactiver) ; **jours fériés** par année |

- **Menu** : cinq entrées dans le domaine « Ressources humaines », visibles selon les droits (un employé ordinaire voit Mes absences, Absences à valider et le Calendrier ; la RH voit aussi les Soldes et les Paramètres). Une barre d'onglets relie les écrans.
- **Jeu de démonstration** (bloc « conges », fictif, sans aucune donnée de santé) : sept demandes sur le personnel fictif : deux saisies par la RH et validées d'emblée (dont une dans le passé), trois **en attente** (dont une demi-journée, et une que seule la RH peut valider), une **validée** par le responsable, une **refusée** avec son motif. Se charge seul sur une démo qui a déjà le personnel ; aucun jour férié n'est présumé.

## Défaut corrigé au passage (RH-2a)
Le **solde décomptait tous les types d'absence**, alors que seul le congé annuel doit le consommer : une maladie de deux jours ou une permission d'une demi-journée réduisait le solde. Constaté en contrôlant l'écran « Soldes » sur le jeu de démonstration (6 jours « pris » pour 4 jours de congé annuel validés). Corrigé : `sumDays` ne somme que les types qui décomptent le solde (`deductsBalance`) ; un test reproduit le défaut (il échoue sans la correction). Les mutants de RH-2a (126 sur 126) ne couvraient pas ce cas ; la recette de RH-2a annonçait déjà la règle.

## Preuves
| Contrôle | Résultat |
|---|---|
| Types | `tsc` propre (API et interface) |
| Tests de l'interface | **722 réussis** (38 fichiers) ; nouveau `test/leave.test.ts` : dates et durées, demi-journées, calendrier, validation de la demande, de l'ajustement, des règles, des types et des jours fériés, entrées de menu par profil |
| Tests unitaires de l'API | Suite HR : **164 réussis** (dont le nouveau test du solde) ; plan de démonstration : **40 réussis**, 5 nouveaux pour le bloc « conges » (fiches et types existants, jours ouvrés, saisie par la RH seule pour un autre, décisions par le responsable de la fiche, une demande refusée, une demi-journée, aucun mot de santé) |
| Intégration (base jetable) | Suites congés, personnel, contrat anti-IDOR et démonstration : **305 réussis, 11 suites** ; la suite `seed-demo` gagne un test du bloc « conges » (sept demandes, soldes cohérents, rechargement seul) |
| Contrôle visuel (pile d'essai jetable, compte RH) | Les cinq écrans s'affichent ; refus sans motif bloqué par le formulaire ; demande ouverte avec le choix de l'employé (RH) ; calendrier et soldes cohérents avec le jeu de démonstration |
| Droits vérifiés par l'API sur le jeu de démonstration | Un chargé de compte voit son solde (18 − 5 en attente = 13) et, dans le calendrier, « absent » **sans le type** ; le responsable commercial voit le type et ses 2 demandes à valider ; la RH voit tout |

## Limites connues
- **Soldes** : une requête de solde par employé de la page (20 au plus) : l'API n'a pas de route groupée (D174).
- **Calendrier** : un mois à la fois ; un week-end ou un jour férié au milieu d'une absence reste grisé sans marque. Les absences ne s'affichent qu'une fois **validées**.
- **Mode clair seulement** vérifié ; mode sombre, 1280 et 1920 px, et le parcours au clavier restent à contrôler (comme le Lot A).
- Les écrans ne tournent que si le domaine `hr` est publié (`RELEASED_DOMAINS`), comme le reste des Ressources humaines.
- Restent d'actualité les dettes de RH-2a : D167 à D172 (année à cheval, fuseau, aucune notification, pas de suppléant, employé sans compte, règles réelles à fournir).
- **RH-2c** (à votre signal) : tests d'intégration de l'interface, mutants de l'interface, fiches de test.

## Comment vérifier
1. Démarrer la pile locale avec démonstration (`node scripts/local-stack.mjs --demo`) : sur une démonstration déjà chargée, **seul le nouveau bloc « conges » est ajouté**, rien d'autre n'est touché. Se connecter en RH : ouvrir **Ressources humaines → Absences à valider** (« Toutes les demandes », trois en attente) et **Calendrier d'équipe**.
2. Se connecter avec un compte de chargé de compte : **Mes absences** montre le solde et une demande en attente ; le calendrier montre « absent » sans le type.
3. Se connecter en responsable commercial : **Absences à valider** montre deux demandes ; essayer un refus sans motif (bloqué), puis une validation.
4. En RH : **Soldes → Ajuster le solde**, puis **Paramètres des congés** (règles, types, jours fériés).
