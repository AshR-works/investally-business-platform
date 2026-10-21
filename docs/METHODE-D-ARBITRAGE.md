# Méthode d'arbitrage décisionnel

**Statut** : méthode **permanente**, adoptée le 2026-10-21 sur demande de la direction produit. **Dorénavant, toute décision structurante du projet Investally suit cette méthode.**
**Principe fondateur** : l'équipe projet **éclaire**, la direction produit **décide**. Je ne prends jamais une décision à votre place ; je présente des options comparables, une recommandation argumentée et ses conséquences.

## 1. Quand l'appliquer
Dès qu'un choix est **structurant** : navigation, architecture, périmètre, ordre de réalisation, rattachement d'un module, donnée sensible, dépendance externe, changement de méthode. Les choix mineurs (couleur d'un badge, libellé) n'en relèvent pas : ils sont tranchés dans le registre des exigences.

## 2. Le gabarit (toujours le même)
| # | Rubrique | Contenu attendu |
|---|---|---|
| 1 | **Contexte** | La question, pourquoi maintenant, ce qui est déjà décidé et ne bouge pas |
| 2 | **Options** | Au moins deux options réelles, dont le **statu quo** ; une option « autre » si pertinente |
| 3 | Pour chaque option | **Avantages** · **Inconvénients** · **Impacts UX** · **Impacts métier** · **Impacts techniques** · **Impacts maintenance** · coût et délai · **réversibilité** |
| 4 | **Grille de comparaison** | Critères notés de 1 (défavorable) à 5 (favorable), avec leur poids (voir §3) |
| 5 | **Risques** | Ce qui peut mal tourner, probabilité, impact, parade |
| 6 | **Dette induite** | Ce que l'option laisse à rembourser plus tard |
| 7 | **Recommandation** | L'option que je choisirais, **les raisons**, les conditions, ce qui la ferait changer d'avis |
| 8 | **Décision** | **Laissée à la direction produit** : date, option retenue, motif, réserves |
| 9 | **Trace** | Enregistrement dans `QUESTIONS-ET-DECISIONS.md` et, pour le design, dans le registre des décisions de design |

## 3. Critères standard et pondération
Poids par défaut (à ajuster **avant** de noter, pas après) :
| Critère | Poids | Question posée |
|---|---|---|
| Valeur métier | 5 | Quel gain pour les utilisateurs et l'entreprise ? |
| Risque (sécurité, juridique, délai) | 5 | Qu'est-ce qui peut gravement mal tourner ? |
| Cohérence avec l'architecture et les décisions passées | 4 | Respecte-t-on les ADR et les exigences ? |
| Réversibilité | 4 | Combien coûte un retour en arrière ? |
| Coût et délai de réalisation | 3 | Combien de sprints ? |
| Coût de maintenance | 3 | Combien en année 2 ? |
| Expérience utilisateur | 4 | Gain ou perte de clarté et d'efficacité ? |
| Accessibilité et sécurité | 4 | Respecte-t-on WCAG AA et la politique de sécurité ? |
Score pondéré = Σ (note × poids) ; il **aide**, il ne remplace pas le jugement : un risque rédhibitoire l'emporte sur un bon score.

## 4. Règles de rigueur
1. **Statu quo toujours présenté**, avec son coût réel.
2. **Aucune option de façade** : chacune doit être défendable.
3. **Faits vérifiés distingués des hypothèses** ; les hypothèses sont étiquetées.
4. **Réversibilité** explicitée (🟢 facile · 🟡 moyenne · 🔴 coûteuse).
5. **Dissensus assumé** : si je recommande contre une exigence existante, je le dis et je n'applique pas avant votre réponse.
6. **Une décision n'est jamais effacée** : si elle change, on ajoute « remplacée par ».

## 5. Modèle de fiche de décision (à copier)
```
# DEC-NNN — <titre>
Date : AAAA-MM-JJ · Demandeur : … · Statut : Ouverte | Décidée | Remplacée
## Contexte
## Options (A, B, C) — avantages / inconvénients / impacts UX, métier, technique, maintenance / réversibilité
## Grille pondérée
## Risques et dette induite
## Recommandation (argumentée)
## Décision de la direction produit : option …, motif …, réserves …
## Suites : documents et exigences mis à jour
```

## 6. Application
La première application de cette méthode est [docs/design/05-AIDE-A-LA-DECISION.md](design/05-AIDE-A-LA-DECISION.md) (navigation, opportunités, stocks, ordre de réalisation, versionnement des livrables design).
