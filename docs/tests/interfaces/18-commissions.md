# Fiche de test — Commissions

| | |
|---|---|
| **Route** | `/commissions` |
| **Livrée par** | S4.4c |
| **Accès** | Utilisateur avec `bd.commission.read`. |
| **Droits** | Lire : chargé de compte (les siennes), Responsable commercial (son équipe), Finance et Direction (toutes) ; **débloquer / mettre en attente : Finance** ; **constater le versement : chargé de compte, Responsable commercial** ; **annuler, fixer un montant manquant : Responsable commercial**. |
| **Rôles de test** | cc, rc, fin, dir |

*Fiche d'interface de la [charte de tests](../../CHARTE-DE-TESTS.md). À rejouer à chaque changement de l'écran. Cocher, dater, signer ; tout écart devient un défaut.*

## Préconditions
Une entreprise du chargé de compte avec un facilitateur et une commission (définie par le Responsable commercial) ; une opportunité à l'accord de principe avec un agrément reçu ; un compte Finance ; un second chargé de compte d'une autre équipe.

## Scénarios
| N° | Scénario | Étapes | Résultat attendu | Constaté (✔ / ✘) | Date et initiales |
|---|---|---|---|---|---|
| 1 | **Une commission naît à l'honneur de l'agrément** | Finance : honorer l'agrément de l'entreprise (fiche entreprise, panneau Agréments). | La commission apparaît sur la page « Commissions », « À verser », avec son montant figé (montant fixe, ou pourcentage du montant de l'agrément) et son facilitateur. | ☐ | |
| 2 | **Sans commission, rien n'est dû** | Honorer l'agrément d'une entreprise sans facilitateur ou sans commission définie. | Aucune commission n'est créée. | ☐ | |
| 3 | **Débloquer les fonds** | Finance : menu de la ligne, « Débloquer les fonds », confirmer. | État « Fonds débloqués » ; décision tracée dans l'audit. | ☐ | |
| 4 | **Mettre en attente** | Finance : « Mettre en attente » sans motif, puis avec un motif. | Sans motif : champ en surbrillance et message annoncé. Avec motif : « En attente » et le motif affiché ; « Débloquer les fonds » reste possible. | ☐ | |
| 5 | **Montant à fixer** | Agrément sans montant (places seules) et commission en pourcentage : ouvrir la commission. | Montant « À fixer », déblocage non proposé. Responsable commercial : « Fixer le montant » une fois ; ensuite le montant est figé. | ☐ | |
| 6 | **Constater le versement** | Chargé de compte : commission « Fonds débloqués », « Constater le versement ». | La fenêtre propose le dépôt du justificatif et la date du versement. | ☐ | |
| 7 | **Versement sans justificatif** | Valider la date sans avoir déposé de justificatif (ou avec un document d'une autre catégorie). | Refus du serveur annoncé (« Déposez le justificatif… »), fenêtre toujours ouverte. | ☐ | |
| 8 | **Versement avec justificatif** | Déposer un document de catégorie « Justificatif » puis valider une date du jour ou passée. | État « Versée » avec sa date ; définitif ; la date future est refusée. | ☐ | |
| 9 | **Annuler** | Responsable commercial : « Annuler la commission » sans motif, puis avec un motif ; essayer sur une commission versée. | Motif obligatoire ; annulation définitive ; impossible après le versement. | ☐ | |
| 10 | **Filtrer par état** | Choisir un état dans le filtre. | Liste filtrée ; état vide lisible (« Aucune commission dans cet état »). | ☐ | |
| 11 | **Portée** | Chargé de compte, collègue d'une autre équipe, Responsable commercial, Finance, Direction. | Chargé de compte : les siennes ; collègue : aucune ; Responsable commercial : son équipe ; Finance et Direction : toutes. | ☐ | |
| 12 | **Droits par rôle** | Chargé de compte, Responsable commercial, Direction : essayer de débloquer ; Finance : essayer d'annuler ou de verser. | Seule la Finance débloque ; la Finance n'annule ni ne verse ; la Direction ne peut rien écrire. | ☐ | |
| 13 | **Sans accès** | Se connecter avec un rôle sans droit de lecture (Support). | Message « Votre profil n'a pas accès aux commissions ». | ☐ | |

## Accessibilité
- ☐ Clavier seul : Tab et Maj+Tab parcourent tous les contrôles dans un ordre logique ; le focus est toujours visible ; aucun piège de focus hors fenêtre modale.
- ☐ Un seul titre de niveau 1 ; pas de saut de niveau (h2 avant h3).
- ☐ Chaque champ a un libellé relié ; un champ non conforme est en surbrillance **et** accompagné d'un message écrit relié (`aria-describedby`), jamais la couleur seule ; le focus va au premier champ en erreur.
- ☐ Les messages d'état et d'erreur sont annoncés (`role=alert` ou `aria-live`).
- ☐ Fenêtres modales : le focus entre dans la fenêtre, Échap la ferme, le focus revient à l'élément d'origine, l'arrière-plan est inerte.
- ☐ Lisible à 200 % de zoom et à 375 px de large, sans défilement horizontal de la page.
- ☐ Le tableau a un titre (caption) ; le menu d'actions de ligne porte le nom du facilitateur ; le nombre de résultats est annoncé (`aria-live`) ; les erreurs de saisie et de refus sont annoncées et la fenêtre reste ouverte.

## Tests automatisés qui couvrent cet écran
- API : `commissions-http.integration` (10 scénarios), `commission-payout.spec`, `commission-payout-use-cases.spec`, `idor-contract.integration` (sept routes)
- Web : `s54-commissions` ; audit navigateur : `scripts/a11y-audit.mjs` (page Commissions : liste, déblocage, versement sans justificatif, filtre)

## Limites connues
- La Finance ne lit pas les justificatifs (aucun droit sur les documents, D138) ; pas de notification (D137) ; pas de page par facilitateur ni d'export (D140) ; pas de conversion de devise (D141) ; les lignes ne sont pas parcourues à l'œil avec des données de démonstration (D136).

## Écarts constatés
| Date | Scénario | Description | Défaut ouvert (D…) |
|---|---|---|---|
| | | | |
