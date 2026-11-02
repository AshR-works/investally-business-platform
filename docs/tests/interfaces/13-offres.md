# Fiche de test — Offres

| | |
|---|---|
| **Route** | `/offers` |
| **Livrée par** | S4.2a, S4.2b |
| **Accès** | Utilisateur avec `bd.offer.read`. |
| **Droits** | Chargé de compte (Propre), Responsable commercial (Équipe), Direction (lecture). |
| **Rôles de test** | cc, rc, dir |

*Fiche d'interface de la [charte de tests](../../CHARTE-DE-TESTS.md). À rejouer à chaque changement de l'écran. Cocher, dater, signer ; tout écart devient un défaut.*

## Préconditions
Une entreprise ; l'offre passera par brouillon, déposée, décharge reçue, réponse du client.

## Scénarios
| N° | Scénario | Étapes | Résultat attendu | Constaté (✔ / ✘) | Date et initiales |
|---|---|---|---|---|---|
| 1 | **Créer une offre** | Nouvelle offre : entreprise, objet, montant. | Offre « Brouillon » avec référence unique (OFF-AAAA-NNNN). | ☐ | |
| 2 | **Modifier un brouillon** | Modifier l'objet ou le montant. | Modification possible seulement en brouillon. | ☐ | |
| 3 | **Déposer** | Déposer l'offre. | État « Déposée » ; date de dépôt enregistrée. | ☐ | |
| 4 | **Décharge signée** | Enregistrer la décharge : date de réception, personne, fichier. | Offre « Décharge reçue » ; une seule décharge valide ; date jamais avant le dépôt ni dans le futur. | ☐ | |
| 5 | **Annuler la décharge** | Annuler avec un motif. | L'offre redevient « Déposée » ; motif obligatoire. | ☐ | |
| 6 | **Réponse du client** | Accepter ou refuser (après la décharge). | États « Acceptée » / « Refusée », définitifs. | ☐ | |
| 7 | **Retirer** | Retirer l'offre avec un motif. | État « Retirée » ; relances annulées. | ☐ | |
| 8 | **Planifier une relance** | Depuis le menu d'une offre déposée. | Voir l'écran Relances. | ☐ | |
| 9 | **Droits** | Direction : ouvrir. | Lecture seule ; aucune action proposée. | ☐ | |
| 10 | **Documents de l'offre** | Joindre, consulter les documents. | Visibles dans la portée seulement. | ☐ | |

## Accessibilité
- ☐ Clavier seul : Tab et Maj+Tab parcourent tous les contrôles dans un ordre logique ; le focus est toujours visible ; aucun piège de focus hors fenêtre modale.
- ☐ Un seul titre de niveau 1 ; pas de saut de niveau (h2 avant h3).
- ☐ Chaque champ a un libellé relié ; un champ non conforme est en surbrillance **et** accompagné d'un message écrit relié (`aria-describedby`), jamais la couleur seule ; le focus va au premier champ en erreur.
- ☐ Les messages d'état et d'erreur sont annoncés (`role=alert` ou `aria-live`).
- ☐ Fenêtres modales : le focus entre dans la fenêtre, Échap la ferme, le focus revient à l'élément d'origine, l'arrière-plan est inerte.
- ☐ Lisible à 200 % de zoom et à 375 px de large, sans défilement horizontal de la page.
- ☐ Menu d'actions de ligne au clavier ; les états sont écrits (jamais la couleur seule).

## Tests automatisés qui couvrent cet écran
- API : `offers-http.integration`, `receipts-http.integration`, `documents.integration`
- Web : `s45.test.ts`, `s46.test.ts`
- Mutants : S4.2a, S4.2b

## Limites connues
- Pas d'envoi réel de l'offre au client ; la décharge se téléverse en deux temps (D117 analogue).

## Écarts constatés
| Date | Scénario | Description | Défaut ouvert (D…) |
|---|---|---|---|
| | | | |
