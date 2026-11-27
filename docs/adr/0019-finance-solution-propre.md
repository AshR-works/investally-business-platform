# ADR-0019 — Finance : une solution propre, en commençant par les budgets et les dépenses

| | |
|---|---|
| **Statut** | Accepté (2026-11-26, Direction générale, rapporté et confirmé par Henri Bebey, D80). Emplacement de l'application : **non décidé**. |
| **Contexte** | L'entreprise n'utilise pas Sage. La Direction générale l'a envisagé puis préfère une solution propre : modularité, personnalisation, payer moins, maîtriser les dépenses. Développeur seul. |
| **Lié à** | ADR-0005 (à revoir : il regroupait Finance, RH et Fiscalité dans un ERP), [arbitrage construire ou acheter](../cadrages/ARBITRAGE-FINANCE-CONSTRUIRE-OU-ACHETER.md), [architecture cible](../cadrages/FINANCE-02-ARCHITECTURE-CIBLE.md) |

## Options considérées
1. Statu quo.
2. Acheter un logiciel.
3. Hybride, recommandé par l'équipe avant cette décision.
4. **Construire.**

## Décision
**Construire**, par tranches. Première tranche : **budgets et dépenses**. Aucune écriture au grand livre dans cette tranche ; le grand livre fera l'objet d'une étape et d'une validation distinctes (responsable des affaires financières et RCCI).

## Conséquences
- (+) Outil ajusté aux circuits de l'entreprise ; premier résultat utile sans attendre la comptabilité.
- (−) La conformité, la maintenance et les évolutions fiscales reposent sur l'entreprise.
- (−) Le motif « payer moins » reste à démontrer : le coût sur cinq ans n'est pas chiffré.
- (−) Dépendance à un développeur seul.
- Pour garder la suite possible : chaque dépense porte dès le début sa pièce, son budget et un export exploitable par la comptabilité.

## À revoir si
Le coût chiffré sur cinq ans dépasse celui d'une solution du marché, ou si le grand livre ne peut pas être validé.
