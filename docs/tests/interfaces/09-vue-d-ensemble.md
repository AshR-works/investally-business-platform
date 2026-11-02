# Fiche de test — Vue d'ensemble (hub)

| | |
|---|---|
| **Route** | `/` |
| **Livrée par** | H1 |
| **Accès** | Utilisateur connecté. |
| **Droits** | Aucun droit requis ; les modules proposés dépendent des droits. |
| **Rôles de test** | tous |

*Fiche d'interface de la [charte de tests](../../CHARTE-DE-TESTS.md). À rejouer à chaque changement de l'écran. Cocher, dater, signer ; tout écart devient un défaut.*

## Préconditions
Comptes de rôles différents (chargé de compte, Direction, Super administrateur).

## Scénarios
| N° | Scénario | Étapes | Résultat attendu | Constaté (✔ / ✘) | Date et initiales |
|---|---|---|---|---|---|
| 1 | **Modules disponibles** | Ouvrir la page avec un compte donné. | Seuls les modules permis sont cliquables ; les modules à venir sont grisés. | ☐ | |
| 2 | **Selon le rôle** | Comparer chargé de compte, Direction, Super administrateur. | Les modules visibles correspondent aux droits (ex. « Utilisateurs » réservé aux administrateurs). | ☐ | |
| 3 | **Recherche globale** | Saisir un terme dans la recherche. | Résultats parmi les modules disponibles ; aucune donnée hors portée. | ☐ | |
| 4 | **Aucune donnée fictive** | Observer la page. | Aucun chiffre ni donnée inventée : un indicateur n'apparaît qu'avec une source réelle. | ☐ | |
| 5 | **Navigation** | Cliquer un module. | Ouverture de la bonne page ; fil d'Ariane et rail de navigation cohérents. | ☐ | |

## Accessibilité
- ☐ Clavier seul : Tab et Maj+Tab parcourent tous les contrôles dans un ordre logique ; le focus est toujours visible ; aucun piège de focus hors fenêtre modale.
- ☐ Un seul titre de niveau 1 ; pas de saut de niveau (h2 avant h3).
- ☐ Chaque champ a un libellé relié ; un champ non conforme est en surbrillance **et** accompagné d'un message écrit relié (`aria-describedby`), jamais la couleur seule ; le focus va au premier champ en erreur.
- ☐ Les messages d'état et d'erreur sont annoncés (`role=alert` ou `aria-live`).
- ☐ Fenêtres modales : le focus entre dans la fenêtre, Échap la ferme, le focus revient à l'élément d'origine, l'arrière-plan est inerte.
- ☐ Lisible à 200 % de zoom et à 375 px de large, sans défilement horizontal de la page.
- ☐ Le rail compact et le menu sont utilisables au clavier ; le module courant est indiqué.

## Tests automatisés qui couvrent cet écran
- Web : `h1.test.ts` (modules, recherche), `h1b.test.ts`
- Audit navigateur : rail compact

## Limites connues
- Modules Formation, Finance, RH, Fiscalité, Stocks, Reporting, Sécurité : à venir.

## Écarts constatés
| Date | Scénario | Description | Défaut ouvert (D…) |
|---|---|---|---|
| | | | |
