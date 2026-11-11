# Fiche de test — Calendrier d'équipe

| | |
|---|---|
| **Route** | `/hr/leave/calendar` |
| **Livrée par** | RH-2b (recette et mutants : RH-2c) |
| **Accès** | Tout utilisateur qui détient `hr.leave.read` : menu Ressources humaines › Calendrier d'équipe. |
| **Droits** | **Voir** : tout employé voit les absences **validées** de son service, avec la seule mention « absent » (ni type, ni motif) ; l'employé lui-même, son responsable, la RH et la Direction voient aussi le **type**. La RH et la Direction peuvent choisir le service. |
| **Rôles de test** | cc, chef, rh, dir |

*Fiche d'interface de la [charte de tests](../../CHARTE-DE-TESTS.md). À rejouer à chaque changement de l'écran. Cocher, dater, signer ; tout écart devient un défaut.*

## Préconditions
Jeu de démonstration (bloc « conges ») : trois absences validées (maladie de Karim Biya dans le passé, congé du Support dans les jours qui viennent, congé annuel de Karim Biya dans quelques semaines). Aucun jour férié saisi.

## Scénarios
| N° | Scénario | Étapes | Résultat attendu | Constaté (✔ / ✘) | Date et initiales |
|---|---|---|---|---|---|
| 1 | **Mois courant** | Ouvrir la page. | Le mois en cours est affiché, aujourd'hui souligné ; une ligne par personne absente, une colonne par jour ; week-ends grisés. | ☐ | |
| 2 | **Naviguer** | Flèches précédent / suivant et « Aujourd'hui ». | Le mois change, l'année aussi en passant de décembre à janvier ; « Aujourd'hui » revient au mois courant. | ☐ | |
| 3 | **Ce que voit un collègue** | Avec `compte1`, regarder une absence de Sonia Manga ou de Karim Biya. | Aucun type ni motif : le nom et le service seulement. | ☐ | |
| 4 | **Ce que voit le responsable et la RH** | Avec `commercial`, puis `rh`. | Le type d'absence (« Maladie », « Congé annuel ») apparaît sous le nom. | ☐ | |
| 5 | **Demi-journée** | Valider la permission d'une demi-journée de Karim Biya (écran « Absences à valider »), revenir au calendrier du mois concerné. | La case porte ◐ (matin) ou ◑ (après-midi) **et** un texte pour lecteur d'écran « absent le matin / l'après-midi » ; la légende l'explique. | ☐ | |
| 6 | **Week-end dans une absence** | Regarder une absence qui couvre un week-end. | Les cases du samedi et du dimanche restent grisées, sans marque : ce ne sont pas des jours d'absence. | ☐ | |
| 7 | **Jour férié** | Saisir un jour férié (Paramètres RH) dans le mois, revenir. | La colonne est grisée, son titre dit « jour férié : <libellé> » ; aucune marque ce jour-là. | ☐ | |
| 8 | **Service** | Avec `rh`, choisir un service dans « Service ». | Seules les personnes de ce service ; un employé ordinaire n'a pas ce choix (il voit son service). | ☐ | |
| 9 | **Mois sans absence** | Aller dans un mois sans absence. | Une ligne unique « Aucune absence validée en <mois> ». | ☐ | |
| 10 | **Seules les validées** | Créer une demande en attente, regarder le calendrier. | Elle n'y figure pas tant qu'elle n'est pas validée. | ☐ | |

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
- API : `hr-leave-http.integration` (calendrier, confidentialité du type), `leave-use-cases.spec` (un collègue voit « absent » sans type, trois mois au plus) ; Web : `leave.test` (marques de journée et de demi-journée, tri des lignes, bornes et passage d'un mois à l'autre), mutants de RH-2c

## Limites connues
- Un mois à la fois ; période de trois mois au plus côté serveur.
- Beaucoup de personnes absentes : le tableau défile dans son cadre (colonne des noms figée).

## Écarts constatés
| Date | Scénario | Description | Défaut ouvert (D…) |
|---|---|---|---|
| | | | |
