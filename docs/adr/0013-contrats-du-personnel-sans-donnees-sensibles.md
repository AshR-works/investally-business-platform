# ADR-0013 — Contrats du personnel, sans donnée sensible

| | |
|---|---|
| **Statut** | Accepté (2026-11-11, décision D67 de la Direction produit : « Lançons RH-3 », puis « applique les recommandations »). |
| **Contexte** | La RH légère (ADR-0009) a un annuaire et des absences. Il manque le suivi des contrats : quel type, depuis quand, jusqu'à quand, quelle période d'essai, et comment ils se terminent. D64 (option C) a retenu « contrats et parcours » sans salaire, sans pièces et sans donnée sensible. |
| **Lié à** | ADR-0009, D57 (identité professionnelle seulement), D64, D11 et D65 (données personnelles), `docs/cadrages/CADRAGE-RH-COMPLETE.md` |

## Options considérées
1. **Statu quo** : pas de suivi des contrats dans la plateforme. Les échéances restent dans des tableurs, sans trace ni droits.
2. **Contrat complet** (salaire, avenants, pièces, motifs libres) : utile, mais ce sont des données sensibles qui attendent l'avis juridique (D57, D65). Écartée.
3. **Contrat minimal, paramétrable et sans donnée sensible (retenue).**

## Décision
- **Types de contrat paramétrables par la RH** (`hr.contract_types`) : départ CDI, CDD, Stage, Prestation ; chaque type dit seulement s'il a **une date de fin obligatoire** (durée déterminée) ou **jamais** (durée indéterminée). Un type ne se supprime pas, il se **désactive** ; le code et la nature ne changent pas. **Aucune règle légale n'est codée** (durée maximale d'un CDD, plafond d'une période d'essai, renouvellements) : elles relèvent du droit applicable et du règlement intérieur (dette D180).
- **Contrats successifs par employé, un seul en cours** : garanti par la base (**index unique partiel** sur l'employé pour l'état « en cours ») ET par le cas d'usage (verrou de la fiche de l'employé : deux créations simultanées se suivent, la seconde est refusée). Un nouveau contrat ne recouvre aucun contrat terminé et ne commence pas avant l'entrée de l'employé.
- **Champs** : type, début, fin (vide pour un contrat à durée indéterminée), fin de la période d'essai (dans le contrat), état (en cours ou terminé), date de fin effective et **motif de fin**. **Ni salaire, ni document, ni avenant, ni texte libre.**
- **Motif de fin = liste fermée** : fin du contrat à durée déterminée, fin de la période d'essai, démission, fin de mission, autre. Jamais un texte libre : on ne stocke pas ici un motif disciplinaire ou de santé.
- **Cycle** : créer → ajuster (prolonger la fin, déplacer la fin de la période d'essai ; le début ne change jamais) → terminer (une date entre le début et la fin prévue, un motif). Un contrat terminé est **conservé** et ne se modifie plus. Verrou optimiste par `version` ; audit avant / après à chaque écriture.
- **Droits** (`hr.contract.read`, `hr.contract.manage`) : la **RH** et le **Super administrateur** voient et gèrent tout (portée Tous) ; la **Direction** lit tout, sans écrire ; **chaque employé lit son propre contrat** (portée Propre) ; **les responsables et les collègues ne voient rien** (même un responsable direct). Hors périmètre, un contrat est « introuvable » (404), jamais « interdit ».
- **Échéances** : `GET /hr/contracts/deadlines?days=` (60 par défaut, 365 au plus) liste les contrats en cours dont la fin ou la fin de la période d'essai tombe dans la fenêtre, avec les jours restants ; portée Tous seulement. **Aucun courriel** (dette D181) : un écran, pas une notification.

## Conséquences
- (+) Les échéances de contrat sont visibles et tracées ; aucune donnée sensible n'entre dans la plateforme ; les règles d'intégrité tiennent même si l'application est contournée (tests sur la base).
- (+) Un nouveau type de contrat se crée sans livraison.
- (−) **Dette D179** : ni salaire, ni document, ni avenant ; toute extension attend l'avis juridique et une nouvelle décision.
- (−) **Dette D180** : aucune règle légale codée ; la RH reste responsable de la conformité (durée maximale, essai, renouvellement) jusqu'à validation par un juriste.
- (−) **Dette D181** : pas de notification d'échéance ; fin de contrat et départ de l'employé (archivage) restent deux gestes séparés (le parcours « Départ » de RH-3b les rapprochera).
- À revoir si : une règle légale doit être appliquée par la plateforme, si les avenants ou les documents deviennent nécessaires, ou si les responsables doivent voir l'échéance de leur équipe (nouvelle permission, jamais un élargissement de celle-ci).
