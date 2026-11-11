# Fiche de test — Absences à valider

| | |
|---|---|
| **Route** | `/hr/leave/approvals` |
| **Livrée par** | RH-2b (recette et mutants : RH-2c) |
| **Accès** | Tout utilisateur qui détient `hr.leave.approve` : menu Ressources humaines › Absences à valider. La liste est celle des collaborateurs **directs** de l'organigramme RH ; la RH et la Direction peuvent aussi choisir « Toutes les demandes ». |
| **Droits** | **Valider ou refuser** : le responsable direct de l'employé (organigramme RH, pas la hiérarchie des comptes) ou la RH ; **jamais sa propre demande**. **Voir toutes les demandes** : RH, Direction, Super administrateur. |
| **Rôles de test** | chef, rh, dir, cc |

*Fiche d'interface de la [charte de tests](../../CHARTE-DE-TESTS.md). À rejouer à chaque changement de l'écran. Cocher, dater, signer ; tout écart devient un défaut.*

## Préconditions
Jeu de démonstration (bloc « conges ») : le Responsable commercial (`commercial@demo…`) est le responsable de trois chargés de compte ; il a **deux demandes en attente** (Camille Ngono, congé annuel ; Karim Biya, permission d'une demi-journée). La demande d'Inès Abena (Investudy) n'a pour responsable que la direction : seule la RH la voit et la valide.

## Scénarios
| N° | Scénario | Étapes | Résultat attendu | Constaté (✔ / ✘) | Date et initiales |
|---|---|---|---|---|---|
| 1 | **Mon équipe** | Avec `commercial`, ouvrir la page (filtre « En attente » par défaut). | Deux demandes : Camille Ngono (congé annuel, 5 jours) et Karim Biya (permission, 0,5 jour, « (matin) ») ; rien de la demande d'Inès Abena. | ☐ | |
| 2 | **Toutes les demandes** | Avec `rh`, cliquer « Toutes les demandes ». | Trois demandes en attente, dont celle d'Inès Abena ; le filtre « Mon équipe » ne montre que les collaborateurs directs de la RH. | ☐ | |
| 3 | **Droit de voir toutes** | Avec `commercial`, chercher le bouton « Toutes les demandes ». | Absent : seul celui qui voit toutes les absences (RH, Direction) a ce filtre. | ☐ | |
| 4 | **Valider** | Menu de ligne › Valider, puis Valider dans la fenêtre. | Message « La demande est validée » ; la demande disparaît de « En attente » et apparaît dans « Validées » ; elle devient visible dans le calendrier ; le solde passe de « en attente » à « pris ». | ☐ | |
| 5 | **Refuser sans motif** | Menu de ligne › Refuser ; envoyer sans motif. | Le champ « Motif du refus » est en surbrillance avec « Le motif est obligatoire » ; rien n'est envoyé. | ☐ | |
| 6 | **Refuser avec motif** | Refuser avec un motif. | Message « La demande est refusée » ; la demande passe dans « Refusées » ; l'employé voit le motif dans « Mes absences » ; son solde n'est pas touché. | ☐ | |
| 7 | **Pas sa propre demande** | Avec la RH, chercher sa propre demande en attente (si elle en a une). | L'API refuse de la valider (« Vous ne pouvez pas valider ou refuser cette demande ») : personne ne valide la sienne, pas même la RH ou le Super administrateur. | ☐ | |
| 8 | **Décision d'un autre onglet** | Ouvrir la même demande dans deux onglets ; décider dans l'un, puis dans l'autre. | Le second reçoit « La demande a été modifiée par un autre utilisateur : rechargez-la ». | ☐ | |
| 9 | **Droit insuffisant** | Avec un profil sans droit de valider. | La page dit « Votre profil ne valide pas de demandes » ; l'entrée n'est pas dans le menu. | ☐ | |
| 10 | **Filtres** | Filtrer Toutes / Validées / Refusées / Annulées. | Le tableau suit le filtre ; les demandes décidées n'ont plus d'action. | ☐ | |

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
- API : `hr-leave-http.integration`, `leave-use-cases.spec` (décision, refus motivé, jamais sa propre demande, revérification du solde et du chevauchement), contrat IDOR (route de décision) ; Web : `leave.test` (motif de refus, entrée de menu par droit), mutants de RH-2c

## Limites connues
- Pas de suppléant : si le responsable est absent, la demande attend ; la RH peut valider (D170).
- Aucun e-mail au responsable à la demande (D169).

## Écarts constatés
| Date | Scénario | Description | Défaut ouvert (D…) |
|---|---|---|---|
| | | | |
