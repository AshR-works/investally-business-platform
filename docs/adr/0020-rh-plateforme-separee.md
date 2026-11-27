# ADR-0020 — Ressources humaines : une plateforme séparée

| | |
|---|---|
| **Statut** | Accepté pour le principe et le périmètre (2026-11-27, réponses d'Henri Bebey, D81). **Adressage, parcours d'entrée, architecture, administration et échanges : non décidés.** Direction générale et RH non consultées sur ce périmètre. |
| **Contexte** | Après la démonstration du 2026-11-25, la Direction générale a demandé des applications distinctes ; la RH est attendue autour de l'organigramme, des absences et des demandes de formation externes. Développeur seul. |
| **Lié à** | ADR-0009 (RH légère dans le CRM, remise en cause), [analyse des dépendances](../cadrages/ANALYSE-DEPENDANCES-RH.md), [arbitrage d'adressage](../cadrages/ARBITRAGE-ADRESSAGE-ET-ISOLATION-DES-APPLICATIONS.md), [parcours d'entrée](../cadrages/ARBITRAGE-PARCOURS-D-ENTREE-AUX-APPLICATIONS.md), D191, D192 |

## Options considérées
1. RH réorganisée dans l'application actuelle (proposée par l'équipe pour ouvrir plus tôt).
2. **RH en plateforme séparée.**

## Décision
- La RH devient une **plateforme séparée**, avec une navigation autour de l'organigramme, des absences et des demandes de formation.
- **Première mise en production sans les demandes de formation** (D192).
- Contrats, parcours et présences **non repris** dans cette première version ; à proposer à la RH et au DG (D191).
- Ordre de mise en production : la RH réorganisée, puis Finance quand le responsable des affaires financières et le RCCI la jugent opérationnelle.

## Conséquences
- (+) Périmètre de la première version fermé ; données du personnel isolées.
- (−) Une identité commune doit exister avant la mise en production : elle n'est pas conçue.
- (−) Finance ne sera mise en production qu'après la RH.
- (−) Fonctions déjà construites indisponibles tant qu'elles ne sont pas reprises.

## Avant tout code
Trancher les arbitrages ci-dessus, et obtenir l'avis de la RH et du DG sur le périmètre.
