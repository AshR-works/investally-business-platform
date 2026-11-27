# Arbitrage — Finance : où et quand construire la tranche budgets et dépenses

*2026-11-26 · Méthode : [METHODE-D-ARBITRAGE](../METHODE-D-ARBITRAGE.md). **Décision laissée à la Direction produit.** Les notes sont des jugements de l'équipe technique, à contester. Suite de D80.*

> **Précision du 2026-11-27 (D81) :** la RH réorganisée sera mise en production avant Finance. Le choix de l'emplacement (A, B ou C) reste ouvert.

## 1. La question
La restructuration en plateformes n'est pas décidée et le développeur est seul. Où vit la première tranche, et quand démarre-t-elle ?

## 2. Options
| | Principe | Réversibilité |
|---|---|---|
| **A. Module dans l'application actuelle** | Module `finance` isolé (schéma propre, interface publique, droits propres), extractible ensuite | Bonne |
| **B. Application séparée dès maintenant** | Nouvelle application et nouvelle base ; identité commune à construire d'abord | Faible |
| **C. Après la restructuration (statu quo)** | Rien avant les arbitrages de restructuration et l'identité commune | Totale |

## 3. Grille (poids de 1 à 5, notes de 1 à 5, maximum 100)
| Critère (poids) | A | B | C |
|---|---|---|---|
| Délai avant un résultat utile (5) | 5 | 2 | 1 |
| Charge pour un développeur seul (5) | 4 | 1 | 3 |
| Réemploi de l'existant (4) | 5 | 2 | 4 |
| Respect de la séparation des applications (4) | 2 | 5 | 4 |
| Absence de reprise ultérieure (2) | 3 | 4 | 5 |
| **Total** | **79** | **51** | **62** |

Totaux recalculés : A = 25 + 20 + 20 + 8 + 6 ; B = 10 + 5 + 8 + 20 + 8 ; C = 5 + 15 + 16 + 16 + 10.

## 4. Risques de A
- Le DG veut des applications qui ne s'exposent pas les unes aux autres : un module partagé **ne le garantit pas**. À lui dire, avec une date de réexamen.
- Dette d'extraction si la séparation est ensuite retenue.
- L'application actuelle n'est pas en production : l'hébergement, les sauvegardes et la relève sont à régler avant de lui confier des dépenses réelles.
- La réorganisation du CRM et de la RH prend du retard.

## 5. Recommandation
**Option A**, sous réserve que le DG accepte une séparation différée.

## 6. Décision attendue
**Réponse courte** : « A », « B » ou « C ».

Sous-décisions :
1. La tranche passe-t-elle **avant** la réorganisation du CRM et de la RH ?
2. Le DG accepte-t-il une séparation différée (option A) ?
