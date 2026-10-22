# S3.7 — UX de l'authentification : recette

*Branche `sprint/s3-7-ux-authentification` · 2026-10-22 · issu des retours de tests locaux UX-01, UX-03 et UX-04 (cadrage : `docs/cadrages/CADRAGE-RETOURS-TESTS-UX-01-A-04.md`, décisions D23 et DDR-0010). **UX-02 (rôles et permissions) n'est pas dans ce lot** : option B+C retenue, lot distinct.*

## Ce qui est livré
| Retour | Livré |
|---|---|
| **UX-01** Afficher / masquer le mot de passe | Composant unique `PasswordField` (œil en pictogramme seul, bascule annoncée `aria-pressed`). **6 champs sur 4 écrans** : Connexion (1), Réinitialisation du mot de passe (2), Activation d'une invitation (2, même composant), Mon compte « Changer le mot de passe » (3 champs : actuel, nouveau, confirmation). Remasquage automatique : à l'envoi du formulaire, quand l'onglet n'est plus visible, après 30 s. Correction orthographique coupée. Icône « œil » native d'Edge masquée (sinon doublon) |
| **UX-03** Confirmation avant régénération | Fenêtre `ConfirmDialog` « Remplacer vos codes de secours ? » : codes actuels invalidés immédiatement, action irréversible, nouveaux codes affichés une seule fois. **Focus initial sur « Annuler »**, Échap annule, bouton rouge « Remplacer mes codes ». Le MFA récent est ensuite demandé comme avant |
| **UX-04** Codes de secours à affichage unique | Composant `SecretCodesPanel` partagé par l'activation MFA et Mon compte : **Copier**, **Télécharger (.txt)**, **Imprimer ou enregistrer en PDF** (feuille imprimée sans nom ni e-mail). Case « J'ai conservé ces codes » ; garde de sortie (fermeture, rechargement, **liens internes**) tant qu'elle n'est pas cochée ; bouton « Terminer » qui efface les codes de la mémoire. Sur Mon compte, la copie, l'export et la garde de sortie **n'existaient pas** |

Sans changement d'API ni de base : tout est dans l'interface (`apps/crm-web`).

## Preuves
| Contrôle | Résultat |
|---|---|
| Types (`tsc`) | 0 erreur |
| Tests de l'interface | **81 / 81** (dont 16 nouveaux : fichier des codes, uniformité du champ mot de passe, confirmation, affichage unique) |
| Uniformité | Un test échoue si un écran déclare `type="password"` en dehors de `PasswordField` |
| Navigateur réel (Edge, protocole DevTools), 24 vérifications de comportement | masqué par défaut ; un seul bouton œil ; 1er clic visible et annoncé « activé » ; valeur conservée ; correction orthographique coupée ; 2e clic masqué ; remasquage à l'envoi ; 3 champs et 3 yeux sur Mon compte ; confirmation avec ses 3 messages ; focus sur Annuler ; aucun code avant confirmation ; Échap annule ; au moins 8 codes ; 3 actions présentes ; téléchargement annoncé ; **impression : seule la feuille de codes reste visible, sans e-mail** ; garde de sortie sur lien interne ; « Rester » conserve les codes ; « Terminer » les efface ; **aucun code dans le stockage du navigateur** |
| Audit d'accessibilité (axe-core + arbre) | **43 états, 0 violation** (39 avant ; 4 nouveaux : œil activé, confirmation de régénération, nouveaux codes, garde de sortie) ; **0** violation de politique de contenu |
| Captures | `docs/accessibilite/s37-captures/` · résultats : `docs/accessibilite/resultats/axe-2026-10-22-s37.json` |

**À vérifier à la main (6)** : axe ne détermine pas le fond du paragraphe des fenêtres (2 nouvelles : confirmation de régénération et garde de sortie, même cas que les 4 précédentes). Contrôle manuel : texte `#1D1D1B` sur fond blanc (≈ 17 : 1), même jeton que partout.

## Limites et dette
- **D46** PDF par impression navigateur (pas un téléchargement en un clic) ; générateur interne possible sur demande.
- **D47** la garde de sortie ne couvre pas le bouton « Précédent » du navigateur ni la déconnexion.
- **D48** e-mail d'information après régénération : dépend de Microsoft 365 (S7).
- **D49** prototype de design non mis à jour (œil, fenêtre `danger`, panneau des codes) : version 0.5.0.
- L'écoute avec un vrai lecteur d'écran (D31) doit couvrir ces écrans (bouton à bascule, fenêtre de confirmation, panneau des codes).
- Non testé : la copie dans le presse-papiers réelle (le navigateur sans fenêtre l'interdit) ; le téléchargement réel du fichier ; l'ouverture de la boîte d'impression.

## À valider
1. Les textes de la fenêtre de confirmation et du panneau des codes (modifiables en un endroit).
2. « Je valide S3.7 » → fusion `--no-ff` dans `main` et étiquette `s3-7-validated`.
