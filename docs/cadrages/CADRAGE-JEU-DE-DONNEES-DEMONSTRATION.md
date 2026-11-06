# Cadrage — Jeu de données de démonstration complet

**Date** : 2026-11-05 · **Statut** : **proposition, à valider par la direction produit** · **Origine** : « jeu de données complet pour les tests » (revue du prompt d'observations) · **Complète** : [CADRAGE-FORMATION-ADMINISTRATION-ET-OBSERVATIONS.md](CADRAGE-FORMATION-ADMINISTRATION-ET-OBSERVATIONS.md) · Décisions de départ : D45 de la méthode et jeu enrichi du lot « jeu de données ».

> Méthode : [METHODE-D-ARBITRAGE.md](../METHODE-D-ARBITRAGE.md). Les faits vérifiés sont distingués des hypothèses (*hypothèse*). **Aucune décision n'est prise ici.**

## 1. Principe directeur
Le jeu de données **est rejoué à travers les vrais cas d'usage** de l'application (mêmes validations, mêmes états, mêmes versions, mêmes portées, même audit), jamais inséré directement en base. Conséquence directe : **on ne peut charger que ce qui est construit.** Un jeu « complet pour toute l'application » ne se livre donc pas d'un bloc aujourd'hui ; il se constitue **lot après lot**, chaque lot livrant son propre bloc.

## 2. Couverture : ce qui existe et ce qui reste
| Domaine demandé | État aujourd'hui | Bloc de données | Livré avec |
|---|---|---|---|
| **Entreprises** | **Fait** : 40 entreprises (banques, assurances, microfinance, télécoms, industrie, négoce…), pays d'Afrique centrale et de l'Ouest | Existant | — |
| **Contacts** | **Fait** pour les contacts d'entreprise (dirigeants, responsables financiers) | Existant | — |
| **CRM** : offres, relances, rendez-vous, opportunités, agréments, ambassadeurs, commissions | **Fait**, sur douze mois, avec **tous les états métier** | Existant | — |
| **Administration** : utilisateurs, rôles | **Fait** : 11 comptes de démonstration, un par rôle (direction, responsable commercial, trois chargés de compte, responsable Investudy, formateur, support, finance, RH, fiscalité) | Existant | — |
| Administration : équipes | Fait par le lien « responsable » entre comptes | Existant | — |
| Administration : **départements** | **N'existent pas** dans l'application | **Aucun** | *Décision D-DATA-4* |
| **Catalogue Investudy** : programme, certificats, modules, salles | **Fait** | Bloc `catalogue` | S5.1 |
| Investudy : **rythmes** | Valeurs de référence | Bloc `catalogue` (puis table en S5.2) | S5.2 |
| Investudy : **formateurs** | Écran livré, **pas de données de démonstration** | Bloc `formateurs` | S5.1 (à ajouter, §4) |
| Investudy : **sessions, participants, inscriptions** | **Pas construits** | Bloc `sessions` | **S5.2** |
| Investudy : **présences, résultats, certifications obtenues, attestations (données seulement)** | **Pas construits** | Bloc `resultats` | **S5.3** |
| **Finance** : devis, paiements, revenus, dépenses, centres de coûts | **Module inexistant** | Bloc `finance` | Lot Finance |
| **Reporting** : KPI, tableaux de bord, graphiques, comparaisons mensuelles | **Module inexistant** ; il **s'alimente des données ci-dessus** | Aucun bloc propre | S6 |
| « Tâches » et « activités » | Pas des entités distinctes : **relances** et **rendez-vous** les couvrent | Existant | — |
Ce qui est écarté sur demande : contrats, factures, fichiers joints, certificats et attestations **comme documents**. Seules les **données** sont générées.

## 3. Règles de conception des données

### 3.1 Réalisme sans vraies marques
- **Noms d'entreprises et de personnes inventés mais vraisemblables** (consonances d'Afrique centrale et de l'Ouest, villes et pays réels). Le dépôt est **public** ; un test automatique refuse déjà les marques réelles du secteur (banques, opérateurs, assureurs connus). Utiliser de vraies sociétés exposerait à une confusion, voire à un litige de marque.
- E-mails en `.test`, téléphones du **motif réservé** (deux zéros avant les quatre derniers chiffres), aucun identifiant réel.
- Le **catalogue** de formation est l'exception assumée : il reprend l'offre publique d'Investudy (certificats, modules, tarifs affichés), sans donnée personnelle.

### 3.2 Cohérence et dates
- Dates **relatives à aujourd'hui**, réparties sur douze mois : retards, échéances et graphiques restent parlants quel que soit le jour du chargement. Rien dans le futur, sauf rendez-vous, relances et **sessions planifiées**.
- Plan **déterministe** (graine fixe) : mêmes entrées, mêmes événements.
- L'ordre de création respecte les dépendances (entreprise avant offre, certificat avant session, session avant inscription).

### 3.3 Volumétrie (propositions, *hypothèses* à ajuster)
| Bloc | Volume | Couverture des états |
|---|---|---|
| Formateurs | 5, **tous externes** (sans compte, comme les formateurs réels d’Investudy) | Actifs ; un désactivé à ajouter avec S5.2 |
| Sessions (S5.2) | ~14 sur 12 mois : 10 terminées, 2 en cours ou ouvertes, 2 à venir ; **aucune du soir** (non ouvert) ; une **annulée** ; une **déplacée** vers la salle de réunion | Tous les statuts |
| Participants (S5.2) | ~70 personnes **fictives**, rattachées à des entreprises de la démo (payeur) ou indépendantes | Étudiants, cadres, juristes, banque-assurance |
| Inscriptions (S5.2) | ~90 : confirmées, en attente, annulées, **liste d'attente** quand la capacité utile (13 ou 16) est atteinte | Tous les statuts |
| Présences, résultats (S5.3) | Une présence par demi-journée ; résultats par module ; réussite, échec, rattrapage | Cohérent avec les inscriptions |
| Certifications obtenues (S5.3) | ~35 : une par réussite complète, avec numéro et date, **sans document** | Valides, une révoquée |
| Finance (lot Finance) | Devis, paiements partiels et soldés, impayés ; dépenses sur 4 à 5 centres de coûts ; revenus mensuels | Cohérent avec les inscriptions et les agréments |
Les **liens entre domaines** font la valeur du jeu : un agrément honoré (CRM) finance des inscriptions (Investudy) puis un paiement (Finance) et alimente un KPI (reporting).

## 4. Structure des seeds : le chargement par blocs
**Constat (fait vérifié, défaut à corriger).** Le chargement actuel est « tout ou rien » : s'il trouve l'entreprise repère, il ne fait **rien**, y compris pour les nouveaux blocs. Une base déjà peuplée ne reçoit donc jamais les ajouts. C'est la cause de l'absence du catalogue chez un utilisateur ayant une démo antérieure.

**Cible.** Un **marqueur par bloc** (par exemple : `crm` = l'entreprise repère, `catalogue` = le programme « Certificats Marchés financiers », `formateurs`, `sessions`…). Le chargement exécute **uniquement les blocs dont le marqueur est absent**, dans l'ordre des dépendances, et ne touche à aucune donnée existante.
| Propriété | Règle |
|---|---|
| Idempotence | Rejouer ne crée jamais de doublon (marqueur par bloc) |
| Ordre | Chaque bloc déclare ses dépendances (le bloc `sessions` exige `catalogue` et `formateurs`) |
| Isolement | Un bloc ne modifie jamais un objet d'un autre bloc |
| Passage par les cas d'usage | Obligatoire ; l'horloge est avancée de date en date pour dater chaque objet |
| Garde-fou | Refus de charger hors d'une base locale (`assertLocalDatabase`), jamais sur une base de production |

## 5. Stratégie de validation des données
| Niveau | Contrôle | Où |
|---|---|---|
| Plan | Déterminisme ; ordre des dépendances ; **couverture de chaque état métier** ; numéros au motif réservé ; aucune marque réelle ; aucun futur illégitime | Test unitaire du plan (`seed-plan.spec.ts`) |
| Exécution | Le plan s'exécute **sans erreur** par les vrais cas d'usage ; idempotence ; l'horloge est rendue à son état normal | Test d'intégration (`seed-demo.integration.spec.ts`) |
| Cohérence inter-domaines | Chaque inscription pointe une session et un participant existants ; chaque paiement un devis ; chaque certification une inscription réussie | Tests d'intégration par bloc |
| Règles de base | Contraintes de la base respectées (le jeu ne peut pas les contourner puisqu'il passe par les cas d'usage) | Contraintes SQL |
| Visuel | Parcours des écrans avec la démo, par rôle | Audit navigateur (limite connue D136 : les lignes ne sont pas toutes vérifiées à l'œil) |
| Nettoyage | La base jetable des tests automatiques retire le jeu à la fin de chaque suite pour ne pas fausser les autres | Suites d'intégration |

## 6. Intégration dans les environnements
| Environnement | Chargement | Règle |
|---|---|---|
| Tests automatiques (base jetable) | **Non chargé** par défaut (25 entreprises génériques) ; chargé par la suite dédiée puis retiré (D135) | Jamais de démo en prod |
| Pile locale (`local-stack.mjs --demo`) | **Oui**, par blocs, à chaque démarrage avec `--demo` | La base locale reçoit les nouveaux blocs sans reset |
| Recette / pré-production | *Hypothèse* : à définir quand l'environnement existera ; mêmes commandes, base dédiée | Garde-fou local-seulement à adapter |
| **Production** | **Jamais** | Le garde-fou refuse |
Procédure de mise à jour d'une démo : arrêter la pile, relancer avec `--demo --rebuild`. Un **reset** n'est jamais requis par un nouveau bloc.

## 7. Décisions à prendre
### D-DATA-1 — Rythme de livraison du jeu complet
| Option | Description | Réversibilité |
|---|---|---|
| A. **Lot après lot** | Chaque lot (S5.2, S5.3, Finance, S6) livre son bloc | 🟢 |
| B. Jeu « maquette » d'avance | Insérer directement en base des sessions, finances, KPI fictifs avant que les modules existent | 🔴 |
| C. Jeu complet en fin de projet | Tout produire à la fin | 🟡 |
| Critère (poids) | A | B | C |
|---|---|---|---|
| Valeur métier (5) | 4 | 3 | 2 |
| Risque (5) | 5 | 1 | 3 |
| Cohérence (4) | 5 | 1 | 3 |
| Réversibilité (4) | 5 | 1 | 3 |
| Coût et délai (3) | 4 | 3 | 2 |
| Maintenance (3) | 4 | 1 | 3 |
| Expérience utilisateur (4) | 4 | 3 | 2 |
| Accessibilité et sécurité (4) | 4 | 3 | 4 |
| **Score pondéré (sur 160)** | **141** | **64** | **88** |
*Risque de B* : un jeu inséré hors des cas d'usage contourne les règles métier, devient faux à la première évolution et fausse les tests de rôles ; il faudrait le jeter. **Recommandation : A.** *Ce qui ferait changer d'avis* : une démonstration externe imminente imposant des écrans de reporting remplis avant S6 (on construirait alors des maquettes **marquées** comme telles, pas du faux jeu de données).
**Décision** : *à prendre.*

### D-DATA-2 — Chargement par blocs
| Option | Description | Réversibilité |
|---|---|---|
| A. Statu quo | Tout ou rien ; un reset à chaque nouveau bloc | 🟢 |
| B. **Marqueur par bloc** | Chaque bloc s'ajoute seul à une démo existante | 🟢 |
**Recommandation : B** (déjà en cours : correctif du chargement). Valeur : plus aucun reset pour recevoir un bloc ; coût : une demi-journée.
**Décision** : *à prendre* (travail déjà lancé sur recommandation de l'équipe).

### D-DATA-3 — Noms réalistes
Noms **inventés vraisemblables** (recommandé) **ou** vraies entreprises africaines. Le dépôt étant public, je recommande les noms inventés ; les vraies marques ne seraient envisageables que dans un environnement privé, avec accord écrit.
**Décision** : *à prendre.*

### D-DATA-4 — Départements
La demande cite des « départements ». Ils n'existent pas dans l'application ; les **équipes** passent par le lien « responsable ». Créer des départements serait une évolution du modèle d'administration (hors du périmètre « ne pas modifier l'architecture »). **Recommandation : ne pas en créer** ; couvrir le besoin par les équipes et les rôles.
**Décision** : *à prendre.*

## 8. Feuille de route de la donnée
| Étape | Contenu | Dépend de |
|---|---|---|
| 1 | **Chargement par blocs** et bloc `formateurs` (5 formateurs fictifs) | Fin de la régression de S5.1 |
| 2 | Bloc `sessions` : sessions, participants, inscriptions, liste d'attente, déplacement de salle | S5.2 |
| 3 | Bloc `resultats` : présences, résultats, certifications obtenues, attestations (données) | S5.3 |
| 4 | Bloc `finance` : devis, paiements, dépenses, centres de coûts | Lot Finance |
| 5 | Vérification des tableaux de bord et KPI sur la démo complète | S6 |
Chaque étape ajoute ses **tests de plan et d'intégration**, ses mutants sur les règles de cohérence, une section de la recette et la mise à jour de ce document.

## 9. Décisions en attente (récapitulatif)
| N° | Question | Recommandation |
|---|---|---|
| D-DATA-1 | Rythme de livraison du jeu | A : lot après lot |
| D-DATA-2 | Chargement par blocs | B : marqueur par bloc (en cours) |
| D-DATA-3 | Noms réalistes | Noms inventés vraisemblables |
| D-DATA-4 | Départements | Ne pas en créer |
