# Fiche de test — Relances

| | |
|---|---|
| **Route** | `/followups` |
| **Livrée par** | S4.2c |
| **Accès** | Utilisateur avec `bd.followup.read`. |
| **Droits** | Chargé de compte (Propre), Responsable commercial (Équipe). |
| **Rôles de test** | cc, rc |

*Fiche d'interface de la [charte de tests](../../CHARTE-DE-TESTS.md). À rejouer à chaque changement de l'écran. Cocher, dater, signer ; tout écart devient un défaut.*

## Préconditions
Une offre déposée ; des relances à venir et en retard.

## Scénarios
| N° | Scénario | Étapes | Résultat attendu | Constaté (✔ / ✘) | Date et initiales |
|---|---|---|---|---|---|
| 1 | **Liste « À faire »** | Ouvrir la page. | Relances des offres visibles, triées par échéance ; retard signalé par un texte (pas la couleur seule). | ☐ | |
| 2 | **Planifier** | Planifier une relance (date, canal, note) pour une offre déposée. | Relance créée ; date passée refusée. | ☐ | |
| 3 | **Modifier** | Modifier la date ou la note. | Mise à jour ; version périmée = conflit. | ☐ | |
| 4 | **Terminer avec un résultat** | Terminer en indiquant le résultat. | Relance close ; résultat conservé ; définitive. | ☐ | |
| 5 | **Annuler** | Annuler avec un motif. | Relance annulée ; motif obligatoire. | ☐ | |
| 6 | **Annulation avec l'offre** | Retirer l'offre ou recevoir la réponse du client. | Les relances prévues sont annulées automatiquement. | ☐ | |
| 7 | **Portée** | Se connecter avec un collègue. | Aucune relance d'une offre hors portée. | ☐ | |

## Accessibilité
- ☐ Clavier seul : Tab et Maj+Tab parcourent tous les contrôles dans un ordre logique ; le focus est toujours visible ; aucun piège de focus hors fenêtre modale.
- ☐ Un seul titre de niveau 1 ; pas de saut de niveau (h2 avant h3).
- ☐ Chaque champ a un libellé relié ; un champ non conforme est en surbrillance **et** accompagné d'un message écrit relié (`aria-describedby`), jamais la couleur seule ; le focus va au premier champ en erreur.
- ☐ Les messages d'état et d'erreur sont annoncés (`role=alert` ou `aria-live`).
- ☐ Fenêtres modales : le focus entre dans la fenêtre, Échap la ferme, le focus revient à l'élément d'origine, l'arrière-plan est inerte.
- ☐ Lisible à 200 % de zoom et à 375 px de large, sans défilement horizontal de la page.
- ☐ Le retard est annoncé en texte ; le menu d'actions est utilisable au clavier.

## Tests automatisés qui couvrent cet écran
- API : `followups-http.integration`
- Web : `s47.test.ts`
- Mutants : S4.2c

## Limites connues
- Aucun rappel n'est envoyé (ni e-mail ni notification).

## Écarts constatés
| Date | Scénario | Description | Défaut ouvert (D…) |
|---|---|---|---|
| | | | |
