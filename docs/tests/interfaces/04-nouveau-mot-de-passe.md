# Fiche de test — Nouveau mot de passe

| | |
|---|---|
| **Route** | `/reset-password` |
| **Livrée par** | S3.5, H2a, S3.7 |
| **Accès** | Lien reçu (le jeton est dans le fragment de l'adresse). |
| **Droits** | Aucun droit requis. |
| **Rôles de test** | n/a |

*Fiche d'interface de la [charte de tests](../../CHARTE-DE-TESTS.md). À rejouer à chaque changement de l'écran. Cocher, dater, signer ; tout écart devient un défaut.*

## Préconditions
Un lien de réinitialisation valide (journal local de l'API) ; un lien expiré ou déjà utilisé.

## Scénarios
| N° | Scénario | Étapes | Résultat attendu | Constaté (✔ / ✘) | Date et initiales |
|---|---|---|---|---|---|
| 1 | **Règles en direct** | Saisir un nouveau mot de passe caractère par caractère. | Chaque règle passe de « à respecter » à « respectée » et est annoncée. | ☐ | |
| 2 | **Confirmation différente** | Saisir deux mots de passe différents. | Refus avec message écrit. | ☐ | |
| 3 | **Succès** | Saisir un mot de passe conforme, confirmer, valider. | « Mot de passe modifié » ; « toutes vos sessions ont été fermées » ; lien vers la connexion. | ☐ | |
| 4 | **Lien invalide ou expiré** | Ouvrir un lien périmé. | Notice et bouton « Demander un nouveau lien ». | ☐ | |
| 5 | **Jeton protégé** | Ouvrir un lien valide, observer l'adresse et l'historique. | Le jeton est effacé de la barre d'adresse et de l'historique ; il n'est jamais envoyé au serveur dans l'adresse. | ☐ | |
| 6 | **Œil** | Afficher / masquer les deux champs. | Même comportement que la connexion. | ☐ | |

## Accessibilité
- ☐ Clavier seul : Tab et Maj+Tab parcourent tous les contrôles dans un ordre logique ; le focus est toujours visible ; aucun piège de focus hors fenêtre modale.
- ☐ Un seul titre de niveau 1 ; pas de saut de niveau (h2 avant h3).
- ☐ Chaque champ a un libellé relié ; un champ non conforme est en surbrillance **et** accompagné d'un message écrit relié (`aria-describedby`), jamais la couleur seule ; le focus va au premier champ en erreur.
- ☐ Les messages d'état et d'erreur sont annoncés (`role=alert` ou `aria-live`).
- ☐ Fenêtres modales : le focus entre dans la fenêtre, Échap la ferme, le focus revient à l'élément d'origine, l'arrière-plan est inerte.
- ☐ Lisible à 200 % de zoom et à 375 px de large, sans défilement horizontal de la page.
- ☐ Les règles de mot de passe sont lisibles par un lecteur d'écran (état annoncé).

## Tests automatisés qui couvrent cet écran
- API : `password-reset.integration`
- Web : `h2a.test.ts`, `s37.test.ts` (uniformité du champ mot de passe)

## Limites connues
- Aucune limite propre à cet écran.

## Écarts constatés
| Date | Scénario | Description | Défaut ouvert (D…) |
|---|---|---|---|
| | | | |
