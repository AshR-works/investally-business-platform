# Arbitrage — Finance : construire ou acheter le cœur comptable

*2026-11-26 · Méthode : [METHODE-D-ARBITRAGE](../METHODE-D-ARBITRAGE.md). **Décision laissée à la Direction produit.** Les notes sont des jugements de l'équipe technique, à contester. Prix et fonctions des logiciels du marché non vérifiés.*

## 1. La question
Qui tient les livres comptables de référence : une application développée en interne, ou un logiciel existant relié à Investally ?

## 2. Contraintes
- Développeur seul ; conformité qu'il ne peut pas certifier.
- Exigences de l'AUDCIF sur l'informatique, art. 20 et 22 (voir [le référentiel](FINANCE-01-REFERENTIEL-REGLEMENTAIRE.md)).
- La demande vise une plateforme financière complète, familière aux utilisateurs de Sage.
- Inconnus : outil comptable actuel, tenue interne ou par un cabinet, volume, effectif finance, budget.

## 3. Options
| | Principe | Réversibilité |
|---|---|---|
| **0. Statu quo** | La comptabilité reste là où elle est ; rien n'est construit | Totale |
| **A. Acheter** | Un logiciel comptable SYSCOHADA fait tout le financier ; échanges par fichiers ou interface | Moyenne (reprise de données) |
| **B. Hybride** | Le logiciel tient les livres et les états ; Investally Finance porte les circuits (facturation liée au CRM, commissions, achats, approbations, budgets, pilotage) et lui transmet les écritures | Bonne : le grand livre interne reste possible plus tard |
| **C. Construire** | Tout est développé | Faible |

## 4. Grille (poids de 1 à 5, notes de 1 à 5, maximum 100)
| Critère (poids) | 0 | A | B | C |
|---|---|---|---|---|
| Sécurité de conformité (5) | 3 | 4 | 4 | 2 |
| Charge pour un développeur seul (5) | 5 | 4 | 3 | 1 |
| Délai avant un résultat utile (4) | 5 | 4 | 3 | 1 |
| Adéquation aux circuits Investally (3) | 1 | 2 | 4 | 5 |
| Maîtrise et évolution à long terme (3) | 1 | 2 | 4 | 5 |
| **Total** | **66** | **68** | **71** | **49** |

Totaux recalculés : 0 = 15 + 25 + 20 + 3 + 3 ; A = 20 + 20 + 16 + 6 + 6 ; B = 20 + 15 + 12 + 12 + 12 ; C = 10 + 5 + 4 + 15 + 15.

**Les trois premières options sont proches (66 à 71) : la grille ne les départage pas nettement.** Seule la construction complète décroche.

## 5. Risques et dette de B
- Deux systèmes à rapprocher : contrôle de concordance obligatoire.
- Dépendance aux formats d'import du logiciel choisi : à prouver sur un export réel avant de s'engager.
- Licences et accompagnement à chiffrer.
- Risque de dériver vers C par ajouts successifs : le grand livre reste hors périmètre sauf nouvelle décision.

## 6. Recommandation
**Option B**, à confirmer après deux vérifications : l'outil réellement utilisé aujourd'hui et un essai d'import. Si la comptabilité est tenue par un cabinet et que les volumes sont faibles, **0 ou A** peuvent être préférables. La [version 0 de l'architecture](FINANCE-02-ARCHITECTURE-CIBLE.md) décrit la cible complète ; avec A ou B, sa partie « grand livre » devient un cahier des charges pour choisir le logiciel.

## 7. Décision attendue
**Réponse courte** : « B », « A », « C » ou « 0 ».

Sous-décisions :
1. Quel outil comptable aujourd'hui, et qui tient les comptes ?
2. Statut réglementaire d'Investally (agréé, en cours, non agréé) ?
3. Investudy est-il une entité juridique distincte ?
4. Qui valide la conformité ?
5. Budget de licence envisageable ?
