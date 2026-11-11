# ADR-0011 — Apprenant sans entreprise et payeur désigné

| | |
|---|---|
| **Statut** | Accepté (2026-11-11, décision D65 de la Direction produit : « applique les recommandations », option C). **Amende** le modèle des apprenants et des inscriptions (S5.2b, D47, D49). |
| **Contexte** | Un apprenant dépendait obligatoirement d'une entreprise (`company_id` non nul) et chaque inscription consommait l'agrément de cette entreprise. La Direction veut inscrire des **étudiants** et des **particuliers**, qui règlent eux-mêmes ou dont un tiers règle les frais. Les apprenants n'ont **pas accès à la plateforme** : ce sont des fiches saisies par les employés. |
| **Lié à** | [ARBITRAGE du 2026-11-11 (réponse dans le registre, D65)](../QUESTIONS-ET-DECISIONS.md), S5.2b, ADR-0009 (même principe : pas de clé étrangère entre schémas) |

## Options considérées
1. **Statu quo** : un particulier ne peut pas être inscrit. Ne répond pas au besoin.
2. **A, inscription libre** : apprenant sans entreprise ni agrément, aucune trace de qui paie. Perd l'information voulue.
3. **B, suivi simple** : montant dû et état « à régler / réglé » saisis à la main. Fait doublon avec le futur module Facturation et paiements.
4. **C, payeur désigné (retenue)** : l'apprenant sans entreprise a, à chaque inscription, un payeur (lui-même ou un tiers nommé) et un montant dû ; aucun suivi de règlement.

## Décision
- **Nature de l'apprenant** : `COMPANY` (cas général), `STUDENT` ou `INDIVIDUAL`. Un étudiant ou un particulier n'a **ni entreprise ni contact** ; la **base** garantit la cohérence (`learners_kind_company_coherent`).
- **Inscription, deux formes jamais mélangées** : sous l'**agrément** d'une entreprise (entreprise, agrément, aucun payeur) **ou** sans entreprise (ni entreprise ni agrément, **un payeur désigné** et **le montant dû = prix complet du certificat**, obligatoire). La base le garantit (`enrollments_payer_coherent`) ; un certificat sans prix complet ne s'inscrit pas.
- **Payeur** : `SELF` (l'apprenant lui-même, sans nom) ou `THIRD_PARTY` (nom de 200 caractères au plus **et** nature : employeur, organisme, bailleur, famille ou proche).
- **Visibilité** : un étudiant ou un particulier n'a pas de responsable commercial. Il est traité comme un objet **sans propriétaire** : la règle d'accès existante l'autorise **seulement avec la portée Tous**, et le refuse (« introuvable ») aux portées Propre et Équipe. Aucune nouvelle permission, aucune règle d'accès nouvelle.
- Les apprenants et inscriptions existants gardent leur sens (`kind = COMPANY`, aucun payeur). Aucune clé étrangère vers un autre schéma.

## Conséquences
- (+) Le besoin est couvert sans modifier les agréments ni le module commercial ; les contrôles de places, de recouvrement et de doublon restent communs.
- (+) Le montant dû et le payeur sont prêts pour la facturation future.
- (−) **Dette D175** : le règlement n'est pas suivi (montant dû seulement) et le prix est le prix complet, sans tarif étudiant ; **D176** : un chargé de compte ou un Responsable commercial ne voit pas les étudiants et particuliers (pas de propriétaire).
- À revoir si : le module Facturation et paiements arrive (relier le payeur aux factures), ou si un tarif étudiant est fourni.
