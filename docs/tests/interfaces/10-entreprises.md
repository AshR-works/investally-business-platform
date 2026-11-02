# Fiche de test — Entreprises (tableau)

| | |
|---|---|
| **Route** | `/companies` |
| **Livrée par** | S1, H1b, S4.0, S4.1b, S4.3b, S4.3c |
| **Accès** | Utilisateur avec `bd.company.read`. |
| **Droits** | Lecture : chargé de compte (Propre), Responsable commercial (Équipe), Direction (Tous) ; création : `bd.company.create`. |
| **Rôles de test** | cc, rc, dir |

*Fiche d'interface de la [charte de tests](../../CHARTE-DE-TESTS.md). À rejouer à chaque changement de l'écran. Cocher, dater, signer ; tout écart devient un défaut.*

## Préconditions
Plusieurs entreprises appartenant à des chargés de compte différents ; un Responsable commercial et ses deux subordonnés.

## Scénarios
| N° | Scénario | Étapes | Résultat attendu | Constaté (✔ / ✘) | Date et initiales |
|---|---|---|---|---|---|
| 1 | **Portée** | Se connecter avec chaque rôle. | Chargé de compte : les siennes ; Responsable commercial : son équipe ; Direction : toutes. | ☐ | |
| 2 | **Recherche et filtres** | Rechercher un nom ; filtrer par statut (effectifs affichés), pays, secteur. | Résultats exacts ; effectifs par statut cohérents avec la portée. | ☐ | |
| 3 | **Tri et colonnes** | Trier par colonne ; afficher / masquer les colonnes. | Tri stable ; choix mémorisé ; la colonne « Entreprise » ne se masque pas ; « Responsable » et « Valeur » visibles par défaut. | ☐ | |
| 4 | **Colonne Valeur** | Créer des opportunités ouvertes (deux devises) sur une entreprise. | Nombre et valeur par devise (« 2 · … FCFA + … € ») ; gagnées et perdues exclues ; cellule vide sans droit de lire les opportunités. | ☐ | |
| 5 | **Nouvelle entreprise** | Cliquer « Nouvelle entreprise » ; remplir ; ajouter un facilitateur et une commission (Responsable commercial). | Entreprise créée au statut « Cible », vous en êtes le responsable ; doublon de nom refusé. | ☐ | |
| 6 | **Champ non conforme** | Saisir une adresse e-mail invalide. | Surbrillance, message, focus sur le champ. | ☐ | |
| 7 | **Pagination et sélection** | Aller à la page 2 ; sélectionner des lignes. | La sélection persiste d'une page à l'autre. | ☐ | |
| 8 | **Ouvrir une fiche** | Cliquer le nom d'une entreprise. | Ouverture de la fiche. | ☐ | |

## Accessibilité
- ☐ Clavier seul : Tab et Maj+Tab parcourent tous les contrôles dans un ordre logique ; le focus est toujours visible ; aucun piège de focus hors fenêtre modale.
- ☐ Un seul titre de niveau 1 ; pas de saut de niveau (h2 avant h3).
- ☐ Chaque champ a un libellé relié ; un champ non conforme est en surbrillance **et** accompagné d'un message écrit relié (`aria-describedby`), jamais la couleur seule ; le focus va au premier champ en erreur.
- ☐ Les messages d'état et d'erreur sont annoncés (`role=alert` ou `aria-live`).
- ☐ Fenêtres modales : le focus entre dans la fenêtre, Échap la ferme, le focus revient à l'élément d'origine, l'arrière-plan est inerte.
- ☐ Lisible à 200 % de zoom et à 375 px de large, sans défilement horizontal de la page.
- ☐ Le tableau a un titre (caption) et des en-têtes de colonnes ; le tri est annoncé.

## Tests automatisés qui couvrent cet écran
- API : `companies-table.integration`, `company-scope.spec`, `register-company.integration`, `facilitators-http.integration`
- Web : `s44.test.ts` (tableau), `s40`–`s42.test.ts` (facilitation, pays), `s51.test.ts` (valeur)
- Mutants : S4.1b, S4.3c

## Limites connues
- La valeur n'est pas pondérée, ni triable (D107) ; pas de liste fermée de pays (D57).

## Écarts constatés
| Date | Scénario | Description | Défaut ouvert (D…) |
|---|---|---|---|
| | | | |
