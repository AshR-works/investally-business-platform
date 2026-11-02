# Fiche de test — Activation d'une invitation

| | |
|---|---|
| **Route** | `/invitation` |
| **Livrée par** | S3.3, S3.4, H2a, S3.7 |
| **Accès** | Lien d'invitation reçu (jeton dans le fragment). |
| **Droits** | Aucun droit requis. |
| **Rôles de test** | n/a |

*Fiche d'interface de la [charte de tests](../../CHARTE-DE-TESTS.md). À rejouer à chaque changement de l'écran. Cocher, dater, signer ; tout écart devient un défaut.*

## Préconditions
Une invitation créée depuis l'administration (lien dans le journal local de l'API).

## Scénarios
| N° | Scénario | Étapes | Résultat attendu | Constaté (✔ / ✘) | Date et initiales |
|---|---|---|---|---|---|
| 1 | **Activer le compte** | Ouvrir le lien, choisir un mot de passe conforme, confirmer. | Compte activé ; mêmes règles et mêmes champs que la réinitialisation. | ☐ | |
| 2 | **Lien invalide ou expiré** | Ouvrir un lien périmé ou déjà utilisé. | Notice : contacter un administrateur. | ☐ | |
| 3 | **Jeton protégé** | Observer l'adresse après ouverture. | Jeton effacé de l'adresse et de l'historique. | ☐ | |

## Accessibilité
- ☐ Clavier seul : Tab et Maj+Tab parcourent tous les contrôles dans un ordre logique ; le focus est toujours visible ; aucun piège de focus hors fenêtre modale.
- ☐ Un seul titre de niveau 1 ; pas de saut de niveau (h2 avant h3).
- ☐ Chaque champ a un libellé relié ; un champ non conforme est en surbrillance **et** accompagné d'un message écrit relié (`aria-describedby`), jamais la couleur seule ; le focus va au premier champ en erreur.
- ☐ Les messages d'état et d'erreur sont annoncés (`role=alert` ou `aria-live`).
- ☐ Fenêtres modales : le focus entre dans la fenêtre, Échap la ferme, le focus revient à l'élément d'origine, l'arrière-plan est inerte.
- ☐ Lisible à 200 % de zoom et à 375 px de large, sans défilement horizontal de la page.

## Tests automatisés qui couvrent cet écran
- API : `admin-flows.integration`, `password-reset.integration`
- Web : `lib.test.ts` (invitation), `h2a.test.ts`

## Limites connues
- L'invitation par e-mail dépend de Microsoft 365 (D9).

## Écarts constatés
| Date | Scénario | Description | Défaut ouvert (D…) |
|---|---|---|---|
| | | | |
