# DDR-0009 — Code du second facteur en six cases

| | |
|---|---|
| **Statut** | Acceptée |
| **Date** | 2026-10-22 |
| **Version du design** | 0.4.1 (conforme au prototype) |
| **Lié à** | EXD-06 (écrans A02, A05, A06) ; remplace [DDR-0008](DDR-0008-champ-de-code-unique.md) |

## Contexte
L'implémentation de H2a avait retenu un champ unique pour le code à 6 chiffres (DDR-0008), écart signalé avec le prototype. La direction produit a demandé le retour aux **six cases** du prototype.

## Décision
**Option C de DDR-0008** : six cases pour le code à 6 chiffres ; **champ unique conservé pour les codes de secours** (format XXXXX-XXXXX).

## Mesures d'accessibilité et de robustesse prises
- Groupe nommé (« Code de vérification ») ; chaque case annoncée « Chiffre n sur 6 ».
- Focus automatique sur la case suivante ; Retour arrière sur une case vide recule et efface ; flèches gauche et droite.
- **Collage** du code entier (espaces et tirets ignorés) ; **saisie automatique** du code reçu sur la première case (`one-time-code`, longueur 6 acceptée sur cette case seulement).
- Logique de saisie isolée et testée (`lib/otp.ts`, 5 tests, mutants tués) ; saisie au clavier rejouée dans un navigateur réel (« 481 » → trois cases remplies, focus sur la quatrième ; deux Retour arrière → « 4 »).

## Conséquences
Réversible (un composant). Point d'attention : le lecteur d'écran lit six champs au lieu d'un ; l'écoute réelle prévue dans le protocole d'accessibilité (D31) doit vérifier ce parcours (collage, saisie automatique, navigation entre cases).
