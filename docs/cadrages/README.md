# Cadrages des prochaines sessions

**Date** : 2026-10-21 · **Statut des documents** : **décidés le 2026-10-21** (les 11 recommandations ont été retenues par la direction produit) · **Méthode** : [METHODE-D-ARBITRAGE.md](../METHODE-D-ARBITRAGE.md) (options comparées, recommandation, décision laissée à la direction produit).

Chaque cadrage dit **ce que la session fait et ne fait pas**, **l'état de départ vérifié**, **les décisions à prendre** (avec options, grille calculée, risques, dette, recommandation) et **les critères de réussite**. Les décisions sont prises ; la réalisation démarre par H1.

## Ordre de réalisation (DEC-005, « Alternatif 1 »)
| Ordre | Session | Cadrage | Décisions à prendre |
|---|---|---|---|
| 1 | **H1** Habillage minimal et hub | [CADRAGE-H1-HABILLAGE-ET-HUB.md](CADRAGE-H1-HABILLAGE-ET-HUB.md) | CAD-H1-1 à 4 |
| 2 | **H2** Authentification complète et sessions | [CADRAGE-H2-AUTHENTIFICATION-ET-SESSIONS.md](CADRAGE-H2-AUTHENTIFICATION-ET-SESSIONS.md) | CAD-H2-1 à 3 |
| 3 | **S3.6** Documents | [CADRAGE-S3-6-DOCUMENTS.md](CADRAGE-S3-6-DOCUMENTS.md) | CAD-S36-1 à 3 (+ 3 questions) |
| 4 | **Cadrage UX** (5 écrans clés) | [CADRAGE-UX-5-ECRANS-CLES.md](CADRAGE-UX-5-ECRANS-CLES.md) | CAD-UX-1 (+ choix des 5 écrans) |
| 5+ | S4.1 à S4.4, S5, S6, Stocks, S7 | *Cadrages à produire au fil de l'eau* | — |

| — | **Arbitrage** données de l'API des entreprises | [ARBITRAGE-API-DONNEES-ENTREPRISES.md](ARBITRAGE-API-DONNEES-ENTREPRISES.md) | ARB-API-1 à 4 (**à décider**) |

## Recommandations en un coup d'œil
| Décision | Recommandation | Note |
|---|---|---|
| CAD-H1-1 Technique de style | A Tailwind v4 (essai isolé d'abord) | grille quasi à égalité avec B (3,62 / 3,67) |
| CAD-H1-2 Périmètre | A coque + hub | |
| CAD-H1-3 Contenu du hub | A actifs + « à venir » | pas de donnée fictive |
| CAD-H1-4 Recherche globale | A côté interface | |
| CAD-H2-1 Historique | A journal d'audit | vérifier les échecs rattachables |
| CAD-H2-2 Visibilité | A le sien uniquement | |
| CAD-H2-3 Découpage | B deux lots | |
| CAD-S36-1 Stockage | B port + disque local, S3 en S7.1 | dette à inscrire |
| CAD-S36-2 Antivirus | A base, antivirus en S7 (bloquant production) | |
| CAD-S36-3 Droits | A portée de l'objet propriétaire | |
| CAD-UX-1 Format | A atelier de 90 minutes | |

Ces recommandations ont été **retenues** le 2026-10-21. Les notes de chaque grille sont mon jugement avec les poids standard de la méthode (5, 5, 4, 4, 3) ; vous pouvez les modifier et je recalcule.

## Points hors cadrage qui restent ouverts (Étape 0 et suivants)
| Sujet | Bloque | Statut |
|---|---|---|
| Accès Microsoft 365 | Mise en production (S7.2) | Ajourné le 2026-10-21 (abonnement non réglé) |
| Deux SuperAdmins nommés | Mise en production | À fournir |
| Avis juridique : audit 10 ans, données personnelles (IP, appareils), suivi des performances (DEC-006) | S6.3 et H2b | À obtenir |
| Écoute avec un vrai lecteur d'écran (D31) | Recommandée avant H2 | Protocole prêt : `docs/accessibilite/PROTOCOLE-LECTEUR-D-ECRAN.md` |
| Précisions sur l'agrément | S4.4 | À préciser |
| D16 (MFA récent pour changement de responsable), périmètre de l'agenda, rôle Logistique, catégories d'incidents, durée d'historique | S4 à S6 | Ouverts |
| Logos SVG officiels, variante sombre | Mise en ligne | À fournir |

## Décision
Le 2026-10-21, la direction produit a retenu **toutes les recommandations** (réponse au lot de 11 décisions). Elles sont enregistrées dans `docs/QUESTIONS-ET-DECISIONS.md` (D19) et dans le plan.
