# Plan de mise en production — Investally Business Platform

**Date** : 2026-11-05 · **Statut** : **proposition, à valider par la direction produit** · **Origine** : demande de stratégie de mise en production · **Complète** : [CADRAGE-FORMATION-ADMINISTRATION-ET-OBSERVATIONS.md](CADRAGE-FORMATION-ADMINISTRATION-ET-OBSERVATIONS.md), [CADRAGE-JEU-DE-DONNEES-DEMONSTRATION.md](CADRAGE-JEU-DE-DONNEES-DEMONSTRATION.md), [RESTE-A-FAIRE-DEVELOPPEMENT.md](../RESTE-A-FAIRE-DEVELOPPEMENT.md), [SECURITY.md](../SECURITY.md), [RELIABILITY.md](../RELIABILITY.md).

> Méthode : [METHODE-D-ARBITRAGE.md](../METHODE-D-ARBITRAGE.md). **Aucune décision n'est prise ici.** Les faits vérifiés dans le dépôt sont distingués des **hypothèses** (*hypothèse*), qui portent surtout sur l'hébergement, les volumes de données et les disponibilités des équipes : elles sont à confirmer. Ce document nomme les **fonctions** (DG, DGA, DAF…), jamais les personnes : le dépôt est public.

## 1. Analyse de l'état actuel

