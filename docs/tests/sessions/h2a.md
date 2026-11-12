# Fiche de test — H2a — Écrans d'accès au nouveau style

| | |
|---|---|
| **Session** | `h2a` |
| **Recette de référence** | [`SPRINT-H2A-RECETTE.md`](../../SPRINT-H2A-RECETTE.md) |
| **Étiquette** | `h2a-validated` |
| **Contexte** | Branche `sprint/h2a-ecrans-d-acces` · 2026-10-22 · décision : CAD-H2-3 option B (deux lots) — H2a = écrans A01 à A15, H2b = sessions et historique (S01 à S03). **L'API n'est pas modifiée. |
| **Écrans concernés** | [Connexion](../interfaces/01-connexion.md), [Second facteur (MFA)](../interfaces/02-second-facteur.md), [Mot de passe oublié](../interfaces/03-mot-de-passe-oublie.md), [Nouveau mot de passe](../interfaces/04-nouveau-mot-de-passe.md), [Activation d'une invitation](../interfaces/05-activation-invitation.md) |

*Fiche de session de la [charte de tests](../../CHARTE-DE-TESTS.md), **dérivée de la recette** du lot : en cas de doute, la recette fait foi. Elle sert à rejouer la recette utilisateur et à vérifier l'absence de régression.*

## Avant de commencer
- Pile locale lancée (`node scripts/local-stack.mjs --demo`) ou pile jetable ; comptes de démonstration (mots de passe dans le fichier local, jamais dans le dépôt).
- Rôles utiles : chargé de compte, Responsable commercial (avec son équipe), Direction, Super administrateur.

## Vérifications à rejouer
| N° | Vérification | Résultat attendu (d'après la recette) | Constaté (✔ / ✘) | Date et initiales |
|---|---|---|---|---|
| 1 | A01 Connexion | Gabarit du design (carte d'accueil sombre, logo, indicateur d'étape 1 sur 2), notice d'erreur | ☐ | |
| 2 | A02 Code du second facteur | **Six cases** (DDR-0009) : focus automatique, collage, saisie automatique, Retour arrière, flèches ; étape 2 sur 2 | ☐ | |
| 3 | A03 Code de secours | Bascule « Téléphone perdu ? », format XXXXX-XXXXX, retour à l'application | ☐ | |
| 4 | A04 Introduction du MFA | **Nouveau** : pourquoi, 3 étapes, « Commencer » ; le secret n'est créé qu'au clic | ☐ | |
| 5 | A05, A06 QR code, clé manuelle, premier code | QR généré dans le navigateur, erreur « code invalide » en notice | ☐ | |
| 6 | A07 Codes de secours | Affichage unique, copier (avec confirmation annoncée), télécharger, case obligatoire | ☐ | |
| 7 | A08, A09 Mot de passe oublié, e-mail envoyé | Message identique pour toute adresse ; rappel 60 minutes, courriers indésirables | ☐ | |
| 8 | A10, A11 Nouveau mot de passe, mot de passe modifié | **Règles visibles en direct** (annoncées « respectée / à respecter »), « toutes vos sessions ont été fermées » | ☐ | |
| 9 | A12 Lien invalide ou expiré | Notice et bouton « Demander un nouveau lien » (réinitialisation) ; invitation : contacter un administrateur | ☐ | |
| 10 | A13 Activation d'invitation | Mêmes champs et règles que A10 | ☐ | |
| 11 | A14 Compte verrouillé | Message **générique** du serveur, identique pour tout échec (aucune énumération) + aide permanente sous le formulaire | ☐ | |
| 12 | A15 Trop de tentatives | Notice d'avertissement, bouton désactivé avec compte à rebours (60 s) | ☐ | |

## Preuves automatisées relevées à la validation
| Contrôle | Résultat |
|---|---|
| Tests de l'interface | **56 / 56** (43 + 13 : règles du mot de passe, erreurs d'authentification, limitation de débit, compte à rebours, saisie en six cases ; mutants tués) |
| Audit axe-core, navigateur réel | **29 états, 0 violation, 0 point à vérifier**, dont A15 en conditions réelles (6 échecs rapides → 429), connexion en **thème sombre**, saisie du code (A02) et code de secours (A03) après une vraie reconnexion |
| Politique de contenu (CSP) | **0 violation** |
| Saisie en six cases (navigateur réel) | « 481 » tapé au clavier → trois cases remplies, focus sur la quatrième ; deux Retour arrière → « 4 » ; première configuration du MFA réussie avec le code placé dans la première case (chemin de la saisie automatique) |
| Sécurité | **Aucune règle modifiée** : mêmes routes, mêmes messages du serveur (jamais enrichis côté interface), jeton de lien toujours lu dans le fragment puis effacé, secret MFA affiché une seule fois et effacé de la mémoire après confirmation |
| Défauts trouvés et corrigés en recette | Barres décoratives qui recouvraient le texte de la carte d'accueil ; titre de notice redondant (« Trop de tentatives » deux fois) |

## Réserves, limites et dette connues
- **Nombre de codes de secours restants** (A03) non affiché : l'API ne le fournit pas (dette D39).
- Les contrôles de formulaire gardent le style « legacy » aux jetons du design (dette D32).
- Le code à 6 chiffres est en **six cases**, comme le prototype (DDR-0009, qui remplace DDR-0008 : décision de la direction produit du 2026-10-22). Les codes de secours gardent un champ unique.

## Rejouer les contrôles automatisés
```bash
pnpm ci                                   # types, architecture, tests unitaires et interface
node apps/api/scripts/test-db.mjs     # tests d'intégration (base PostgreSQL jetable)
```

*Pas de script de mutants versionné pour ce lot.*

## Écarts constatés
| Date | Vérification n° | Description | Défaut ouvert (D…) |
|---|---|---|---|
| | | | |
