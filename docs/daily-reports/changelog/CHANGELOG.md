# Changelog

*Généré par `scripts/daily-report.mjs changelog` à partir de la section « Changelog du jour » de chaque rapport. Ne pas modifier ici : corrigez le rapport du jour puis régénérez.*

Format inspiré de [Keep a Changelog](https://keepachangelog.com/fr/1.1.0/) ; les dates sont celles du fuseau du projet (Africa/Douala).

## 2026-10-22

### Ajouts

- H2a : écrans d'accès au nouveau style (A01 à A15) (`75ffde8`)
- H2b : page Sessions et connexions, recette et documentation (`a873d85`)
- S3.6 (API) : module Documents (versions immuables, SHA-256, stockage derrière un port, droits hérités de l'objet propriétaire) (`03fb1b6`)
- S3.6 : fiche entreprise minimale, panneau Documents, recette et documentation (`40452a5`)
- feat: pile locale persistante sans Docker et stratégie d'exécution (`ba035fc`)
- feat: un compte de démonstration par rôle (local, idempotent, interdit en production) (`dfe17d2`)

### Modifications

- docs: suivi mis à jour après validation de S3.6 (`72ed935`)
- docs: guide pratique d'exécution locale (`321c1b2`)
- docs: pages HTML de toute la documentation et index (`699d0c6`)
- docs: cadrage des retours de tests UX-01 à UX-04 (analyse avant implémentation) (`93fd498`)

### Corrections

- fix(ci): autoriser les scripts d'installation de PostgreSQL embarqué sous Linux et macOS (ERR_PNPM_IGNORED_BUILDS) (`ee4da53`)

### Sécurité

- H2a : test manquant sur les règles du mot de passe (mutant survivant tué) (`d29b053`)
- H2a : correction du test sur les règles du mot de passe (51/51, mutant tué) (`6264544`)
- H2a : code du second facteur en six cases (DDR-0009, remplace DDR-0008) (`1a59b96`)
- H2b (API) : historique des connexions et révocation des autres sessions (`c75044e`)
- test: contrat anti-IDOR (registre des routes, sondes d'intégration) et sortie en erreur de test-db (`f651f0e`)
- chore: dépôt public : e-mail fictif dans les tests, politique de signalement des vulnérabilités (`424e829`)
- feat(ui): S3.7 UX de l'authentification : mot de passe affichable, confirmation des actions irréversibles, codes de secours à affichage unique (`d6a2507`)

## 2026-10-21

### Ajouts

- a11y: titres de page, fenêtres modales inertes, audit axe-core rejouable, protocole lecteur d'écran (`d5ad244`)
- H1 : habillage minimal et hub (Tailwind v4, jetons, coque centrée, hub réel, recherche globale, thème) (`42da53f`)
- H1b : composants de données (tableau, sélection persistante, badges, barre d'outils, pagination, menu de ligne) (`89acec7`)
- Arbitrage D21 appliqué : décisions consignées, S4.1 élargie, Pays et Créée le affichés (`f99ce7c`)

### Modifications

- docs(livrables): suivi des sessions et etat d'avancement (`0fba621`)
- docs(livrables): besoins pour adopter le style graphique (captures, marque, decisions) (`fb2ad8d`)
- design: direction artistique, design system, prototype HTML (clair/sombre), specifications frontend (`0f867a9`)
- design: logo Investudy haute resolution dans le prototype (`43b6018`)
- design: logos Investally (rectangle, carre) et Investudy (rectangle) fournis, utilises dans le prototype (`35d4abf`)
- design: espace agenda (semaine, mois, filtres, nouvel evenement) et captures de tous les ecrans en clair et en sombre (`1687304`)
- design: exigences EXD-01 a 09 (profondeur, selection persistante, Opportunites en cartes), analyse d'impact (`bc0e851`)
- design: grille d'opportunites a 6 colonnes des 1360 px (`0b72ce4`)
- docs: methode d'arbitrage decisionnel et aide a la decision (navigation, opportunites, stocks, ordre, versionnement design) (`0d8d2e9`)
- design v0.4.0: decisions DEC-001 a 006 appliquees (navigation B+, Opportunites hybrides, versionnement, ADR-0007 Stocks, ordre de realisation) (`862785c`)
- design v0.4.0: manifestes des versions et etiquettes de reconstitution (`05885a5`)
- design v0.4.1: panneau principal centré (DEC-007 option B), bouton de dépliage en pictogramme (`9908a58`)
- design v0.4.1 validé par la direction produit (`716200a`)
- docs: cadrages de H1, H2, S3.6 et du cadrage UX (options, grilles calculées, recommandations) (`75b411c`)
- docs: décisions des cadrages H1, H2, S3.6 et UX enregistrées (recommandations retenues, D19) (`3b8f45a`)
- docs: arbitrage préparé sur les données manquantes de l'API des entreprises (ARB-API-1 à 4) (`5079f10`)
- docs: capture du tableau Entreprises avec Pays et Créée le; résultats d'audit mis à jour (`3ad8540`)

### Sécurité

- S3.5: mot de passe oublie (libre-service et administrateur), commentaires sur toutes les fonctions, livrables (`6692541`)

## 2026-10-20

### Ajouts

- feat(crm): S1 squelette CRM - monorepo, garde-fous d'architecture, tranche Company + audit (`5261fbe`)
- feat(crm): S1 frontend minimal, builds de production, plan de recette (`11ff3b6`)
- wip(S3.3): autorisation par portee, API d'administration, invitations (backend, tests a venir) (`f988eb3`)
- S3.3: autorisation (@Protected), API d'administration, invitations, propriétaire des entreprises (`f9319e8`)

### Modifications

- docs: Sprint 0 - vision, architecture, ADR, risques, fiabilite, tests (`a4b208a`)
- docs: registre des questions sensibles et des decisions (`a335c0d`)

### Corrections

- docs(s1): recette A7/E4, dette D6 (js-yaml), correctif chemin .env (`84da5a8`)
- test(s1): base PostgreSQL jetable, correctif UTC des timestamptz, recette C/D/E (`f6c6ce9`)

### Sécurité

- feat(crm): S2 securite et donnees Core - RBAC, schema iam/docs, audit partitionne (`9b972e0`)
- feat(crm): S2 decisions de la direction - SuperAdmin complet, MFA pour tous, agrement = promesse de paiement (`efa5a18`)
- feat(crm): S3.1 authentification - argon2id, JWT ES256, sessions, rotation du refresh token (`a78d9ca`)
- feat(crm): S3.2 MFA TOTP, e-mail Microsoft 365, creation du premier SuperAdmin (`d53c85a`)
- wip(S3.4): front de base (connexion, MFA, invitation, administration, compte), /auth/me/profile, invalid_token (`27ad200`)
- S3.4: front de base (connexion, MFA, invitation, administration, mon compte), en-tetes de securite, recette (`f7770d6`)
