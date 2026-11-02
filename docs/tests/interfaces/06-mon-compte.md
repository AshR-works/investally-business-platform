# Fiche de test — Mon compte

| | |
|---|---|
| **Route** | `/account` |
| **Livrée par** | S3.4, S3.7 |
| **Accès** | Utilisateur connecté. |
| **Droits** | Aucun droit supplémentaire. |
| **Rôles de test** | tous |

*Fiche d'interface de la [charte de tests](../../CHARTE-DE-TESTS.md). À rejouer à chaque changement de l'écran. Cocher, dater, signer ; tout écart devient un défaut.*

## Préconditions
Un compte avec MFA configuré.

## Scénarios
| N° | Scénario | Étapes | Résultat attendu | Constaté (✔ / ✘) | Date et initiales |
|---|---|---|---|---|---|
| 1 | **Profil** | Ouvrir la page. | Nom, adresse et rôles de l'utilisateur connecté (jamais ceux d'un autre). | ☐ | |
| 2 | **Changer le mot de passe** | Saisir l'actuel, le nouveau, la confirmation ; valider. | Indications en direct ; erreur du serveur affichée telle quelle ; trois yeux (afficher / masquer). | ☐ | |
| 3 | **Mauvais mot de passe actuel** | Saisir un mauvais mot de passe actuel. | Refus avec message. | ☐ | |
| 4 | **Remplacer les codes de secours** | Cliquer, lire la fenêtre, annuler ; recommencer et confirmer. | Fenêtre « Remplacer vos codes de secours ? », focus initial sur « Annuler », Échap annule ; sinon nouveaux codes affichés une seule fois. | ☐ | |
| 5 | **Codes de secours (affichage unique)** | Copier, télécharger, imprimer ; essayer de quitter sans cocher la case. | Garde de sortie jusqu'à la case « J'ai conservé ces codes » ; « Terminer ». | ☐ | |
| 6 | **Accès aux sessions** | Cliquer le lien vers les sessions et l'historique. | Ouverture de la page Sessions et connexions. | ☐ | |

## Accessibilité
- ☐ Clavier seul : Tab et Maj+Tab parcourent tous les contrôles dans un ordre logique ; le focus est toujours visible ; aucun piège de focus hors fenêtre modale.
- ☐ Un seul titre de niveau 1 ; pas de saut de niveau (h2 avant h3).
- ☐ Chaque champ a un libellé relié ; un champ non conforme est en surbrillance **et** accompagné d'un message écrit relié (`aria-describedby`), jamais la couleur seule ; le focus va au premier champ en erreur.
- ☐ Les messages d'état et d'erreur sont annoncés (`role=alert` ou `aria-live`).
- ☐ Fenêtres modales : le focus entre dans la fenêtre, Échap la ferme, le focus revient à l'élément d'origine, l'arrière-plan est inerte.
- ☐ Lisible à 200 % de zoom et à 375 px de large, sans défilement horizontal de la page.
- ☐ La fenêtre de confirmation est de type « danger » : bouton rouge « Remplacer mes codes ».

## Tests automatisés qui couvrent cet écran
- API : `mfa-http.integration`, `auth-http.integration`
- Web : `s37.test.ts`
- Audit navigateur : S3.7 (43 états)

## Limites connues
- D46, D47, D48 (voir la recette de S3.7).

## Écarts constatés
| Date | Scénario | Description | Défaut ouvert (D…) |
|---|---|---|---|
| | | | |
