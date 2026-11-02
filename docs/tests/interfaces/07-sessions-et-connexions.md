# Fiche de test — Sessions et connexions

| | |
|---|---|
| **Route** | `/account/sessions` |
| **Livrée par** | H2b |
| **Accès** | Utilisateur connecté (ses propres données seulement). |
| **Droits** | `iam.session.read` / `iam.session.revoke` (portée Propre). |
| **Rôles de test** | tous |

*Fiche d'interface de la [charte de tests](../../CHARTE-DE-TESTS.md). À rejouer à chaque changement de l'écran. Cocher, dater, signer ; tout écart devient un défaut.*

## Préconditions
Deux sessions ouvertes pour le même compte (deux navigateurs).

## Scénarios
| N° | Scénario | Étapes | Résultat attendu | Constaté (✔ / ✘) | Date et initiales |
|---|---|---|---|---|---|
| 1 | **Mes sessions** | Ouvrir la page. | Liste des sessions actives avec appareil et dernière activité ; la session courante est identifiée. | ☐ | |
| 2 | **Révoquer une session** | Révoquer l'autre session, confirmer. | Confirmation demandée ; la session disparaît ; le second navigateur est déconnecté. | ☐ | |
| 3 | **Révoquer toutes les autres** | Cliquer « Fermer toutes les autres sessions », confirmer. | Confirmation avec le nombre de sessions ; MFA récent demandé si besoin. | ☐ | |
| 4 | **Historique** | Consulter l'historique des connexions. | Connexions des 90 derniers jours, réussies et échouées, avec libellés. | ☐ | |
| 5 | **Données personnelles** | Se connecter avec un second compte. | Chacun ne voit jamais que ses propres sessions et connexions. | ☐ | |

## Accessibilité
- ☐ Clavier seul : Tab et Maj+Tab parcourent tous les contrôles dans un ordre logique ; le focus est toujours visible ; aucun piège de focus hors fenêtre modale.
- ☐ Un seul titre de niveau 1 ; pas de saut de niveau (h2 avant h3).
- ☐ Chaque champ a un libellé relié ; un champ non conforme est en surbrillance **et** accompagné d'un message écrit relié (`aria-describedby`), jamais la couleur seule ; le focus va au premier champ en erreur.
- ☐ Les messages d'état et d'erreur sont annoncés (`role=alert` ou `aria-live`).
- ☐ Fenêtres modales : le focus entre dans la fenêtre, Échap la ferme, le focus revient à l'élément d'origine, l'arrière-plan est inerte.
- ☐ Lisible à 200 % de zoom et à 375 px de large, sans défilement horizontal de la page.
- ☐ La fenêtre de confirmation détaille ce qui va être fait.

## Tests automatisés qui couvrent cet écran
- API : `login-history.spec`, `login-history.integration`, `rbac-http.integration`
- Web : `h2b.test.ts`

## Limites connues
- Aucune limite propre à cet écran.

## Écarts constatés
| Date | Scénario | Description | Défaut ouvert (D…) |
|---|---|---|---|
| | | | |
