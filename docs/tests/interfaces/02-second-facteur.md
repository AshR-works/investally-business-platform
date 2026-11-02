# Fiche de test — Second facteur (MFA)

| | |
|---|---|
| **Route** | `/mfa` |
| **Livrée par** | S3.2, S3.4, H2a, S3.7 |
| **Accès** | Utilisateur dont la connexion attend un code (vérification) ou dont le MFA n'est pas encore configuré (première configuration). |
| **Droits** | Aucun droit requis. |
| **Rôles de test** | n/a |

*Fiche d'interface de la [charte de tests](../../CHARTE-DE-TESTS.md). À rejouer à chaque changement de l'écran. Cocher, dater, signer ; tout écart devient un défaut.*

## Préconditions
Un compte avec MFA configuré ; un compte neuf sans MFA ; une application d'authentification.

## Scénarios
| N° | Scénario | Étapes | Résultat attendu | Constaté (✔ / ✘) | Date et initiales |
|---|---|---|---|---|---|
| 1 | **Code valide** | Saisir le code à six chiffres dans les six cases. | Focus automatique d'une case à l'autre ; saisie automatique à la sixième ; accès à l'application. | ☐ | |
| 2 | **Collage et clavier** | Coller un code ; utiliser Retour arrière et les flèches. | Le code se répartit dans les cases ; navigation et effacement corrects. | ☐ | |
| 3 | **Code invalide** | Saisir un mauvais code. | Message d'erreur annoncé ; pas d'accès. | ☐ | |
| 4 | **Code de secours** | Cliquer « Téléphone perdu ? », saisir un code au format XXXXX-XXXXX. | Connexion acceptée ; le code est consommé. | ☐ | |
| 5 | **Introduction du MFA** | Première configuration : lire l'introduction, cliquer « Commencer ». | Pourquoi, trois étapes ; le secret n'est créé qu'au clic. | ☐ | |
| 6 | **QR code et clé manuelle** | Scanner le QR code ou saisir la clé ; saisir un premier code. | QR généré dans le navigateur ; code invalide = notice d'erreur ; code valide = étape suivante. | ☐ | |
| 7 | **Codes de secours (affichage unique)** | Copier, télécharger (.txt), imprimer ; essayer de quitter sans cocher « J'ai conservé ces codes ». | Copie confirmée et annoncée ; garde de sortie tant que la case n'est pas cochée ; « Terminer » efface les codes de la mémoire. | ☐ | |

## Accessibilité
- ☐ Clavier seul : Tab et Maj+Tab parcourent tous les contrôles dans un ordre logique ; le focus est toujours visible ; aucun piège de focus hors fenêtre modale.
- ☐ Un seul titre de niveau 1 ; pas de saut de niveau (h2 avant h3).
- ☐ Chaque champ a un libellé relié ; un champ non conforme est en surbrillance **et** accompagné d'un message écrit relié (`aria-describedby`), jamais la couleur seule ; le focus va au premier champ en erreur.
- ☐ Les messages d'état et d'erreur sont annoncés (`role=alert` ou `aria-live`).
- ☐ Fenêtres modales : le focus entre dans la fenêtre, Échap la ferme, le focus revient à l'élément d'origine, l'arrière-plan est inerte.
- ☐ Lisible à 200 % de zoom et à 375 px de large, sans défilement horizontal de la page.
- ☐ Les six cases sont annoncées comme un seul champ (code à six chiffres) avec leur rang.
- ☐ La confirmation de copie est annoncée.

## Tests automatisés qui couvrent cet écran
- API : `mfa-http.integration`, `mfa-flows.integration`, `mfa-use-cases`
- Web : `h2a.test.ts` (saisie du code), `s37.test.ts` (codes de secours)
- Audit navigateur : 43 états en S3.7, 0 violation

## Limites connues
- La garde de sortie ne couvre pas le bouton « Précédent » du navigateur (D47).
- PDF des codes par impression du navigateur (D46).

## Écarts constatés
| Date | Scénario | Description | Défaut ouvert (D…) |
|---|---|---|---|
| | | | |
