# H2a — Écrans d'accès au nouveau style : recette

*Branche `sprint/h2a-ecrans-d-acces` · 2026-10-22 · décision : CAD-H2-3 option B (deux lots) — H2a = écrans A01 à A15, H2b = sessions et historique (S01 à S03). **L'API n'est pas modifiée.***

## Ce qui est livré
| Écran | Réalisation |
|---|---|
| **A01** Connexion | Gabarit du design (carte d'accueil sombre, logo, indicateur d'étape 1 sur 2), notice d'erreur |
| **A02** Code du second facteur | **Six cases** (DDR-0009) : focus automatique, collage, saisie automatique, Retour arrière, flèches ; étape 2 sur 2 |
| **A03** Code de secours | Bascule « Téléphone perdu ? », format XXXXX-XXXXX, retour à l'application |
| **A04** Introduction du MFA | **Nouveau** : pourquoi, 3 étapes, « Commencer » ; le secret n'est créé qu'au clic |
| **A05, A06** QR code, clé manuelle, premier code | QR généré dans le navigateur, erreur « code invalide » en notice |
| **A07** Codes de secours | Affichage unique, copier (avec confirmation annoncée), télécharger, case obligatoire |
| **A08, A09** Mot de passe oublié, e-mail envoyé | Message identique pour toute adresse ; rappel 60 minutes, courriers indésirables |
| **A10, A11** Nouveau mot de passe, mot de passe modifié | **Règles visibles en direct** (annoncées « respectée / à respecter »), « toutes vos sessions ont été fermées » |
| **A12** Lien invalide ou expiré | Notice et bouton « Demander un nouveau lien » (réinitialisation) ; invitation : contacter un administrateur |
| **A13** Activation d'invitation | Mêmes champs et règles que A10 |
| **A14** Compte verrouillé | Message **générique** du serveur, identique pour tout échec (aucune énumération) + aide permanente sous le formulaire |
| **A15** Trop de tentatives | Notice d'avertissement, bouton désactivé avec compte à rebours (60 s) |

Composants partagés : `AuthLayout`, `AuthNotice`, `NewPasswordFields`, `useCooldown`, `authErrorMessage`.

## Écart assumé avec le prototype
- **Nombre de codes de secours restants** (A03) non affiché : l'API ne le fournit pas (dette D39).
- Les contrôles de formulaire gardent le style « legacy » aux jetons du design (dette D32).
- Le code à 6 chiffres est en **six cases**, comme le prototype (DDR-0009, qui remplace DDR-0008 : décision de la direction produit du 2026-10-22). Les codes de secours gardent un champ unique.

## Preuves
| Contrôle | Résultat |
|---|---|
| Tests de l'interface | **56 / 56** (43 + 13 : règles du mot de passe, erreurs d'authentification, limitation de débit, compte à rebours, saisie en six cases ; mutants tués) |
| Audit axe-core, navigateur réel | **29 états, 0 violation, 0 point à vérifier**, dont A15 en conditions réelles (6 échecs rapides → 429), connexion en **thème sombre**, saisie du code (A02) et code de secours (A03) après une vraie reconnexion |
| Politique de contenu (CSP) | **0 violation** |
| Saisie en six cases (navigateur réel) | « 481 » tapé au clavier → trois cases remplies, focus sur la quatrième ; deux Retour arrière → « 4 » ; première configuration du MFA réussie avec le code placé dans la première case (chemin de la saisie automatique) |
| Sécurité | **Aucune règle modifiée** : mêmes routes, mêmes messages du serveur (jamais enrichis côté interface), jeton de lien toujours lu dans le fragment puis effacé, secret MFA affiché une seule fois et effacé de la mémoire après confirmation |
| Défauts trouvés et corrigés en recette | Barres décoratives qui recouvraient le texte de la carte d'accueil ; titre de notice redondant (« Trop de tentatives » deux fois) |

Captures : `docs/accessibilite/h2a-captures/` (connexion en limitation de débit, connexion sombre, introduction du MFA, QR code, saisie du code, code de secours).

## Comportements modifiés à connaître
1. **MFA** : un utilisateur dont le MFA est déjà configuré doit désormais cliquer sur « Téléphone perdu ? » pour saisir un code de secours (avant : le même champ acceptait les deux).
2. **MFA, première configuration** : une page d'introduction précède le QR code ; recharger la page pendant la configuration renvoie à l'introduction (un nouveau secret est créé au prochain clic).

## Reste (H2b)
Sessions actives, historique des connexions (nouvelle route lisant le journal d'audit, visible par l'intéressé seulement — décisions CAD-H2-1 et 2), révocation avec confirmation (S01 à S03). Avis juridique sur les adresses IP et appareils à obtenir avant H2b (recommandé, non bloquant pour H2a). L'écoute avec un vrai lecteur d'écran (D31) reste à faire.

## Validation
Validée par la direction produit le 2026-10-22 (« Appliquez les 6 cases et validez H2a ») : fusion `--no-ff` dans `main`, étiquette `h2a-validated`. L'écoute avec un vrai lecteur d'écran (D31) doit couvrir le parcours des six cases (collage, saisie automatique, navigation).
