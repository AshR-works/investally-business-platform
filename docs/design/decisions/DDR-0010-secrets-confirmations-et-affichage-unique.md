# DDR-0010 — Mot de passe affichable, confirmation des actions irréversibles, codes de secours à affichage unique

| | |
|---|---|
| **Statut** | Acceptée (réalisée dans l'application) ; prototype à mettre à jour (voir Conséquences) |
| **Date** | 2026-10-22 |
| **Version du design** | 0.4.1 (le prototype n'est pas encore à jour : version 0.5.0 à décider) |
| **Lié à** | EXD-12, EXD-13 ; retours de tests UX-01, UX-03, UX-04 ; `docs/cadrages/CADRAGE-RETOURS-TESTS-UX-01-A-04.md` |

## Contexte
Les tests fonctionnels locaux du 2026-10-22 ont relevé : mots de passe saisis à l'aveugle (UX-01), régénération des codes de secours sans confirmation (UX-03), codes de secours de « Mon compte » sans copie ni export et sans protection à la sortie (UX-04).

## Décisions (recommandations retenues par la direction produit)
1. **Un seul composant `PasswordField`** pour tous les champs mot de passe (6 champs sur 4 écrans), avec bouton « œil » en pictogramme seul (EXD-11), à bascule annoncée (`aria-pressed`). Remasquage automatique à l'envoi, à la perte de visibilité de l'onglet et après 30 s. Correction orthographique coupée. L'icône « œil » native d'Edge est masquée (sinon doublon).
2. **Fenêtre de confirmation `danger`** (`ConfirmDialog`) pour toute action irréversible : pictogramme d'alerte, trois messages (invalidés immédiatement, irréversible, affichage unique), **focus initial sur « Annuler »**, bouton de confirmation en rouge. Appliquée à la régénération des codes de secours ; le MFA récent reste demandé après la confirmation.
3. **Codes de secours à affichage unique** (`SecretCodesPanel`, partagé par l'activation MFA et « Mon compte ») : copie, fichier texte, impression (« Enregistrer au format PDF »). « Une seule fois » est lu comme **limité à l'écran de génération** (option ii) : les actions restent disponibles tant que l'écran est affiché ; une fois quitté, aucun accès. Garde de sortie tant que la case « J'ai conservé ces codes » n'est pas cochée (fermeture, rechargement ET liens internes).
4. **PDF par impression navigateur** (91/105 contre 83 pour un générateur maison et 80 pour une bibliothèque) : aucune dépendance ajoutée ; ce n'est pas un téléchargement en un clic.
5. **Rôles et permissions (UX-02)** : option B+C retenue (sélection par groupes + aperçu des droits par module), cumul de plusieurs rôles conservé ; **réalisation dans un lot distinct**.

## Mesures de sécurité prises
- Les codes ne vivent qu'en mémoire de la page (aucun stockage du navigateur ni adresse) : test automatique et vérification dans un navigateur réel.
- La feuille imprimée et le fichier texte ne contiennent **ni nom, ni adresse e-mail**.
- Avertissement sur l'historique du presse-papiers du système après une copie.

## Conséquences
- **Prototype non mis à jour** : l'œil de l'écran de connexion, la fenêtre `danger` et le panneau des codes sont absents du prototype 0.4.1 ; à ajouter avec la prochaine version du design (MINEUR : nouveaux composants, donc 0.5.0 selon DDR-0006).
- Réversible : trois composants, un par décision.
- Limites assumées : la garde de sortie ne couvre pas le bouton « Précédent » du navigateur ni le bouton de déconnexion ; l'écoute avec un vrai lecteur d'écran (D31) doit couvrir ces écrans.