### 1.1 Fonctionnalités
| Domaine | État | Verdict de déploiement |
|---|---|---|
| Authentification, MFA obligatoire, sessions, rôles et permissions, journal d'audit, administration des utilisateurs | **Livré et testé** (S1 à S3) | Prêt |
| Documents (versions, empreinte, téléchargement tracé) | Livré ; **stockage sur disque local**, **pas d'antivirus** | **Prêt sous condition** : stockage objet et antivirus (D41, D42 bloquant) |
| **CRM commercial** : entreprises, contacts, offres, reçus, relances, rendez-vous, opportunités, agréments, ambassadeurs, commissions | **Complet et validé** (S4), anti-IDOR, mutants, audit navigateur | **Prêt** (avec les prérequis d'exploitation du §6) |
| **Investudy** : catalogue (programmes, certificats, modules, salles, formateurs, rythmes) | S5.1 en cours de validation | Prêt **après** validation de S5.1 |
| Investudy : sessions, apprenants, inscriptions, présences, évaluations, certifications | **Non construit** (S5.2, S5.3) | **Ne pas déployer** |
| Tableaux de bord, reporting, KPI | **Non construits** (S6) ; le hub n'a pas de page de pilotage | **Ne pas déployer** |
| Finance, Fiscalité, Stocks (ERP) | **Non construits** ; la Finance n'existe que par ses **droits** dans le CRM (honorer un agrément, débloquer une commission) | **Hors périmètre initial** |
| **RH légère** (annuaire et organigramme, puis absences) | **Décidée dans le CRM le 2026-11-09** (D55 à D58, ADR-0009) ; en construction (RH-1) ; **sans donnée sensible** (paie, salaires, pièces d'identité : ERP) | **Entre dans le périmètre** une fois recettée ; durée de conservation des données du personnel à valider (D11, D65) |
| Notifications, e-mail réel | **Absents** (D137) ; l'e-mail réel dépend des accès Microsoft 365 (D9) | **Bloquant** pour invitations et réinitialisations |
| Import de données existantes | **N'existe pas** | À créer (§7) |

### 1.2 Qualité du produit (faits vérifiés)
Tests automatiques : plus de 950 tests unitaires et 380 d'intégration côté API, plus de 530 côté interface ; mutations injectées sur chaque lot (dernier lot : 45 sur 45 détectées) ; contrat anti-IDOR ; audit d'accessibilité par navigateur réel. **Limites connues** : aucune écoute avec lecteur d'écran réel (D31), pas de tests de bout en bout automatisés (D22), Docker et intégration continue jamais exécutés « pour de vrai », pas de test de charge.

### 1.3 Ce qui n'existe pas du tout (voir aussi la réponse précédente)
Décision d'hébergement, plan d'environnements, image de l'interface web, procédures de déploiement, de retour arrière et de restauration, supervision, nom de domaine et certificat, gestion des secrets en production, livraison continue.

## 2. Les données

| Catégorie | Définition | Règle |
|---|---|---|
| **Démonstration** | Jeu fictif (entreprises inventées, e-mails `.test`, téléphones au motif réservé) ; catalogue d'Investudy issu de l'offre publique | Jamais en production ; le garde-fou de chargement refuse hors base locale |
| **Production** | Données réelles saisies ou importées par l'entreprise | Seules données autorisées en production |
| **Référence** | Rôles, permissions, catalogue de permissions, rythmes, **catalogue Investudy réel** | Chargés par migration ou par script contrôlé, identiques à tous les environnements |

**Règle d'or** : un environnement contient **soit** de la démonstration, **soit** de la production, **jamais les deux**. La démonstration vit dans les environnements de démonstration et de recette uniquement.

**Qualité des données** : les règles sont déjà garanties par l'application et la base (téléphone au format commun, e-mails uniques, noms d'entreprise uniques sans casse, statuts, montants positifs). Le plan de migration (§7) ajoute le nettoyage **avant** chargement.

## 3. Les utilisateurs et leurs besoins
| Fonction | Rôle dans l'application | Besoin principal | Priorité de mise en service |
|---|---|---|---|
| **DG** (CEO, qui dirige aussi Investudy) | Direction ; Super administrateur selon décision | Vue d'ensemble, lecture de tout, supervision de l'activité commerciale et de la formation | Vague 1 (lecture) |
| **DGA** (Deputy Managing Director, fonctions RH) | Direction + RH | Supervision, rôles et personnel | Vague 1 (lecture) |
| **Head of Sales and Marketing** | Responsable commercial | Pilote de l'équipe, pipeline global, réattribution, annulation de commissions | **Vague 1** |
| **Équipe commerciale** (chargé de compte, marketing digital) | Chargé de compte ; marketing : à préciser (*hypothèse* : lecture ou Support) | Entreprises, contacts, offres, relances, rendez-vous, opportunités | **Vague 1** |
| **Équipe Investudy** et support IT des formations | Responsable Investudy (*poste de fait à désigner*), Support | Catalogue, puis sessions et inscriptions | Vague 2 |
| **Formateurs** | **Externes, sans accès** à l'application ; seulement enregistrés comme fiches | Aucun accès au départ | Aucun (le rôle Formateur n'est pas ouvert) |
| **Finance** (DAF, responsable conformité et contrôle interne, investor relations) | Finance (DAF) ; contrôle interne : droit de lecture d'audit à décider (FD-10) | **Honorer les agréments, débloquer les commissions** : indispensable au flux commercial | Vague 1 (utilisateur Finance limité) |
| **Administration / IT** | Super administrateur | Comptes, rôles, sauvegardes, supervision | Dès le premier jour |

Point d'attention : **le module commercial ne fonctionne pas sans la Finance** (c'est elle qui constate le paiement d'un agrément et débloque les commissions). La vague 1 inclut donc au moins le DAF.

## 4. Stratégie recommandée

