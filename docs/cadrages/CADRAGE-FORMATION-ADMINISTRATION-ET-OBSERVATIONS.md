# Cadrage — Observations de validation, cohérence UX et administration du module Formation

**Date** : 2026-11-05 · **Statut** : **proposition, à valider par la direction produit** · **Origine** : revue du prompt « observations fonctionnelles, UX/UI et qualité des données » · **Périmètre** : aucune modification de l'architecture ; validations, cohérence visuelle, module Formation. Le jeu de données fait l'objet du document [CADRAGE-JEU-DE-DONNEES-DEMONSTRATION.md](CADRAGE-JEU-DE-DONNEES-DEMONSTRATION.md).

> Méthode : [METHODE-D-ARBITRAGE.md](../METHODE-D-ARBITRAGE.md). **Aucune décision n'est prise ici** : les recommandations sont des avis, la décision est celle de la direction produit. Les faits vérifiés dans le dépôt sont distingués des hypothèses (étiquetées *hypothèse*).

## 1. Synthèse
| Sujet | État réel | Action proposée |
|---|---|---|
| Obs. 1 — numéros de téléphone | **Livré** (correctifs 1, migration `20261110000000`, règle serveur et interface comparées sur le même jeu d'essai) | Aucune. Étendre le jeu d'essai aux exemples de la direction produit (§2.1) |
| Obs. 2 — barre de défilement dans les fenêtres | **Livré** (correctifs 1 : cadre fixe, défilement interne, barres discrètes) | Vérifier sur les nouvelles fenêtres du catalogue (audit navigateur de S5.1) |
| Obs. 3 — cohérence des interfaces | **Partiellement traité** ; l'audit de conformité au Design System n'a **jamais été mené** (point T3.1 ouvert) | Mener l'audit sur captures réelles (§2.3, tâche T-UX-1) |
| Obs. 4 — administration du module Formation | **Pour moitié livré** (S5.1 : programmes, certificats, modules, salles, formateurs) ; sessions non construites (S5.2) ; rythmes codés (D147) | §3 à §6 |

## 2. Observations 1 à 3

### 2.1 Observation 1 — numéros de téléphone
**Fait vérifié.** La règle existe : seuls chiffres, espaces et « + » en première position ; premier chiffre (après le « + ») différent de 0 ; de 8 à 15 chiffres ; espaces tolérés à la saisie, retirés à l'enregistrement. Serveur (`shared-kernel/contact-format.ts`), interface (`lib/phone.ts`) et base (contrainte `*_phone_format`) l'appliquent ; un test compare serveur et interface sur le même jeu.

| Exemple de la direction produit | Décision de la règle |
|---|---|
| `+237 699 12 34 56`, `+33 6 12 34 56 78`, `237699123456` | Accepté |
| `+225 0701234567` | Accepté : le 0 vient **après l'indicatif**, il n'est pas en première position (cohérent avec l'énoncé « ne jamais commencer par 0 ») |
| `0699123456` | Refusé : « ne doit pas commencer par 0 : indiquez l'indicatif du pays » |
| `++237699123456`, `+237-699123456`, `+237(699)123456` | Refusés : « + » unique et en tête ; chiffres, espaces et « + » seulement |

*Limite connue* (hypothèse à confirmer) : la règle ne vérifie pas que l'indicatif existe ni que la longueur correspond au pays. Un contrôle par pays (bibliothèque dédiée) serait une évolution, pas une correction ; aucun besoin exprimé à ce jour.
**Tâche** : T-VAL-1 — ajouter les huit exemples ci-dessus au jeu d'essai commun (`phone-cases.ts`) s'ils n'y figurent pas déjà (vérification de 15 minutes).

### 2.2 Observation 2 — débordement dans les fenêtres
**Fait vérifié.** Les fenêtres ont un cadre fixe, la zone de contenu défile, la ligne d'actions reste visible ; les barres de défilement sont minimalistes. La mesure de **toutes** les fenêtres à quatre largeurs (tâche T2.2) n'a pas été faite.
**Diagnostic probable d'un débordement résiduel** (*hypothèse*) : un contrôle de largeur fixe ou un contenu long sans retour à la ligne. Les nouvelles fenêtres du catalogue (certificat avec sa liste de modules, salle) sont les plus à risque.
**Tâche** : T-UX-2 — mesurer chaque fenêtre à 320, 375, 768 et 1280 px, corriger au cas par cas dans `app/globals.css` ou le composant fautif, sans nouveau mécanisme.

### 2.3 Observation 3 — cohérence avec le Design System
**Méthode proposée** : relever chaque écran livré sur trois critères — structure (en-tête de page, carte, barre d'outils, tableau, pagination), hiérarchie (titres, étiquettes, boutons primaires) et comportements (filtres, actions de ligne, confirmations) — et la comparer à la référence **Entreprises**.
**Écarts déjà identifiés** (faits) :
- Le **catalogue** présente six rubriques dans **une seule page** avec filtres rapides ; les Entreprises ont une page par entité et une **fiche détaillée**. Choix de S5.1 à confirmer (décision D-FORM-3).
- Les rubriques du catalogue n'ont **pas de fiche détaillée** ; l'édition se fait en fenêtre.
- Certains écrans ont un libellé d'action en tête de ligne (« Nouveau … »), d'autres dans la barre d'outils : à uniformiser.
**Tâche** : T-UX-1 — audit complet sur captures (livrable : tableau d'écarts par écran, classés bloquant, gênant, cosmétique), puis plan de réalignement par lots de trois écrans.

## 3. Observation 4 — analyse de l'existant

### 3.1 Ce que S5.1 couvre déjà, par rapport à la demande
| Entité demandée | Création | Consultation | Modification | Suppression | Archivage | Autre |
|---|---|---|---|---|---|---|
| Programmes | Oui | Liste | Oui | **Non (voulu)** | Oui, réversible | Aucun programme ↔ module direct |
| Certificats | Oui | Liste (modules et tarifs) | Oui | **Non (voulu)** | Oui | Modules ordonnés, deux tarifs |
| Modules | Oui | Liste | Oui | **Non (voulu)** | Oui | « Pratique sur poste », partagés |
| Rythmes | **Non** | Liste (lecture seule) | **Non** | **Non** | Non | Valeurs codées (D147) |
| Sessions | **Non** | **Non** | **Non** | **Non** | **Non** | S5.2 |
| Salles, formateurs | Oui | Liste | Oui | Non (voulu) | Désactivation | Type de salle, capacité utile |

### 3.2 Écart avec le CRUD Entreprises
| Fonction du CRUD Entreprises | Catalogue actuel | Écart |
|---|---|---|
| Liste, recherche, filtre d'état, pagination | Présents | Aucun |
| Tri par colonne, colonnes réglables | **Absents** | Moyen |
| Sélection multiple et actions groupées | Absentes | Faible |
| **Fiche détaillée** (`/companies/[id]`) avec panneau Documents, historique | **Absente** | **Principal** |
| Création / édition en fenêtre, validation à l'envoi, focus sur le premier champ fautif | Présents | Aucun |
| Confirmation des actions sensibles | Présente (archivage) | Aucun |
| Export, import | Absents | Faible, hors demande |

**Conclusion** : l'écart structurant est la **fiche détaillée** ; le reste est secondaire. Les composants de liste (tableau, barre d'outils, filtres rapides, recherche, pagination, actions de ligne), de formulaire (champ, validation) et de fenêtre sont **déjà réutilisés** : aucun nouveau composant n'est nécessaire, sauf une page de fiche générique.

## 4. Décisions à prendre (méthode d'arbitrage)

### D-FORM-1 — Suppression d'un élément du catalogue
**Contexte.** La demande cite « suppression ». Une session passée doit toujours retrouver son certificat, sa salle et son formateur ; un élément archivé reste lisible, un élément supprimé disparaît (ou casse l'historique).
| Option | Description | Réversibilité |
|---|---|---|
| A. Statu quo | Archiver seulement, jamais supprimer | 🟢 |
| B. **Suppression d'un élément jamais utilisé**, archivage sinon | Le bouton « Supprimer » n'apparaît que si aucune session, inscription, ni certificat n'y est rattaché ; l'action est confirmée et tracée dans l'audit | 🟡 |
| C. Suppression libre | Supprimer même ce qui est utilisé | 🔴 |
| Critère (poids) | A | B | C |
|---|---|---|---|
| Valeur métier (5) | 3 | 4 | 4 |
| Risque (5) | 5 | 4 | 1 |
| Cohérence avec décisions passées (4) | 5 | 4 | 2 |
| Réversibilité (4) | 5 | 3 | 1 |
| Coût et délai (3) | 5 | 3 | 4 |
| Maintenance (3) | 5 | 3 | 2 |
| Expérience utilisateur (4) | 3 | 4 | 4 |
| Accessibilité et sécurité (4) | 5 | 4 | 2 |
| **Score pondéré (sur 160)** | **142** | **118** | **79** |
*Risques* : B suppose un calcul fiable de « jamais utilisé » (dépend de S5.2) ; une erreur supprimerait de l'historique. *Dette* : B laisse la règle « utilisé » à maintenir à chaque nouveau module.
**Recommandation : A maintenant, B après S5.2** (quand « utilisé » est mesurable). C est écartée. *Ce qui ferait changer d'avis* : un besoin récurrent de corriger des saisies erronées de test en production.
**Décision** : *à prendre par la direction produit.*

### D-FORM-2 — Rythmes de formation
**Contexte.** Valeurs actuelles : Jour (1 semaine, 9h–12h et 13h–17h, ouvert) et Soir (2 semaines, 18h–21h, en préparation). La demande évoque temps plein, temps partiel, week-end, soirée, personnalisé. *Hypothèse* : ces cinq termes sont un exemple, pas le besoin réel.
| Option | Description | Réversibilité |
|---|---|---|
| A. Statu quo | Deux rythmes codés | 🟢 |
| B. **Rythmes administrables** | Table de référence (nom, semaines, jours par semaine, créneaux, ouvert/fermé), écran d'administration réservé au Responsable Investudy ; on part des deux rythmes réels | 🟡 |
| C. Rythme libre par session | Chaque session définit ses horaires | 🟡 |
| Critère (poids) | A | B | C |
|---|---|---|---|
| Valeur métier (5) | 2 | 5 | 4 |
| Risque (5) | 4 | 4 | 3 |
| Cohérence (4) | 4 | 5 | 3 |
| Réversibilité (4) | 5 | 4 | 3 |
| Coût et délai (3) | 5 | 3 | 2 |
| Maintenance (3) | 3 | 4 | 2 |
| Expérience utilisateur (4) | 2 | 5 | 3 |
| Accessibilité et sécurité (4) | 4 | 4 | 3 |
| **Score pondéré (sur 160)** | **114** | **138** | **95** |
**Recommandation : B**, en créant uniquement Jour et Soir ; l'équipe métier ajoute ensuite les rythmes qu'elle utilise réellement. *Risque* : la session (S5.2) doit figer le rythme au moment de sa création (copie), pour qu'un changement ultérieur ne réécrive pas le passé.
**Décision** : *à prendre.*

### D-FORM-3 — Fiche détaillée des éléments du catalogue
**Contexte.** Les Entreprises ont une fiche détaillée ; le catalogue édite en fenêtre depuis un tableau.
| Option | Description | Réversibilité |
|---|---|---|
| A. Statu quo | Tableau et fenêtres | 🟢 |
| B. **Fiche pour le certificat seulement** | Page `/training/certificates/[id]` : modules, tarifs, sessions à venir et passées (dès S5.2), historique d'audit | 🟢 |
| C. Fiche pour chaque entité | Programmes, modules, salles, formateurs, certificats | 🟡 |
| Critère (poids) | A | B | C |
|---|---|---|---|
| Valeur métier (5) | 3 | 4 | 4 |
| Risque (5) | 5 | 4 | 3 |
| Cohérence (4) | 3 | 4 | 5 |
| Réversibilité (4) | 5 | 5 | 3 |
| Coût et délai (3) | 5 | 3 | 1 |
| Maintenance (3) | 5 | 4 | 2 |
| Expérience utilisateur (4) | 3 | 4 | 4 |
| Accessibilité et sécurité (4) | 4 | 4 | 4 |
| **Score pondéré (sur 160)** | **130** | **129** | **108** |
**Recommandation : B, à construire avec S5.2.** Le score **ne départage pas** A et B (130 contre 129) : la recommandation repose sur le jugement, pas sur le calcul. Une fiche de certificat n'a de valeur que lorsqu'elle montre ses sessions, donc elle n'a aucun intérêt avant S5.2 ; et elle rapproche le catalogue de la logique des Entreprises. Si vous préférez ne pas ajouter d'écran, A reste défendable.
**Décision** : *à prendre.*

## 5. Modèle de données, écrans, routes, permissions

### 5.1 Modèle recommandé (ajouts à l'existant, sans le modifier)
| Entité | Statut | Champs essentiels |
|---|---|---|
| Programme, certificat, module, salle, formateur | **Existants** | Voir DDR-0028 |
| **Rythme** (nouveau, D-FORM-2) | À créer en S5.2 | nom unique, semaines, jours par semaine, créneaux, ouvert |
| **Session** (S5.2) | À créer | certificat, rythme (copié), dates, salle, capacité utile copiée, statut (préparée, ouverte, en cours, terminée, annulée), formateur principal |
| **Trame de modules d'une session** (S5.2, facultative) | À créer | module, formateur, créneau, salle de repli |
| Lien session–formateur | À créer | formateur, rôle |
Règles reprises : le rythme et la capacité sont **copiés** dans la session ; une salle sans poste ne reçoit pas de module « pratique sur poste » ; les inscriptions sont limitées à la capacité utile.

### 5.2 Écrans
| Écran | Lot | Réutilise |
|---|---|---|
| Catalogue (six rubriques) | S5.1, livré | Tableau, barre d'outils, fenêtres |
| Rubrique **Rythmes** éditable | S5.2 | Même modèle que Salles |
| **Sessions** : liste, filtres (statut, certificat, période), création, planification | S5.2 | Liste des Entreprises |
| **Fiche session** : onglets Informations, Modules, Inscrits | S5.2 | Fiche entreprise |
| **Fiche certificat** (D-FORM-3 B) | S5.2 | Fiche entreprise |

### 5.3 API
Mêmes conventions que le catalogue : `GET/POST /rhythms`, `GET/PUT/POST status /rhythms/:id` ; `GET/POST /sessions`, `GET/PUT /sessions/:id`, `POST /sessions/:id/{open,cancel,close,room,trainers}` ; classement du contrat anti-IDOR : « référentiel » pour les rythmes, « objet » pour les sessions si une portée par formateur (Propre) s'applique (le rôle Formateur voit ses sessions).

### 5.4 Permissions (existantes, aucune création)
`training.session.{read,create,update,delete,cancel,close}` ; Responsable Investudy : tout ; Formateur : lecture de ses sessions (Propre) ; Chargé de compte, Responsable commercial, Direction : lecture. La suppression d'une session (D-FORM-1 B) utilise `training.session.delete`, déjà au catalogue.

## 6. Priorisation et tâches de développement
| Priorité | Tâche | Lot | Estimation |
|---|---|---|---|
| **P0** | T-DATA-1 — chargement de la démo par **blocs** : ajouter le catalogue à une démo existante | Maintenant | 0,5 jour |
| **P0** | Finir S5.1 : audit navigateur, recette, fiches | Maintenant | 0,5 jour |
| **P1** | T-UX-1 — audit de conformité au Design System, plan de réalignement | Après S5.1 | 1 jour |
| **P1** | T-UX-2 — mesure des fenêtres à quatre largeurs | Après S5.1 | 0,5 jour |
| **P1** | T-VAL-1 — compléter le jeu d'essai téléphone | Après S5.1 | 0,1 jour |
| **P1** | T-FORM-1 — rythmes administrables (D-FORM-2 B) | S5.2 | 1 jour |
| **P1** | T-FORM-2 — sessions : modèle, cas d'usage, écrans, fiche, trame, déplacement de salle | S5.2 | 4 à 5 jours |
| **P2** | T-FORM-3 — fiche certificat (D-FORM-3 B) | S5.2 | 1 jour |
| **P2** | T-FORM-4 — suppression d'un élément jamais utilisé (D-FORM-1 B) | Après S5.2 | 1 jour |
| **P3** | Tri par colonne et sélection multiple dans le catalogue | Selon demande | 1 jour |

## 7. Feuille de route
1. **Maintenant** : T-DATA-1, fin de S5.1, validation de S5.1.
2. **Ensuite** : T-UX-1, T-UX-2, T-VAL-1 (un lot « correctifs 2 », sans fonction nouvelle).
3. **S5.2** : sessions, apprenants, inscriptions, rythmes administrables, fiches certificat et session, avec leur jeu de données.
4. **S5.3** : présences, évaluations, certifications.
5. **Suite** : Finance, puis reporting (S6).

## 8. Décisions en attente (récapitulatif)
| N° | Question | Recommandation |
|---|---|---|
| D-FORM-1 | Suppression d'un élément du catalogue | A maintenant, B après S5.2 |
| D-FORM-2 | Rythmes administrables | B (Jour et Soir au départ) |
| D-FORM-3 | Fiche détaillée | B (certificat seulement, en S5.2) |
| FD-9, FD-11 | Droits Finance, apprenant distinct ; formateurs externes ; responsable Investudy | Réponses toujours attendues |
