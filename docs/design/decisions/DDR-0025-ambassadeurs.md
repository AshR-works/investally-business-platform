# DDR-0025 — Ambassadeurs : clients ou apprenants devenus relais commerciaux

| | |
|---|---|
| **Statut** | Acceptée (réalisée dans l'application) ; prototype à mettre à jour |
| **Date** | 2026-11-08 |
| **Version du design** | 0.4.1 (le prototype n'est pas encore à jour : version 0.5.0 à décider) |
| **Lié à** | Lot S4.4b ; wireframe 24 ; cas d'usage CU-F2-06 ; flux F2 ; décision 11 (création manuelle) et D40 |

## Contexte
Un client satisfait, ou un apprenant formé, peut devenir un **relais commercial** d'Investally : un ambassadeur. La décision d'origine (registre, n° 11) est que **le chargé de compte le crée à la main** ; une certification ne fera que le **suggérer**, plus tard. Ce lot construit la liste, la fiche et la création manuelle. Les suggestions attendent le module Investudy (certifications, S5.3). Les valeurs retenues sont **à confirmer** (D40).

## Décisions
1. **Où** : une page « Ambassadeurs » (module du hub livré) avec un tableau (ambassadeur, origine, entreprise, depuis, e-mail, téléphone), recherche, filtre par origine, pagination, « Nouvel ambassadeur » et « Modifier » dans des fenêtres.
2. **Création toujours manuelle** : jamais automatique. La page le rappelle.
3. **Champs** : nom, prénom, **origine** (client ou apprenant), entreprise, e-mail, téléphone, **depuis le** (jamais dans le futur) et une note de 500 caractères.
4. **Origine et entreprise** : un ambassadeur **client est toujours rattaché à son entreprise** (choisie parmi celles de la portée du créateur) ; un **apprenant** peut n'en avoir aucune. L'**origine ne change jamais** après la création.
5. **E-mail unique** : une même adresse ne sert qu'à **un** ambassadeur (conflit lisible).
6. **Responsable et portée** : l'ambassadeur appartient au **chargé de compte qui l'a créé**. Le chargé de compte voit **les siens** ; le Responsable commercial et la Direction voient **tous** (matrice de droits existante).
7. **Droits** : créer : chargé de compte, Responsable commercial ; **modifier : Responsable commercial seulement** (Équipe) ; lire : chargé de compte (Propre), Responsable commercial et Direction (Tous). Aucune nouvelle permission.
8. **Audit** : création et modification tracées (ancienne et nouvelle valeur, session). Pas de suppression ni de fin d'ambassade dans cette version.

## Mesures de rigueur
- La base garantit : un client est rattaché à une entreprise ; nom et prénom non vides ; un e-mail n'appartient qu'à un ambassadeur ; version positive ; entreprise existante (vérifié par des écritures directes refusées).
- Les règles (origine, entreprise, dates, e-mail, portée, droits, version) sont couvertes par des tests unitaires et d'intégration ; des fautes injectées sont toutes détectées (voir la recette).
- Les mêmes règles de saisie sont comparées entre l'interface et le **domaine réel** du serveur.
- Le contrat anti-IDOR est étendu aux deux routes « objet » (lecture, modification).

## Conséquences
- Réversible : une migration (une table), un module, trois composants et une page.
- **Dette** : D118 à D124 (`docs/TECH-DEBT.md`). Le bandeau « suggestions après certification » du wireframe 24 n'est pas construit (D118).
