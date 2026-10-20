# Vision Produit — Investally Business Platform

> Statut : brouillon Sprint 0. Éléments marqués (H) = hypothèses à confirmer.

## Énoncé de vision
Donner à Investally et à Investudy **une seule source de vérité traçable** pour mener un prospect, depuis l'identification de l'entreprise cible jusqu'à l'ambassadeur formé et certifié, et piloter l'entreprise (finances, RH, fiscalité, sécurité) à partir des mêmes données.

## Problème
Un parcours commercial long (≈ 15 étapes, plusieurs interlocuteurs, documents signés, relances) qui se perd dans des fichiers et messages dispersés : pas de vue du pipeline, des relances oubliées, aucune preuve opposable des actions, une direction qui reconstruit les chiffres à la main.

## Utilisateurs et besoins principaux
| Rôle | Besoin n°1 |
|---|---|
| AccountManager | Savoir quoi faire aujourd'hui (relances, RDV) et faire avancer ses opportunités |
| HeadOfSales | Voir le pipeline global et la performance de l'équipe, prévoir |
| Investudy / Formateur | Planifier sessions, salles, présences, certifications |
| Finance | Facturer, encaisser, suivre trésorerie et fournisseurs |
| RH | Contrats, congés, absences |
| Fiscalité | Ne manquer aucune échéance (TVA, CNPS…) |
| Direction | Vue 360° fiable |
| SuperAdmin / Sécurité | Qui a fait quoi, quand, d'où |

## Principes
1. **Le parcours commercial est le cœur** ; les autres modules sont construits à son service, dans l'ordre de valeur.
2. **Tout est traçable** : aucune action sensible sans audit.
3. **Simple d'abord** : on construit ce que la charge et le métier justifient ; chaque abstraction doit mériter sa place.
4. **Le métier survit aux frameworks** : Domain pur, migrable vers .NET.
5. **Sécurité par défaut** : moindre privilège, MFA, journaux immuables.

## Hors périmètre v1 (H)
Paiement en ligne, rapprochement bancaire automatique, télé-déclaration fiscale directe, portail apprenant/client externe, application mobile, paie complète.

## Critères de succès (à mesurer, H)
- 100 % des offres déposées ont une décharge ou une relance planifiée.
- Pipeline consultable en < 2 s, sans export manuel.
- Toute action sensible reconstituable (qui/quand/d'où/avant/après) en < 5 min.
- Aucune échéance fiscale manquée sans alerte préalable.
- Les règles d'architecture passent en CI à chaque merge.

## Parcours cible
Entreprise cible → contact → offre → décharge → relances → RDV DAF → RDV décideur → visite Investally → accord de principe → agrément formation → inscription → session → formation → certification/attestation → suivi post-formation → ambassadeur.
