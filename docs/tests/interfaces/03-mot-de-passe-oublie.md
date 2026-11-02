# Fiche de test — Mot de passe oublié

| | |
|---|---|
| **Route** | `/forgot-password` |
| **Livrée par** | S3.5, H2a |
| **Accès** | Visiteur non connecté. |
| **Droits** | Aucun droit requis. |
| **Rôles de test** | n/a |

*Fiche d'interface de la [charte de tests](../../CHARTE-DE-TESTS.md). À rejouer à chaque changement de l'écran. Cocher, dater, signer ; tout écart devient un défaut.*

## Préconditions
Pile locale lancée ; en local, le lien reçu est écrit dans le journal de l'API.

## Scénarios
| N° | Scénario | Étapes | Résultat attendu | Constaté (✔ / ✘) | Date et initiales |
|---|---|---|---|---|---|
| 1 | **Adresse connue** | Saisir l'adresse d'un compte et valider. | Écran « e-mail envoyé » ; rappel de validité 60 minutes et des courriers indésirables. | ☐ | |
| 2 | **Adresse inconnue** | Saisir une adresse sans compte. | **Exactement le même** écran et le même message (aucune énumération). | ☐ | |
| 3 | **Adresse mal écrite** | Saisir une adresse invalide. | Champ en surbrillance avec message écrit. | ☐ | |
| 4 | **Limitation** | Répéter la demande à la suite. | Notice d'avertissement ; compte à rebours. | ☐ | |

## Accessibilité
- ☐ Clavier seul : Tab et Maj+Tab parcourent tous les contrôles dans un ordre logique ; le focus est toujours visible ; aucun piège de focus hors fenêtre modale.
- ☐ Un seul titre de niveau 1 ; pas de saut de niveau (h2 avant h3).
- ☐ Chaque champ a un libellé relié ; un champ non conforme est en surbrillance **et** accompagné d'un message écrit relié (`aria-describedby`), jamais la couleur seule ; le focus va au premier champ en erreur.
- ☐ Les messages d'état et d'erreur sont annoncés (`role=alert` ou `aria-live`).
- ☐ Fenêtres modales : le focus entre dans la fenêtre, Échap la ferme, le focus revient à l'élément d'origine, l'arrière-plan est inerte.
- ☐ Lisible à 200 % de zoom et à 375 px de large, sans défilement horizontal de la page.
- ☐ Le message de confirmation est annoncé.

## Tests automatisés qui couvrent cet écran
- API : `password-reset.spec`, `password-reset.integration`
- Web : `h2a.test.ts`

## Limites connues
- Aucun e-mail réel n'est envoyé tant que Microsoft 365 n'est pas branché (D9).

## Écarts constatés
| Date | Scénario | Description | Défaut ouvert (D…) |
|---|---|---|---|
| | | | |
