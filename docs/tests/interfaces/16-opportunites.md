# Fiche de test — Opportunités (pipeline)

| | |
|---|---|
| **Route** | `/opportunities` |
| **Livrée par** | S4.3a, S4.3b, S4.3c |
| **Accès** | Utilisateur avec `bd.opportunity.read` (Responsable commercial et Direction lisent toutes). |
| **Droits** | Créer / modifier / avancer : chargé de compte (Propre), Responsable commercial (Équipe) ; dérogation et clôture gagnée : Responsable commercial. |
| **Rôles de test** | cc, rc, dir |

*Fiche d'interface de la [charte de tests](../../CHARTE-DE-TESTS.md). À rejouer à chaque changement de l'écran. Cocher, dater, signer ; tout écart devient un défaut.*

## Préconditions
Une entreprise ; pour la règle de l'accord de principe, un rendez-vous décideur à faire tenir.

## Scénarios
| N° | Scénario | Étapes | Résultat attendu | Constaté (✔ / ✘) | Date et initiales |
|---|---|---|---|---|---|
| 1 | **Cartes et par étape** | Basculer Cartes / Par étape ; filtrer Ouvertes / Gagnées / Perdues / Toutes. | Cinq colonnes titrées avec effectif et montant ; total annoncé. | ☐ | |
| 2 | **Créer** | Nouvelle opportunité (aussi depuis la fiche entreprise). | Étape « Qualification » ; entreprise imposée depuis la fiche. | ☐ | |
| 3 | **Une étape à la fois** | Faire avancer à chaque étape. | Passage dans l'ordre ; pas de retour en arrière ; chaque passage tracé. | ☐ | |
| 4 | **Accord de principe refusé** | Avancer à « Accord de principe » sans rendez-vous décideur tenu. | Refus annoncé avec renvoi vers la dérogation. | ☐ | |
| 5 | **Rendez-vous décideur lié** | Tenir un rendez-vous décideur lié à une autre opportunité. | Ne débloque pas celle-ci ; lié à elle ou non lié : débloque. | ☐ | |
| 6 | **Dérogation** | Responsable commercial : accorder une dérogation sans, puis avec justification. | Justification obligatoire ; badge « Dérogation » ; une seule fois. | ☐ | |
| 7 | **Clôturer perdue** | Clore avec un motif (dont « autre » sans puis avec précision). | Motif obligatoire ; « autre » exige une précision ; définitif. | ☐ | |
| 8 | **Clôturer gagnée** | Chargé de compte puis Responsable commercial. | Réservé au Responsable commercial, après l'accord de principe. | ☐ | |
| 9 | **Immuable après clôture** | Ouvrir le menu d'une opportunité close. | Seule la fiche est proposée. | ☐ | |
| 10 | **Portée et lecture** | Direction : ouvrir ; collègue : ouvrir. | Direction lit sans écrire ; le collègue ne voit pas les opportunités hors portée d'écriture. | ☐ | |

## Accessibilité
- ☐ Clavier seul : Tab et Maj+Tab parcourent tous les contrôles dans un ordre logique ; le focus est toujours visible ; aucun piège de focus hors fenêtre modale.
- ☐ Un seul titre de niveau 1 ; pas de saut de niveau (h2 avant h3).
- ☐ Chaque champ a un libellé relié ; un champ non conforme est en surbrillance **et** accompagné d'un message écrit relié (`aria-describedby`), jamais la couleur seule ; le focus va au premier champ en erreur.
- ☐ Les messages d'état et d'erreur sont annoncés (`role=alert` ou `aria-live`).
- ☐ Fenêtres modales : le focus entre dans la fenêtre, Échap la ferme, le focus revient à l'élément d'origine, l'arrière-plan est inerte.
- ☐ Lisible à 200 % de zoom et à 375 px de large, sans défilement horizontal de la page.
- ☐ Les titres des colonnes sont des titres de niveau 2 ; le menu « Déplacer vers… » est l'alternative clavier au glisser-déposer.

## Tests automatisés qui couvrent cet écran
- API : `opportunities-http.integration`, `idor-contract.integration`
- Web : `s49.test.ts`
- Mutants : S4.3a, S4.3c
- Audit navigateur : huit états, 0 violation

## Limites connues
- Pas d'export du pipeline (D97) ; limite d'affichage à 200 opportunités (D98) ; clôture gagnée sans effet en aval avant S4.4 (D96, partiellement soldée par l'agrément).

## Écarts constatés
| Date | Scénario | Description | Défaut ouvert (D…) |
|---|---|---|---|
| | | | |