### 4.1 Arbitrage : comment déployer ?
| Option | Description | Réversibilité |
|---|---|---|
| **A. Progressif par module, avec pilote** | Vague 1 : CRM commercial (pilote restreint, puis toute l'équipe) ; vague 2 : Investudy ; vague 3 : pilotage ; ERP ensuite | 🟢 |
| B. Complet en une fois | Tout lancer ensemble, y compris ce qui n'est pas construit | 🔴 |
| C. Statu quo : démonstration seulement | Ne rien mettre en production avant que tout soit livré | 🟢 |
| Critère (poids) | A | B | C |
|---|---|---|---|
| Valeur métier (5) | 4 | 3 | 1 |
| Risque (5) | 5 | 1 | 5 |
| Cohérence avec les décisions passées (4) | 5 | 2 | 3 |
| Réversibilité (4) | 4 | 1 | 5 |
| Coût et délai (3) | 3 | 2 | 5 |
| Maintenance (3) | 4 | 2 | 4 |
| Expérience et adoption (4) | 5 | 2 | 1 |
| Accessibilité et sécurité (4) | 4 | 2 | 4 |
| **Score pondéré (sur 160)** | **138** | **60** | **109** |
*Risque de B* : un lancement général simultané noie les utilisateurs, mélange les incidents et expose des fonctions inachevées. *Risque de C* : l'adoption n'est pas préparée et les retours réels arrivent trop tard ; un « tout ou rien » en fin de projet est plus risqué qu'un lancement progressif.
**Recommandation : A.** Il correspond à l'ordre de réalisation déjà décidé (commercial, puis Investudy, puis pilotage) et protège l'adoption : chaque vague est apprise avant la suivante. *Ce qui ferait changer d'avis* : une obligation externe imposant Investudy avant le CRM.

### 4.2 Arbitrage : où héberger ?
*Les notes sont **indicatives** : budget, compétences d'exploitation et contraintes réglementaires ne sont pas connus (*hypothèses*).*
| Option | Description | Réversibilité |
|---|---|---|
| **A. Cloud géré** | Application en conteneurs et base PostgreSQL gérée (sauvegardes, haute disponibilité fournies) | 🟡 |
| B. Serveur virtuel unique | Une machine louée, Docker, base sur la machine, sauvegardes à notre charge | 🟡 |
| C. Serveur sur site | Machine dans les locaux | 🔴 |
| Critère (poids) | A | B | C |
|---|---|---|---|
| Valeur métier (5) | 4 | 3 | 3 |
| Risque (5) | 4 | 3 | 2 |
| Cohérence (4) | 4 | 4 | 3 |
| Réversibilité (4) | 4 | 4 | 3 |
| Coût et délai (3) | 3 | 5 | 2 |
| Maintenance (3) | 5 | 3 | 2 |
| Expérience utilisateur (4) | 4 | 3 | 3 |
| Accessibilité et sécurité (4) | 5 | 3 | 2 |
| **Score pondéré (sur 160)** | **132** | **110** | **81** |
**Recommandation : A**, si le budget le permet : les sauvegardes, les mises à jour de sécurité et la reprise sont gérées, ce qui compte pour une équipe d'exploitation réduite. B est une solution de repli acceptable pour un **pilote**. C est déconseillée (une seule coupure d'électricité ou de connexion suffit à rendre l'outil indisponible). *Point à vérifier* : région d'hébergement et latence depuis l'Afrique centrale.

## 5. Risques de mise en production
| Risque | Probabilité | Impact | Parade |
|---|---|---|---|
| Perte de données faute de sauvegarde testée | Moyenne | **Critique** | S7.1 : sauvegardes chiffrées, archivage continu, **test de restauration avant pilote** |
| Fichier malveillant déposé dans Documents | Moyenne | Élevé | Antivirus (D42, **bloquant**) ; en attendant, dépôts restreints |
| Aucun e-mail (invitations, réinitialisation) | Certaine tant que M365 manque | Élevé | Accès M365 (D9) à lancer **maintenant** ; en pilote, comptes créés et mots de passe transmis par l'administrateur |
| Faible adoption (retour au tableur) | Élevée | **Critique** | Pilote, formation par rôle, référent par équipe, hypercare |
| Données de départ de mauvaise qualité | Élevée | Élevé | Nettoyage et chargement contrôlé (§7), rapport de rejets |
| Contrainte juridique non traitée (conservation, données d'apprenants et de contacts) | Moyenne | Élevé | Avis juridique (D11) avant production |
| Connaissance concentrée sur une personne (exploitation) | Élevée | Élevé | Procédures écrites, second administrateur, documentation |
| Retard de la vague suivante | Moyenne | Moyen | Vagues indépendantes : la vague 1 n'attend pas Investudy |
| Un défaut critique en production | Moyenne | Élevé | Retour arrière documenté, migrations sans rupture (expand/contract), hypercare |

## 6. Plan par phases

### Phase 1 — Stabilisation
| Sujet | Contenu | État |
|---|---|---|
| Validation du lot en cours | Fin de S5.1 (régression, audit navigateur, recette, validation) | En cours |
| Chargement de la démo par blocs | Évite le piège d'une base déjà peuplée (cadrage du jeu de données) | À faire (P0) |
| Numéros de téléphone | **Livré** ; compléter le jeu d'essai (T-VAL-1) | Quasi terminé |
| Fenêtres et barres de défilement | **Livré** ; mesurer à quatre largeurs (T-UX-2) | À faire |
| Cohérence du Design System | Audit de conformité sur écrans réels (T-UX-1) | À faire |
| CRUD du module Formation | Catalogue **livré** ; rythmes administrables et sessions en S5.2 (D-FORM) | Partiel |
| Dette technique de sécurité | Antivirus, rotation des clés, CSP à nonce, liste de mots de passe, limitation de débit partagée, IP réelle derrière le proxy (D42, D10, D12, D20, D7, D8, D40) | S7.1 et S7.2 |
**Sortie de phase** : plus aucune anomalie bloquante ouverte ; tous les tests verts ; dette de sécurité de la vague 1 soldée.

### Phase 2 — Données
1. **Séparer** démonstration, référence et production (§2).
2. **Inventorier les sources réelles** (*hypothèse* : tableurs des équipes commerciales ; fichier d'inscrits d'Investudy) : volume, colonnes, qualité.
3. **Créer l'outil de chargement initial** (§7) : il passe par les cas d'usage, a un mode simulation et produit un rapport de rejets.
4. **Charger d'abord en recette**, valider avec les utilisateurs, puis en production.
**Sortie de phase** : rapport de rejets traité, taux de rejet accepté par les métiers.

### Phase 3 — Recette fonctionnelle
Scénarios détaillés au §9. Recette **en deux temps** : par l'équipe projet (automatisée et manuelle), puis par des **utilisateurs métier** sur la recette chargée de leurs données.
**Sortie de phase** : tous les scénarios critiques réussis, anomalies bloquantes à zéro, procès-verbal signé par la direction produit.

### Phase 4 — Préproduction
Environnement **identique à la production** (même version, mêmes réglages), avec :
| Domaine | Exigence |
|---|---|
| Environnement | Conteneurs construits par l'intégration continue ; base PostgreSQL séparée ; variables et secrets hors du dépôt |
| Sécurité | HTTPS obligatoire, secrets tournants (JWT, MFA), compte SQL applicatif à droits limités, CSP, pare-feu, accès d'administration restreint et tracé |
| Sauvegardes | Quotidiennes et chiffrées, archivage continu, **restauration testée et chronométrée** (objectifs : perte ≤ 15 min, reprise ≤ 4 h) |
| Supervision | Disponibilité, erreurs, temps de réponse, espace disque, alertes à une personne de garde |
| Journalisation | Journaux d'application centralisés et conservés, sans secret ni donnée personnelle superflue |
| Documents | Stockage objet, antivirus actif |
| E-mail | Accès Microsoft 365, SPF, DKIM, DMARC |
**Checklist de préproduction** : voir §8.1.

### Phase 5 — Production, par vagues
| Vague | Périmètre | Condition d'entrée |
|---|---|---|
| **0. Démonstration interne** | Tout ce qui existe, **données fictives** | Validation de S5.1 |
| **1. CRM commercial** | Entreprises, contacts, offres, relances, rendez-vous, opportunités, agréments, ambassadeurs, commissions ; utilisateurs : Head of Sales, chargé de compte, DAF (Finance), DG et DGA en lecture ; **d'abord en pilote** (2 à 3 utilisateurs, 2 à 4 semaines), puis élargissement | S7.1 et S7.2 terminés, formation, hypercare prête |
| **2. Investudy** | Catalogue, sessions, inscriptions, présences, certifications | S5.2 et S5.3 livrés et validés ; bloc de données de formation |
| **3. Pilotage** | Tableaux de bord et reporting | S6 livré |
| **4. ERP et Stocks** | Finance, RH, Fiscalité, Stocks | Lots dédiés, non planifiés |
**Peut attendre sans risque** : ERP complet, Stocks, modules futurs, notifications avancées.

### Phase 6 — Formation des utilisateurs
Voir §10.

### Phase 7 — Mise en ligne (go live)
Voir §8.2.

### Phase 8 — Hypercare
Voir §11.

## 7. Plan de migration des données
**Constat** : aucun import n'existe ; un fichier saisi à la main ne se charge pas. **Recommandation** : un **script de chargement initial** qui réutilise les cas d'usage, exactement comme le jeu de démonstration, pour que **toutes les règles métier s'appliquent** (jamais d'insertion directe en base).

| Étape | Contenu |
|---|---|
| 1. Extraire | Récupérer les sources (tableurs) ; figer une copie datée |
| 2. Cartographier | Associer chaque colonne à un champ de l'application ; décider quoi abandonner |
| 3. Nettoyer **avant** | Corriger numéros (format international), e-mails, pays, secteurs ; dédoublonner les entreprises (nom unique sans casse) ; vérifier les responsables (chaque entreprise a un propriétaire) |
| 4. Simuler | Mode « simulation » : exécute les contrôles et produit un **rapport de rejets** (ligne, motif) sans rien écrire |
| 5. Charger en recette | Chargement réel dans la recette, relu par les métiers |
| 6. Corriger et recharger | Les rejets sont corrigés à la source, pas dans l'application |
| 7. Charger en production | Une seule fois, **après sauvegarde**, par un administrateur, avec compte rendu (nombre lu, chargé, rejeté) |
| 8. Contrôler | Comptage et échantillon vérifiés par les métiers ; archive du rapport |
**Règles de qualité** : une entreprise sans responsable est rejetée ; un contact sans entreprise est rejeté ; pas de donnée personnelle superflue ; toute donnée sensible est signalée à l'avis juridique ; le chargement est **tracé dans l'audit**. **Retour arrière** : restauration de la sauvegarde d'avant chargement.

## 8. Checklists

### 8.1 Préproduction
- [ ] Hébergement décidé, environnement de préproduction identique à la production
- [ ] Construction des images (API **et** interface web) par l'intégration continue, exécutée pour de vrai
- [ ] Migrations appliquées automatiquement, **jamais modifiées après application**
- [ ] HTTPS, secrets hors du dépôt, rotation des clés testée
- [ ] Compte SQL applicatif à droits limités
- [ ] Sauvegardes quotidiennes + archivage continu ; **restauration réussie et chronométrée**
- [ ] Supervision et alertes ; personne de garde désignée
- [ ] Antivirus actif sur les dépôts de fichiers ; stockage objet
- [ ] E-mail réel (M365, SPF, DKIM, DMARC) ou procédure de repli documentée
- [ ] Revue de sécurité (OWASP, secrets, dépendances) et correction des écarts critiques
- [ ] Recette métier signée ; anomalies bloquantes = 0
- [ ] Avis juridique sur la conservation et les données personnelles

### 8.2 Mise en ligne (go live)
- [ ] **Sauvegarde complète** de l'état précédent et **plan de retour arrière** relu
- [ ] **DNS** : nom de domaine, enregistrements, TTL abaissé à l'avance
- [ ] **Certificat SSL** valide, renouvellement automatique, redirection HTTPS
- [ ] **Comptes administrateurs** : au moins deux administrateurs, mot de passe fort et MFA actif, comptes de démonstration **supprimés**
- [ ] Données de production chargées et contrôlées ; **aucune donnée fictive**
- [ ] Supervision active, alertes testées, canal d'incident ouvert
- [ ] Paramètres de sécurité de production (CSP, en-têtes, limitation de débit)
- [ ] Parcours critique rejoué en production par un utilisateur métier (connexion, MFA, création d'une entreprise, offre, déconnexion)
- [ ] **Décision go / no-go** signée par la direction produit, avec heure de bascule hors des pics d'activité
- [ ] Communication aux utilisateurs envoyée (date, accès, aide, contact)

## 9. Plan de recette
| Domaine | Scénarios critiques |
|---|---|
| **Accès et sécurité** | Connexion, MFA obligatoire, verrouillage après échecs, réinitialisation de mot de passe, expiration de session, **aucun accès sans permission** (chargé de compte A ne voit pas les entreprises d'un collègue d'une autre équipe) |
| **Entreprises** | Création (nom unique), modification, doublon refusé, statuts, changement de responsable, archivage, fiche 360°, export |
| **Contacts** | Création, rattachement, e-mail et téléphone au format, doublon signalé |
| **Offres et relances** | Création, soumission, acceptation, refus, retrait, reçu, relance à faire, en retard, clôture |
| **Rendez-vous et opportunités** | Planification, report, annulation ; pipeline en cinq étapes, règle du rendez-vous décideur, dérogation, clôture gagnée ou perdue |
| **Agréments et commissions** | Demande, réception, constat du paiement par la Finance, commission due, déblocage, versement avec justificatif, annulation motivée |
| **Investudy** (vague 2) | Programmes, certificats avec modules ordonnés et tarifs, salles (capacité utile, poste en panne), formateurs externes ; puis sessions (rythme jour, déplacement de salle), inscriptions (capacité, liste d'attente), présences, résultats, certifications |
| **Administration** | Création d'un utilisateur, attribution et retrait de rôles, désactivation, réinitialisation du MFA, révocation de sessions, consultation de l'audit |
| **Rôles** | Chaque rôle parcourt ses écrans : tout ce qui est permis fonctionne, tout ce qui est interdit répond « introuvable » ou « interdit » |
| **Données** | Comptages après chargement ; cohérence (aucun orphelin) ; téléphones et e-mails conformes |
| **Non fonctionnel** | Temps de réponse sur le volume réel, accessibilité (clavier), responsive, navigateurs utilisés par l'entreprise |
**Critères de sortie** : 100 % des scénarios critiques réussis ; aucune anomalie bloquante ni majeure ouverte ; procès-verbal signé.

## 10. Plan de formation
| Public | Contenu | Format | Durée (*hypothèse*) |
|---|---|---|---|
| **DG et DGA** | Lecture de l'activité, filtres, droits, sécurité (MFA) | Séance courte, démonstration sur leurs données | 1 h |
| **Head of Sales and Marketing** | Pipeline, réattribution, commissions, droits d'équipe | Atelier pratique | 2 h |
| **Équipe commerciale** | Cycle complet entreprise → contact → offre → relance → rendez-vous → opportunité | Atelier pratique, cas réels | 3 h + permanence |
| **Finance (DAF)** | Honorer un agrément, débloquer une commission, comprendre les justificatifs | Atelier ciblé | 1 h 30 |
| **Équipe Investudy** | Catalogue, puis sessions et inscriptions (vague 2) | Atelier pratique | 3 h (vague 2) |
| **Administration / IT** | Comptes, rôles, audit, sauvegardes, incidents | Atelier technique + procédures | 4 h |
**Supports** : guide par rôle d'une à deux pages avec captures, aide-mémoire des cinq gestes essentiels, vidéo courte de chaque parcours, foire aux questions mise à jour pendant l'hypercare.
**Accompagnement** : un **référent par équipe** (relais de premier niveau), permanence en présentiel ou en ligne la première semaine, canal de discussion dédié.
**Conduite du changement** : annoncer la date et le « pourquoi » par la direction ; fixer une **date d'arrêt** des tableurs parallèles pour éviter deux sources de vérité ; mesurer l'adoption (connexions, entreprises mises à jour, relances traitées).

## 11. Hypercare et support post-production
| Élément | Proposition (*hypothèses*) |
|---|---|
| Durée | 4 semaines après chaque vague |
| Support | Plage horaire renforcée, un administrateur disponible, un second en relais |
| **Niveaux d'incident** | **P1** : indisponibilité ou perte de données (réaction immédiate, arrêt de la mise en production si nécessaire) ; **P2** : fonction critique dégradée (même jour) ; **P3** : gêne (sous une semaine) ; **P4** : amélioration (backlog) |
| Canal | Un seul point d'entrée (formulaire ou messagerie), ticket numéroté, accusé de réception |
| Suivi | Revue quotidienne la première semaine, puis hebdomadaire ; tableau des incidents, temps de résolution, adoption |
| Améliorations rapides | Lot court « correctifs » par semaine, déployé hors des pics, avec retour arrière prêt |
| Clôture | Revue de sortie d'hypercare, décisions de la direction produit, passage au support courant |
| Après l'hypercare | Support courant, revues de sécurité trimestrielles, **test de restauration trimestriel**, mises à jour de dépendances planifiées |

## 12. Feuille de route
| Étape | Contenu | Durée indicative (*hypothèse*) | Dépend de |
|---|---|---|---|
| 0 | **Lancer maintenant** : accès Microsoft 365, avis juridique, **décision d'hébergement**, désignation du responsable Investudy et du second administrateur | En parallèle, sans développement | Direction produit |
| 1 | Valider S5.1, chargement de la démo par blocs, correctifs 2 (design, fenêtres, téléphones) | 1 à 2 semaines | — |
| 2 | **S7.1 Durcissement** : sauvegardes, supervision, stockage objet, rôle SQL, rotation des clés | 1,5 session | Hébergement |
| 3 | **S7.2 Mise en production** : antivirus, e-mail réel, revue de sécurité, tests de bout en bout, images pour de vrai | 1,5 session | Accès M365 |
| 4 | Données : outil de chargement initial, nettoyage, recette chargée | 1 semaine | Sources fournies |
| 5 | Recette métier et formation vague 1 | 1 à 2 semaines | Étapes 2 à 4 |
| 6 | **Pilote vague 1** (2 à 3 utilisateurs) | 2 à 4 semaines | Étape 5 |
| 7 | Élargissement vague 1 à toute l'équipe commerciale + hypercare | 4 semaines | Pilote concluant |
| 8 | **S5.2 puis S5.3** (Investudy complet), recette, formation, vague 2 | 6 à 8 semaines | En parallèle de 6 et 7 |
| 9 | S6 (pilotage), vague 3 | À planifier | S5 |
Les étapes 2 et 3 peuvent démarrer **avant** la fin de S5.2 : la vague 1 ne dépend pas d'Investudy.

## 13. Recommandations finales du CTO
1. **Déployer par vagues, en commençant par le CRM commercial**, avec un pilote : c'est le seul module complet et validé, c'est celui qui apporte une valeur immédiate à la direction commerciale.
2. **Ne rien mettre en production avant d'avoir une sauvegarde restaurée et chronométrée.** C'est le critère le plus simple et le plus décisif pour un système central.
3. **Décider l'hébergement maintenant** : tout le reste (coût, sauvegardes, domaine, accès, délais) en dépend.
4. **Lancer les dépendances externes immédiatement** : accès Microsoft 365 et avis juridique ne se règlent pas par du développement et retardent le plus souvent la production.
5. **Une seule source de vérité** : fixer la date d'arrêt des tableurs, sinon l'adoption échoue et les données divergent.
6. **Ne jamais charger de données de démonstration en production**, ni modifier une migration déjà appliquée.
7. **Réduire la dépendance à une personne** : un second administrateur, des procédures écrites et un test de reprise avant le pilote.
8. **Mesurer l'adoption**, pas seulement la disponibilité : le succès se juge à l'usage réel par les équipes.

## 14. Décisions en attente
| N° | Question | Recommandation |
|---|---|---|
| D-PROD-1 | Stratégie de déploiement | A : progressif par module, avec pilote (score 138 sur 160) |
| D-PROD-2 | Hébergement | A : cloud géré, B en repli pour un pilote (scores indicatifs : budget et compétences non connus) |
| D-PROD-3 | Composition du pilote de la vague 1 | Head of Sales, chargé de compte, DAF ; DG et DGA en lecture |
| D-PROD-4 | Responsable de l'exploitation et second administrateur | À désigner avant S7.1 |
| D-PROD-5 | Désignation du responsable Investudy et du rôle du marketing digital | À préciser avant la vague 2 |
| FD-9, FD-10, FD-11 | Droits de la Finance, lecture d'audit pour le contrôle interne, formateurs externes | Réponses toujours attendues |
