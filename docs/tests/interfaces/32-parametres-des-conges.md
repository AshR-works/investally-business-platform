# Fiche de test — Paramètres des congés

| | |
|---|---|
| **Route** | `/hr/leave/settings` |
| **Livrée par** | RH-2b (recette et mutants : RH-2c) |
| **Accès** | Utilisateur qui détient `hr.leave.manage` **en portée Tous** (RH, Super administrateur) : menu Ressources humaines › Paramètres des congés. |
| **Droits** | **Modifier les règles, les types d'absence et les jours fériés** : RH et Super administrateur seulement ; chaque changement est audité. Les valeurs de départ sont « à confirmer » (D64). |
| **Rôles de test** | rh, sa, cc |

*Fiche d'interface de la [charte de tests](../../CHARTE-DE-TESTS.md). À rejouer à chaque changement de l'écran. Cocher, dater, signer ; tout écart devient un défaut.*

## Préconditions
Pile locale réinitialisée : règles de départ (1,5 jour par mois, lundi au vendredi, demi-journées permises, solde négatif interdit), cinq types d'absence, aucun jour férié.

## Scénarios
| N° | Scénario | Étapes | Résultat attendu | Constaté (✔ / ✘) | Date et initiales |
|---|---|---|---|---|---|
| 1 | **Règles de départ** | Ouvrir la page. | 1,5 jour par mois, « Soit 18 jours par an » ; demi-journées cochées ; samedi et solde négatif décochés. | ☐ | |
| 2 | **Modifier les règles** | Passer à 2,5 jours par mois ; enregistrer. | Message « Les règles sont enregistrées » ; le total annuel passe à 30 jours ; les soldes de l'écran « Soldes » changent en conséquence. | ☐ | |
| 3 | **Règles refusées** | Saisir 6, puis -1, puis 1,505, puis vide. | Chaque cas est refusé avec son message (de 0 à 5, deux décimales, nombre obligatoire) ; rien n'est enregistré. | ☐ | |
| 4 | **Conflit de version** | Ouvrir la page dans deux onglets ; enregistrer dans les deux. | Le second reçoit « Les règles de congés ont été modifiées… ». | ☐ | |
| 5 | **Samedi et demi-journées** | Cocher « Le samedi compte » ; décocher les demi-journées ; faire une demande. | Le samedi est décompté ; les cases de demi-journée disparaissent du formulaire de demande. | ☐ | |
| 6 | **Nouveau type** | « Nouveau type » ; code en minuscules, puis valide (par exemple ÉTUDE → STUDY), libellé, plafond 2. | Code refusé s'il n'est pas en majuscules, chiffres et tiret bas (30 au plus) ; un type valide apparaît dans la liste et dans les demandes ; un code déjà pris est refusé. | ☐ | |
| 7 | **Plafond** | Fixer 3 jours à un type ; demander 4 jours. | La demande est refusée par le serveur (« limité à 3 jour(s) par demande »). | ☐ | |
| 8 | **Désactiver un type** | Menu de ligne › Modifier ; décocher « Actif ». | Le type reste dans la liste (« Désactivé ») mais n'est plus proposé dans les demandes ; les demandes passées le gardent. | ☐ | |
| 9 | **Jour férié** | « Ajouter » ; une date et un libellé ; puis « Retirer ». | Le jour apparaît avec son jour de semaine ; il n'est plus décompté dans les demandes ni compté dans le calendrier ; deux jours fériés à la même date sont refusés ; le retrait fonctionne. | ☐ | |
| 10 | **Droit insuffisant** | Avec `compte1`, ouvrir l'adresse de la page. | Message « Les règles des absences et congés sont réservées à la RH » ; l'entrée n'est pas dans le menu. | ☐ | |

## Accessibilité
- ☐ Clavier seul : Tab et Maj+Tab parcourent tous les contrôles dans un ordre logique ; le focus est toujours visible ; aucun piège de focus hors fenêtre modale.
- ☐ Un seul titre de niveau 1 ; pas de saut de niveau (h2 avant h3).
- ☐ Chaque champ a un libellé relié ; un champ non conforme est en surbrillance **et** accompagné d'un message écrit relié (`aria-describedby`), jamais la couleur seule.
- ☐ Les messages d'état et d'erreur sont annoncés (`role=alert` ou `role=status`).
- ☐ Fenêtres modales : le focus entre dans la fenêtre, Échap la ferme, le focus revient à l'élément d'origine, l'arrière-plan est inerte.
- ☐ Lisible à 200 % de zoom et à 375 px de large, sans défilement horizontal de la page (le calendrier défile dans son cadre).
- ☐ La barre d'onglets « Absences et congés » annonce l'écran courant (`aria-current=page`).
- ☐ Aucune information n'est portée par la couleur seule : l'état d'une demande est écrit, une demi-journée est dite par un symbole **et** par du texte.

## Tests automatisés qui couvrent cet écran
- API : `hr-leave-http.integration` (paramétrage, 24 règles de la base, verrou optimiste), `leave-use-cases.spec` (types, règles, jours fériés, audit) ; Web : `leave.test` (règles, types, jours fériés), mutants de RH-2c

## Limites connues
- Aucun jour férié n'est présumé : la liste est à la charge de la RH (D172).
- Un type ne se supprime pas : il se désactive.

## Écarts constatés
| Date | Scénario | Description | Défaut ouvert (D…) |
|---|---|---|---|
| | | | |
