# Cadrage UX — Séance sur 5 écrans clés (avant S4.1)

**Date** : 2026-10-21 · **Statut** : à décider · **Placement** : après S3.6, avant S4.1 (DEC-005).

> Méthode : [METHODE-D-ARBITRAGE.md](../METHODE-D-ARBITRAGE.md). **Aucune décision n'est prise dans ce document** : les recommandations sont des avis, la décision est celle de la direction produit.

## 1. Objet
Une séance courte, **avant S4.1**, pour valider la forme des écrans métier clés avant d'écrire leur code. Le but n'est pas de redessiner : le style est validé (v0.4.1). Il s'agit de décider **comment les écrans réels se comportent**.

## 2. Les cinq écrans proposés
Proposition de ma part, **à confirmer ou à remplacer** par vos priorités :

| # | Écran | Pourquoi maintenant | Existe au prototype |
|---|---|---|---|
| 1 | **Fiche entreprise** (vue 360° : contacts, offres, rendez-vous, documents, historique) | Cœur de S4.1 ; conditionne la navigation interne | Partiellement (liste seulement) |
| 2 | **Création / modification d'une entreprise et d'un contact** (formulaires, validation, doublons) | Premiers formulaires métier de S4.1 | Fenêtre générique |
| 3 | **Offres, décharges et relances** (S4.2) | Premier flux avec états et échéances | Non |
| 4 | **Opportunités** (cartes par 6, étapes, sélection) — décision DEC-003 | Écran le plus utilisé du commercial | Oui (v0.4.1) |
| 5 | **Agenda** (semaine, mois, création liée à une entreprise ou une opportunité) | S4.2b ; envie exprimée dès le début | Oui (v0.2.0) |

Réserve en attente : l'écran **Agrément** (S4.4) dépend de précisions métier sur l'agrément ; il est hors séance tant qu'elles manquent.

## 3. Questions à aborder par écran
- Quelles informations sont **indispensables au premier regard** ? Lesquelles sont secondaires ?
- Quelles **actions** sont fréquentes (à portée d'un clic) et lesquelles sont rares ?
- Quels **états vides, erreurs et chargements** doivent être soignés ?
- Quels **droits** changent ce qu'on voit (Propre / Équipe / Tous) ?
- Quelle **alternative clavier** pour toute interaction à la souris (glisser-déposer, vue « Par étape » : dette D30) ?
- Quels textes et libellés métier utilisez-vous réellement ?

## 4. Décision à prendre

### CAD-UX-1 — Format de la séance de cadrage UX

**Contexte.** DEC-005 prévoit une « séance courte sur 5 écrans clés, à partir des prototypes existants » avant S4.1, pour que chaque écran de S4 naisse dans le bon style et évite les refontes.

**Déjà décidé, ne bouge pas.** Style validé (design v0.4.1) ; prototypes existants (hub, agenda, entreprises, opportunités, formation, sécurité) ; EXD-01 à 11 ; pas de refonte complète.

**Options.**

**A. Atelier unique (≈ 90 minutes), en direct** — Vous et moi parcourons les 5 écrans sur le prototype et notons ensemble les ajustements.

| | |
|---|---|
| Avantages | Décisions rapides ; dialogue ; moins de risque de malentendu. |
| Inconvénients | Demande un créneau commun ; moins de temps pour réfléchir à chaque écran. |
| Impact UX | Retours précis et immédiats. |
| Impact métier | Implique la direction produit au bon moment. |
| Impact technique | Aucun. |
| Impact maintenance | Aucun. |
| Coût et délai | 1 séance |
| Réversibilité | Excellente. |

**B. Revue asynchrone : je prépare des variantes, vous annotez** — Pour chaque écran, je produis 2 variantes et un questionnaire ; vous répondez quand vous le pouvez.

| | |
|---|---|
| Avantages | Souple ; temps de réflexion ; traçable par écrit. |
| Inconvénients | Aller-retour plus longs ; risque de réponses partielles. |
| Impact UX | Retours réfléchis, parfois moins précis. |
| Impact métier | Aucun. |
| Impact technique | Production de variantes. |
| Impact maintenance | Aucun. |
| Coût et délai | ≈ 0,4 session + délais |
| Réversibilité | Excellente. |

**C. Pas de séance : on passe du prototype au code** — S4.1 démarre directement.

| | |
|---|---|
| Avantages | Aucune attente. |
| Inconvénients | Risque de refonte d'écrans après coup ; décisions de détail prises sans vous. |
| Impact UX | Écarts possibles avec vos attentes. |
| Impact métier | Aucun. |
| Impact technique | Aucun. |
| Impact maintenance | Reprises coûteuses. |
| Coût et délai | 0 |
| Réversibilité | Facile à abandonner. |

**Grille** (notes de 1 à 5, 5 = favorable ; poids fixés avant notation ; totaux calculés).

| Critère (poids) | A | B | C |
|---|---|---|---|
| Valeur métier (5) | 4 | 4 | 2 |
| Risque (favorable = faible) (5) | 4 | 4 | 3 |
| Cohérence architecture / décisions (4) | 4 | 4 | 3 |
| Réversibilité (4) | 5 | 5 | 4 |
| Coût et délai (favorable = faible) (3) | 4 | 3 | 5 |
| **Total sur 5** | **4,19** | **4,05** | **3,24** |

**Risques.**

| Risque | Probabilité | Impact | Parade |
|---|---|---|---|
| Retours trop tardifs (après le code) | Moyenne | Moyen | Séance avant S4.1, décisions consignées dans le registre du design |
| Périmètre qui s'élargit en séance | Moyenne | Faible | Ordre du jour fixe, hors-sujet consigné pour plus tard |

**Dette induite.** Aucune pour A et B si les décisions sont consignées (DDR).

**Recommandation.** Option **A** : les cinq écrans se décident vite à deux, et le temps gagné évite des refontes en S4. L'option B convient si votre emploi du temps l'impose.

**Décision (direction produit).** ☐ À renseigner : option retenue · date · motif · réserves.

**Trace.** À enregistrer dans `docs/QUESTIONS-ET-DECISIONS.md` (et, pour le design, dans `docs/design/decisions/`).

---

## 5. Ce que j'apporte et ce que j'attends
| Je prépare | J'attends de vous |
|---|---|
| Le prototype à jour pour les 5 écrans, captures clair/sombre | Confirmation des 5 écrans (ou remplacement) |
| Une fiche par écran : usage, données, droits, états, accessibilité | Vos priorités et vos cas d'usage réels |
| Une liste de questions précises | Un créneau (option A) ou des réponses écrites (option B) |

## 6. Sortie de la séance
Une **fiche de décision de design (DDR)** par sujet tranché, le **document de design mis à jour** (version 0.5.0 ou 0.4.2 selon l'ampleur), et une liste d'écrans prêts à coder pour S4.1.
