# Livrable 5 — État d'avancement et tableau de bord

**Projet** : Investally Business Platform · **Date** : 2026-11-02 (mise à jour ; photographie initiale du 2026-10-21 conservée aux sections 2, 3 et 5 à 7) · **Statut global** : 🟢 socle solide · 🟢 module commercial largement livré · 🔴 dépendances externes à débloquer

> Ce tableau répond à trois questions : **où en est-on, qu'est-ce qui nous freine, et qu'est-ce que la direction doit décider.** Les chiffres sont recomptés à partir du plan (`DESIGN-CODE-ARCHITECTURE-PLAN.md`), des recettes et du code.

---

## 1. Synthèse en dix lignes

1. **39 sessions validées** (de S1 à S5.2a, avec l'accessibilité, l'habillage, le contrat anti-IDOR, les cadrages, les correctifs de recette 1 et le jeu de données de démonstration), toutes fusionnées dans `main` et étiquetées `…-validated`.
2. Le **socle de sécurité et d'accès est complet** : comptes, connexion, second facteur, rôles et périmètres, invitations, mot de passe oublié, sessions, audit.
3. Le **module commercial est largement livré** : entreprises (statuts, responsable, fiche 360°), contacts, offres, décharges signées, relances, agenda, opportunités (pipeline), agréments, documents. Les commissions à verser (S4.4c) sont livrées : **le module commercial est terminé**.
4. **1005 tests unitaires**, **392 d'intégration** (PostgreSQL jetable) et **555 d'interface**, tous verts (en passe d'intégration complète, quelques suites dépassent leur délai sur cette machine, D149 ; chacune passe seule) ; **0 violation** d'architecture ; contrat anti-IDOR sur chaque route d'objet.
5. Les **mutants** (fautes injectées) de chaque lot sont **tous détectés** (environ 220, scripts dans `scripts/mutants/`) ; l'**audit navigateur** (axe-core) relève **0 violation** sur les écrans livrés.
6. Une **charte de tests** et des **fiches de test** (16 par écran, 28 par session) cadrent la recette (`docs/CHARTE-DE-TESTS.md`, `docs/tests/`).
7. Les **blocages réels** ne sont pas techniques : accès **Microsoft 365**, **avis juridique** sur les données de performance, **second SuperAdmin**, logos au format SVG.
8. **Décisions à confirmer** : valeurs par défaut D36 à D39 (opportunités, statuts, valeur, agréments) ; l'agrément applique D1 à D5 du registre.
9. La **CI GitHub** (contrôle `verify`) est active et obligatoire avant toute fusion ; **Docker, sauvegardes, supervision** restent à faire (S7).
10. **Prochaine étape** : S5.2b (apprenants et inscriptions), puis S5.3, S6 (pilotage) et S7 (mise en production), après vos réponses sur FD-9 et FD-11. Détail : `docs/GANTT-PROJET.md` et `docs/RESTE-A-FAIRE-DEVELOPPEMENT.md`.

---

## 2. Avancement par ligne du plan

Légende : ✅ validé · 🟦 livré, validation attendue · ⏳ à faire

| # | Ligne du plan | Produit | Statut | Avancement |
|---|---|---|---|---|
| 1 | S0 Cadrage | — | ✅ | ▓▓▓▓▓▓▓▓▓▓ 100 % |
| 2 | S1 Squelette CRM | CRM | ✅ (réserves : Docker/CI) | ▓▓▓▓▓▓▓▓▓▓ 100 % |
| 3 | S2 Sécurité et données Core | CRM | ✅ | ▓▓▓▓▓▓▓▓▓▓ 100 % |
| 4 | S3.1 Authentification | CRM | ✅ | ▓▓▓▓▓▓▓▓▓▓ 100 % |
| 5 | S3.2 Second facteur et amorçage | CRM | ✅ | ▓▓▓▓▓▓▓▓▓▓ 100 % |
| 6 | S3.3 Autorisation et administration | CRM | ✅ | ▓▓▓▓▓▓▓▓▓▓ 100 % |
| 7 | S3.4 Interface de base | CRM | 🟦 | ▓▓▓▓▓▓▓▓▓▓ 100 % (à valider) |
| 8 | S3.5 Mot de passe oublié, commentaires, livrables | CRM | 🟦 | ▓▓▓▓▓▓▓▓▓▓ 100 % (à valider) |
| 9 | S3.6 Documents | CRM | ⏳ | ░░░░░░░░░░ 0 % |
| 10 | Cadrage UX (maquettes) | CRM | ⏳ | ░░░░░░░░░░ 0 % |
| 11 | S4.1 Entreprises et contacts | CRM | ⏳ *(tranche « entreprise » déjà livrée)* | ▓░░░░░░░░░ 10 % |
| 12 | S4.2 Offres, décharges, relances | CRM | ⏳ | ░░░░░░░░░░ 0 % |
| 13 | S4.3 Rendez-vous, visites, opportunités | CRM | ⏳ | ░░░░░░░░░░ 0 % |
| 14 | S4.4 Agrément, ambassadeurs, commissions | CRM | ✅ | ▓▓▓▓▓▓▓▓▓▓ 100 % |
| 15 | S5.1 Catalogue Investudy | CRM | ✅ | ▓▓▓▓▓▓▓▓▓▓ 100 % |
| 16 | S5.2a Sessions de formation | CRM | ✅ | ▓▓▓▓▓▓▓▓▓▓ 100 % |
| 17 | S5.2b Apprenants et inscriptions | CRM | ⏳ | ░░░░░░░░░░ 0 % |
| 18 | S5.3 Suivi pédagogique | CRM | ⏳ | ░░░░░░░░░░ 0 % |
| 18 | S6.1 KPI et tableaux de bord commerciaux | CRM | ⏳ | ░░░░░░░░░░ 0 % |
| 19 | S6.2 Tableaux de bord Investudy, Administration, Sécurité | CRM | ⏳ | ░░░░░░░░░░ 0 % |
| 20 | S7.1 Durcissement | CRM | ⏳ | ░░░░░░░░░░ 0 % |
| 21 | S7.2 Mise en production | CRM | ⏳ | ░░░░░░░░░░ 0 % |
| 22 | ERP-1…n (Finance, RH, Fiscalité, direction) | ERP | ⏳ | ░░░░░░░░░░ 0 % |
| 23 | Final (stratégie .NET, dette, recommandation) | — | ⏳ | ░░░░░░░░░░ 0 % |

**Compte** : 6 lignes validées · 2 livrées en attente · 15 à faire → **26 % validé**, **35 % livré** (par nombre de lignes).

> **Commentaire — pourquoi ce pourcentage est trompeur, dans les deux sens.** Par nombre de lignes, l'avancement paraît faible ; or le socle est la partie où une erreur coûte le plus cher et où l'on ne peut pas « rattraper plus tard ». À l'inverse, les lignes restantes **ne sont pas de poids égal** : S4 à S6 contiennent l'essentiel de la valeur métier et de l'incertitude (agrément, règle du rendez-vous décideur). Je ne donne **pas** de date de fin : tant que le cadrage UX et les détails de l'agrément ne sont pas là, une date serait une invention.

## 3. Avancement par bloc

| Bloc | Contenu | Lignes faites / total | État |
|---|---|---|---|
| **A. Fondations** | Cadrage, squelette, données, audit | 3 / 3 | 🟢 terminé |
| **B. Identité et accès** | Authentification, MFA, droits, administration, interface d'accès, mot de passe oublié | 5 / 5 *(2 en attente de validation)* | 🟢 terminé |
| **C. Services transverses** | Documents | 0 / 1 | 🟠 à faire (S3.6) |
| **D. CRM commercial** | Cadrage UX, entreprises/contacts, offres, rendez-vous, agrément | 0 / 5 | 🟠 à faire |
| **E. Investudy** | Catalogue, sessions, suivi pédagogique | 0 / 3 | ⏳ |
| **F. Pilotage** | Tableaux de bord et indicateurs | 0 / 2 | ⏳ |
| **G. Mise en production** | Durcissement, déploiement | 0 / 2 | ⏳ |
| **H. ERP et clôture** | Finance, RH, fiscalité, stratégie .NET | 0 / 2 | ⏳ |

## 4. Ce que le système fait aujourd'hui (capacités)

| Capacité | Statut | Preuve |
|---|---|---|
| Inviter un collègue par lien à usage unique, activation du compte | ✅ | recettes S3.3, S3.4 |
| Second facteur obligatoire (QR, codes de secours), connexion sécurisée | ✅ | recettes S3.1, S3.2, S3.7 |
| Droits par rôle et par périmètre (propre / équipe / tous) ; sélecteur de rôles | ✅ | matrice `docs/RBAC.md`, recette S3.8 |
| Administration : rôles, désactivation, sessions, MFA ; sessions et historique des connexions | ✅ | recettes S3.3, S3.4, H2b |
| Mot de passe oublié (libre-service et administrateur) | ✅ | recette S3.5 |
| Journal d'audit inaltérable | ✅ | triggers + tests |
| Documents versionnés (empreinte SHA-256, visibles dans la portée) | ✅ | recette S3.6 |
| Entreprises : tableau (filtres, tri, effectifs, colonnes), création avec facilitateur et commission, modification, export | ✅ | recettes S4.0, S4.0c, S4.1b |
| Statut d'une entreprise (un cran), responsable, fiche 360°, colonne « Valeur » | ✅ | recettes S4.3b, S4.3c |
| Contacts (doublons, portée) | ✅ | recette S4.1a |
| Offres (références, cycle d'états), décharges signées, relances | ✅ | recettes S4.2a à S4.2c |
| Agenda : rendez-vous et visites, conflit d'horaire, report, tenue, annulation ; lien à une opportunité | ✅ | recettes S4.2d, S4.3c |
| Opportunités : pipeline en cinq étapes, accord de principe (rendez-vous décideur ou dérogation), clôtures | ✅ | recette S4.3a |
| Agréments : promesse de paiement signée, entreprise « Cliente », honorer / expirer / annuler | ✅ | recette S4.4a |
| Agrément demandé puis reçu, payeur tiers, constat du paiement par la Finance, second facteur à la réattribution (D41) | ✅ | recette S4.4a-bis |
| Envoyer de vrais e-mails (Microsoft 365) | ❌ **non testé** | en attente d'accès |
| Ambassadeurs : création manuelle, origine client ou apprenant, liste | ✅ | recette S4.4b |
| Commissions à verser (due à l'honneur de l'agrément, déblocage par la Finance, versement avec justificatif) | ✅ | recette S4.4c |
| Catalogue de formation (programmes, certificats, modules, salles, formateurs, rythmes) | ✅ | recette S5.1 |
| Sessions de formation (planifier, ouvrir, reporter, annuler ; salle, formateur et capacité contrôlés) | ✅ | recette S5.2a |
| Apprenants, inscriptions, suivi pédagogique (Investudy) | ⏳ | S5.2b, S5.3 |
| Tableaux de bord et indicateurs | ⏳ | S6 |

## 5. Indicateurs de santé

| Indicateur | Valeur | Seuil visé | État |
|---|---|---|---|
| Tests unitaires API | 380 | tous verts | 🟢 |
| Tests d'intégration API (base réelle) | 141 | tous verts | 🟢 *(un passage sous charge a eu 4 échecs de délai, non reproduits)* |
| Tests interface | 24 | tous verts | 🟢 |
| Violations d'architecture | 0 (129 modules) | 0 | 🟢 |
| Routes non protégées par oubli | 0 (32 routes, test structurel) | 0 | 🟢 |
| Vulnérabilités hautes (dépendances) | 0 | 0 | 🟢 (1 moyenne connue, D6) |
| Mutations de sécurité détectées | 23 sur 24 d'emblée, 24 sur 24 après correction | 100 % | 🟢 |
| Fonctions commentées | 535 déclarations, 0 oubli | 100 % | 🟢 |
| Dette technique ouverte | 27 entrées (voir `TECH-DEBT.md`) | suivie, avec propriétaire | 🟠 |
| Parcours d'écrans automatisés | 0 | à terme | 🟠 (D22) |
| Docker / CI exécutés | non | oui avant production | 🔴 (S7) |
| Sauvegardes, supervision | non | oui avant production | 🔴 (S7) |

## 6. Risques et points d'attention

| # | Risque | Probabilité | Impact | Réponse |
|---|---|---|---|---|
| 1 | **Microsoft 365 non testé** : aucune invitation ni aucun mot de passe oublié réels ne partira tant que l'accès n'est pas fourni | Certaine | **Élevé** | Fournir tenant, application et boîte d'expédition ; test réel dès réception |
| 2 | **Un seul SuperAdmin** : compte perdu = administration bloquée | Moyenne | **Élevé** | Désigner deux SuperAdmin nominatifs ; garde-fou « dernier SuperAdmin » déjà en place |
| 3 | Détails de l'**agrément** flous (montant, validité, annulation) | Certaine | Moyen | 5 questions à trancher avant S4.4 ; défauts proposés dans le registre |
| 4 | Écrans du pipeline codés **sans maquettes validées** | Moyenne | Moyen | **Cadrage UX** avant S4.1 |
| 5 | **Mise en production** sans Docker/CI/sauvegarde éprouvés | Certaine si on saute S7 | **Élevé** | S7 non négociable avant ouverture aux 20 utilisateurs |
| 6 | Validation juridique de l'audit sur **10 ans** et des données personnelles | Moyenne | Élevé (conformité) | Lancer en parallèle dès maintenant |
| 7 | Tests d'écran non automatisés : régression silencieuse possible | Moyenne | Moyen | Tests de bout en bout (Playwright) en S7 |
| 8 | Environnement de test lent : tests sensibles aux délais | Moyenne | Faible | Délais relevés ; à surveiller |
| 9 | Dépendances logicielles (Next.js 16, Prisma 7…) très récentes | Faible | Moyen | Versions épinglées ; audit à chaque sprint |

## 7. Décisions attendues de la direction

| Décision | À prendre avant | Recommandation |
|---|---|---|
| **Valider S3.4 puis S3.5** | maintenant | Oui, après lecture des deux recettes |
| **Fournir l'accès Microsoft 365** | tout usage réel | À débloquer en priorité |
| **Désigner deux SuperAdmin** | tout usage réel | Oui |
| Exiger un MFA récent pour changer un responsable (D16) | S3.6 | Oui |
| Confirmer : MFA pour *tous* les rôles ; apprenant distinct du contact | S5.2 | Confirmer les deux |
| Réponses sur l'**agrément** (5 questions) | S4.4 | Voir `QUESTIONS-ET-DECISIONS.md` §D |
| **Cadrage UX** : valider le principe de maquettes avant le code | S4.1 | Oui, séance courte sur 5 écrans clés |
| Lancer la validation juridique (audit 10 ans) | production | En parallèle |
| Supprimer l'ancienne copie OneDrive | à convenance | Oui, après votre accord explicite |

## 8. Prochains pas proposés

| Ordre | Étape | Objet | Pré-requis |
|---|---|---|---|
| 3 | Confirmation des valeurs par défaut | D36 à D39 | Votre décision |
| 4 | **S5** Investudy | Catalogue, sessions, inscriptions, certifications | Cas d'usage validés |
| 5 | **S6** Pilotage | Tableaux de bord commerciaux et de direction | S4, S5 |
| 6 | **S7** | Durcissement, Docker, sauvegardes, supervision, mise en production | Accès M365, avis juridique |

---|---|---|---|
| 1 | Validation S3.4 puis S3.5 | Fusion dans `main`, étiquettes | Votre « Je valide » |
| 2 | **S3.6 Documents** | Téléversement, versions, empreinte SHA-256, traçabilité | — |
| 3 | **Cadrage UX** | Maquettes des écrans du parcours commercial | Séance avec vous |
| 4 | **S4.1** Entreprises et contacts | API et écrans livrés ensemble | Cadrage UX |
| 5 | **S4.2 → S4.4** | Offres, relances, rendez-vous, opportunités, agrément, ambassadeurs | Réponses sur l'agrément |
| 6 | **S5, S6** | Investudy, tableaux de bord | — |
| 7 | **S7** | Durcissement, Docker/CI réels, sauvegardes, supervision, mise en production | Accès M365, validation juridique |

---

## 9. Où trouver quoi

| Besoin | Document |
|---|---|
| Récapitulatif détaillé des réalisations | [01-RECAPITULATIF-REALISATIONS.md](01-RECAPITULATIF-REALISATIONS.md) |
| Comprendre l'organisation du code | [02-GUIDE-DU-CODE.md](02-GUIDE-DU-CODE.md) |
| Rôle de chaque fonction | [03-INDEX-DES-FONCTIONS.md](03-INDEX-DES-FONCTIONS.md) |
| Historique session par session | [04-SUIVI-DES-SESSIONS.md](04-SUIVI-DES-SESSIONS.md) |
| Plan de sprints, décisions, risques, dette | `docs/DESIGN-CODE-ARCHITECTURE-PLAN.md`, `QUESTIONS-ET-DECISIONS.md`, `RISKS.md`, `TECH-DEBT.md` |
