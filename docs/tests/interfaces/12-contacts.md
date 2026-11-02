# Fiche de test — Contacts

| | |
|---|---|
| **Route** | `/contacts` |
| **Livrée par** | S4.1a |
| **Accès** | Utilisateur avec `bd.contact.read`. |
| **Droits** | Lecture/création/modification : chargé de compte (Propre), Responsable commercial (Équipe) ; suppression : Responsable commercial. |
| **Rôles de test** | cc, rc |

*Fiche d'interface de la [charte de tests](../../CHARTE-DE-TESTS.md). À rejouer à chaque changement de l'écran. Cocher, dater, signer ; tout écart devient un défaut.*

## Préconditions
Plusieurs entreprises avec des contacts ; un contact existant (nom, e-mail).

## Scénarios
| N° | Scénario | Étapes | Résultat attendu | Constaté (✔ / ✘) | Date et initiales |
|---|---|---|---|---|---|
| 1 | **Liste et portée** | Ouvrir la page. | Seuls les contacts des entreprises de la portée. | ☐ | |
| 2 | **Recherche et filtre par fonction** | Rechercher un nom ; filtrer DAF / décideur / autre. | Résultats exacts. | ☐ | |
| 3 | **Créer** | Nouveau contact : entreprise (de sa portée), nom, prénom, fonction, téléphone, e-mail. | Contact créé ; entreprise hors portée absente de la liste. | ☐ | |
| 4 | **Doublon probable** | Créer un contact de même nom (ou même e-mail) dans la même entreprise. | Doublon signalé et fiche existante proposée ; création refusée tant que non confirmée selon la règle. | ☐ | |
| 5 | **E-mail ou téléphone invalide** | Saisir une valeur invalide. | Surbrillance, message écrit, focus. | ☐ | |
| 6 | **Modifier** | Modifier un contact. | Mise à jour ; version périmée = conflit. | ☐ | |
| 7 | **Supprimer** | Chargé de compte : supprimer. Responsable commercial : supprimer. | Refusé pour le chargé de compte ; autorisé avec confirmation pour le Responsable commercial ; le contact disparaît partout. | ☐ | |

## Accessibilité
- ☐ Clavier seul : Tab et Maj+Tab parcourent tous les contrôles dans un ordre logique ; le focus est toujours visible ; aucun piège de focus hors fenêtre modale.
- ☐ Un seul titre de niveau 1 ; pas de saut de niveau (h2 avant h3).
- ☐ Chaque champ a un libellé relié ; un champ non conforme est en surbrillance **et** accompagné d'un message écrit relié (`aria-describedby`), jamais la couleur seule ; le focus va au premier champ en erreur.
- ☐ Les messages d'état et d'erreur sont annoncés (`role=alert` ou `aria-live`).
- ☐ Fenêtres modales : le focus entre dans la fenêtre, Échap la ferme, le focus revient à l'élément d'origine, l'arrière-plan est inerte.
- ☐ Lisible à 200 % de zoom et à 375 px de large, sans défilement horizontal de la page.
- ☐ Champs et messages comme les autres formulaires.

## Tests automatisés qui couvrent cet écran
- API : `contacts-http.integration`, `idor-contract.integration`
- Web : `s43.test.ts`
- Mutants : S4.1a

## Limites connues
- Un contact appartient à une seule entreprise (CU-C-12 non réalisé).

## Écarts constatés
| Date | Scénario | Description | Défaut ouvert (D…) |
|---|---|---|---|
| | | | |
