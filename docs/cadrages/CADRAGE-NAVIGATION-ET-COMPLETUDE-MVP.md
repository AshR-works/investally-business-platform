# Cadrage — navigation, cohérence entre modules et complétude des écrans (MVP)

*2026-11-09 · Réponse aux six observations de la Direction produit sur l'état de l'application. Méthode : [METHODE-D-ARBITRAGE](../METHODE-D-ARBITRAGE.md) pour les décisions structurantes (options dont le statu quo, grille sur 160, recommandation, **décision laissée à la Direction produit**). Rien n'est modifié dans l'application tant que vous n'avez pas répondu. Les constats ci-dessous sont **vérifiés dans le code** (routes de l'API, pages et composants de l'interface), pas déduits.*

## 0. En dix lignes

1. **Quatre des six observations sont fondées** : menu surchargé (1), liens entre modules sans contexte (4), références non cliquables et absence de fiches détaillées (5), quelques écrans de création ou d'action manquants (6).
2. **Deux reposent sur une lecture inexacte** et sont corrigées ici : le module **Offres a déjà un cycle de vie complet** (créer, modifier, déposer, enregistrer l'acceptation ou le refus, retirer, décharge, relances), à l'API comme à l'écran (3) ; le module **Ambassadeurs a bien** créer, lister, lire et modifier, à l'API comme à l'écran ; il manque **l'archivage** (2).
3. La **navigation contextuelle (4) est presque entièrement un chantier d'interface** : l'API filtre déjà par entreprise pour les rendez-vous, opportunités, offres, contacts, agréments et commissions ; seules les **relances** et les **ambassadeurs** n'ont pas ce filtre.
4. Aucune fiche détaillée n'existe en dehors de **l'entreprise** et de **la session**. Les `GET /…/:id` existent pourtant pour toutes les entités : **les fiches sont un chantier d'écrans, sans nouvelle route d'API**.
5. Le menu actuel est une liste de **13 entrées livrées** réparties dans quatre rubriques génériques (« Espace de travail », « Opérations », « Pilotage », « Gouvernance »), dont **12 dans la seule première** ; six autres entrées sont affichées « à venir » sur le hub.
6. Recommandation : **regrouper par domaine métier** (CRM, Investudy, Finance, Ressources humaines, Reporting, Administration) avec sous-menus repliables, et **le compte de l'utilisateur en pied de menu** (décision D-NAV-1).
7. Recommandation : **un filtre d'entreprise porté par l'adresse** (`?companyId=…`) avec une pastille retirable, plutôt que des onglets complets dans la fiche entreprise (D-NAV-2).
8. Recommandation : **des fiches dédiées** pour contact, offre, opportunité, agrément, ambassadeur et apprenant, reliées par **un seul composant de lien** (D-NAV-3).
9. Reste hors de ces observations mais au programme du sprint MVP : la section **Ressources humaines** n'a **aucun code** aujourd'hui ; le **Compte** (connexion, second facteur, sessions) est livré.
10. **S5.2b** (apprenants et inscriptions) est terminé côté code et en attente de validation : je recommande de le **commiter avant** ce chantier, car il touche les mêmes fichiers de navigation (§ 8).

## 1. Ce que le code montre, observation par observation

### Observation 1 — le menu
- **Constat vérifié** : `lib/modules.ts` déclare les entrées ; `components/app-shell.tsx` les range dans quatre rubriques fixes. Sont affichées à plat sous « Espace de travail » : Agenda, Commissions, Ambassadeurs, Entreprises, Contacts, Relances, Offres, Opportunités, Formation, Sessions de formation, Apprenants, Inscriptions… (12 entrées au total, selon les droits). Le hub (`/`) montre les mêmes modules sous forme de cartes.
- **Analyse** : le regroupement est la bonne réponse, mais il faut décider deux points que l'observation ne tranche pas : la place des **Commissions** (CRM ou Finance, vous les citez dans les deux) et ce que veut dire « Formations / Certifications » (le catalogue réel est *programme → certificat → modules*, voir § 3.2).

### Observation 2 — Ambassadeurs
- **Constat vérifié** : l'API expose `POST /ambassadors`, `GET /ambassadors` (liste filtrable par origine et recherche), `GET /ambassadors/:id`, `PUT /ambassadors/:id`. L'écran propose « Nouvel ambassadeur » et « Modifier ». **Il n'y a ni archivage ni suppression**, ni fiche détaillée, ni filtre par entreprise.
- **Pertinence métier** : confirmée. Un ambassadeur est un client ou un apprenant devenu **relais commercial** (cas d'usage F… ; suggestion d'ambassadeur après une certification, S5.3). Son statut de décision manuelle est assumé (« créer un ambassadeur est toujours une décision manuelle »).
- **Écart avec l'observation** : le CRUD n'est pas absent, il est **incomplet sur un point** : l'archivage. Je recommande l'**archivage réversible** plutôt que la suppression (on ne perd pas l'origine d'une recommandation).

### Observation 3 — Offres
- **Constat vérifié** : l'API expose créer, lister, lire, modifier, **déposer** (`submit`), **accepter**, **refuser**, **retirer** (`withdraw`, avec motif) ; l'écran, les actions de ligne correspondantes, la **décharge** (reçu), les **relances** et les **rendez-vous** liés à l'offre. Le cycle de vie est donc **complet**.
- **Ce qui manque réellement** : **cloner** une offre (utile pour une offre refusée ou retirée que l'on relance), une **fiche détaillée**, un **filtre par entreprise depuis la fiche entreprise** (le panneau de la fiche entreprise liste les offres de l'entreprise ; la page Offres, elle, ne sait pas se filtrer par adresse).

### Observation 4 — navigation contextuelle
- **Constat vérifié** : dans la fiche entreprise, les panneaux « Rendez-vous » et « Opportunités » contiennent des liens **« Ouvrir l'agenda »** et **« Ouvrir le pipeline »** vers `/agenda` et `/opportunities` **sans aucun paramètre** ; les boutons du haut de la fiche ouvrent **la fenêtre de création** préremplie (`/agenda?plan=1&companyId=…`, `/opportunities?new=1&companyId=…`), pas une liste filtrée. Les pages Agenda et Opportunités lisent `companyId` **uniquement pour préremplir une création**.
- **Côté API** : `GET /appointments`, `/opportunities`, `/offers`, `/contacts`, `/approvals`, `/commissions` acceptent déjà `companyId`. **Manquent** : `/followups` (filtre par offre seulement) et `/ambassadors`.

### Observation 5 — références cliquables
- **Constat vérifié** : seuls trois liens existent aujourd'hui entre entités : le nom d'**entreprise** dans les listes (vers `/companies/:id`), le **certificat** d'une session (vers la fiche de session, S5.2b) et le **certificat** d'une inscription. Contacts, offres, opportunités, agréments, rendez-vous, relances, ambassadeurs, apprenants et commissions **n'ont pas de page de fiche** : il n'y a donc nulle part où mener un lien.
- **Bonne nouvelle** : les `GET /…/:id` existent déjà pour **toutes** ces entités. Le chantier est un chantier d'écrans.

### Observation 6 — création rapide
- **Constat vérifié** : le bouton de création existe déjà sur **Entreprises, Contacts, Offres, Opportunités, Relances, Agenda, Ambassadeurs, Apprenants, Sessions** et dans le catalogue. Les écarts réels sont dans le § 6.

## 2. Décisions structurantes

Poids (fixés avant de noter) : valeur métier 5 · risque 5 · cohérence avec l'existant 4 · réversibilité 4 · coût et délai 3 · maintenance 3 · expérience utilisateur 4 · accessibilité et sécurité 4 (**total 160**).

### D-NAV-1 — Structure du menu latéral
| Option | Description | Réversibilité |
|---|---|---|
| A. Statu quo | Liste plate de 13 entrées sous quatre rubriques génériques (12 dans la première) | 🟢 |
| **B. Domaines métier avec sous-menus repliables** | Six domaines (CRM, Investudy, Finance, Ressources humaines, Reporting, Administration), chacun repliable ; le domaine de la page courante est ouvert ; le **compte** (profil, sécurité, sessions, déconnexion) en pied de menu ; un domaine sans entrée visible pour le profil n'apparaît pas | 🟢 |
| C. B + accès personnalisés | B, plus des favoris et les derniers écrans consultés | 🟡 |

| Critère (poids) | A | B | C |
|---|---|---|---|
| Valeur métier (5) | 2 | 5 | 5 |
| Risque (5) | 4 | 4 | 3 |
| Cohérence (4) | 4 | 5 | 4 |
| Réversibilité (4) | 5 | 4 | 3 |
| Coût et délai (3) | 5 | 4 | 2 |
| Maintenance (3) | 5 | 4 | 2 |
| Expérience utilisateur (4) | 1 | 5 | 5 |
| Accessibilité et sécurité (4) | 3 | 4 | 3 |
| **Score pondéré (sur 160)** | **112** | **141** | **112** |

*Risques de B* : un sous-menu replié cache des écrans (atténué : le domaine courant est ouvert, le hub reste la vue d'ensemble) ; accessibilité à tenir (boutons `aria-expanded`, navigation au clavier). *Dette* : la table des modules devient hiérarchique. **Recommandation : B.** *Ce qui ferait changer d'avis* : un usage où chacun ne voit que deux ou trois entrées (alors A suffit).
**Décision (2026-11-09, Direction produit) : B** — recommandation appliquée (D51).

### D-NAV-2 — Navigation contextuelle depuis une fiche
| Option | Description | Réversibilité |
|---|---|---|
| A. Statu quo | Liens sans contexte ; le contexte ne sert qu'à préremplir une création | 🟢 |
| **B. Filtre porté par l'adresse** | « Ouvrir l'agenda / le pipeline / les offres » mène à `/agenda?companyId=…` etc. ; la page lit le paramètre, **filtre** et affiche une **pastille retirable** « Entreprise : Banque X ✕ » ; « Nouveau… » préremplit l'entreprise ; un fil d'Ariane « Entreprises › Banque X › Offres » ramène à la fiche | 🟢 |
| C. Onglets complets dans la fiche entreprise | Les listes complètes (avec toutes leurs actions) deviennent des onglets de la fiche entreprise | 🟡 |

| Critère (poids) | A | B | C |
|---|---|---|---|
| Valeur métier (5) | 1 | 5 | 4 |
| Risque (5) | 5 | 4 | 3 |
| Cohérence (4) | 2 | 5 | 3 |
| Réversibilité (4) | 5 | 5 | 3 |
| Coût et délai (3) | 5 | 4 | 2 |
| Maintenance (3) | 5 | 4 | 2 |
| Expérience utilisateur (4) | 1 | 5 | 4 |
| Accessibilité et sécurité (4) | 3 | 4 | 3 |
| **Score pondéré (sur 160)** | **104** | **145** | **99** |

*Risques de B* : une adresse avec un `companyId` hors de la portée de l'utilisateur doit répondre « introuvable » comme le reste de l'application (le serveur le fait déjà) et la page doit l'expliquer, non rester vide. *Dette* : deux endpoints à compléter (relances, ambassadeurs). **Recommandation : B.** L'adresse partageable (copier-coller d'une vue filtrée) est un gain de plus.
**Décision (2026-11-09, Direction produit) : B** — recommandation appliquée (D52).

### D-NAV-3 — Fiches détaillées des entités
| Option | Description | Réversibilité |
|---|---|---|
| A. Statu quo | Listes et fenêtres seulement, pas de fiche | 🟢 |
| **B. Pages de fiche dédiées** | `/offers/:id`, `/contacts/:id`, `/opportunities/:id`, `/approvals/:id`, `/ambassadors/:id`, `/learners/:id` sur le modèle de la fiche entreprise et de la fiche de session : résumé, actions, éléments liés ; un composant de lien unique pour toute l'application | 🟡 |
| C. Volet latéral de consultation | Un volet qui s'ouvre au clic sur n'importe quelle référence, sans quitter la page | 🟡 |

| Critère (poids) | A | B | C |
|---|---|---|---|
| Valeur métier (5) | 1 | 5 | 4 |
| Risque (5) | 5 | 4 | 4 |
| Cohérence (4) | 2 | 5 | 4 |
| Réversibilité (4) | 5 | 4 | 4 |
| Coût et délai (3) | 5 | 2 | 3 |
| Maintenance (3) | 5 | 3 | 3 |
| Expérience utilisateur (4) | 1 | 4 | 5 |
| Accessibilité et sécurité (4) | 3 | 5 | 3 |
| **Score pondéré (sur 160)** | **104** | **132** | **122** |

*Risques de B* : le plus gros volume d'écrans ; on procède par ordre d'usage (§ 8). *Pourquoi pas C* : un volet est agréable mais plus difficile à rendre accessible, et ne donne pas d'adresse partageable ni de retour arrière par le navigateur. **Recommandation : B**, avec une mise en page commune pour ne pas refaire six fois le même écran.
**Décision (2026-11-09, Direction produit) : B** — recommandation appliquée (D53).

### D-NAV-4 — Où vivent les Commissions ? (point que l'observation 1 ne tranche pas)
Vous les citez sous CRM **et** sous Finance. Un même écran à deux endroits est une source de confusion. **Recommandation : une seule entrée, sous Finance** (« Commissions à verser ») : c'est le travail du DAF (déblocage) et du chargé de compte (versement) ; le **lien depuis la fiche entreprise** vers les commissions de l'entreprise (`/commissions?companyId=…`) suffit côté CRM. Alternative : l'entrée sous CRM tant que Finance n'a qu'elle (un domaine à une seule entrée est peu utile). *Décision à prendre* : **A** sous Finance, ou **B** sous CRM avec renvoi depuis Finance.
**Décision (2026-11-09, Direction produit) : A** — recommandation appliquée (D54).

## 3. Structure recommandée du menu (D-NAV-1 B et D-NAV-4 A)

### 3.1 Vue d'ensemble
```
Vue d'ensemble                         (le hub, /)
CRM  ▾
   Entreprises            /companies
   Contacts               /contacts
   Opportunités           /opportunities     (le pipeline)
   Offres                 /offers
   Agréments              /approvals         (nouvelle liste, § 6)
   Relances               /followups
   Agenda                 /agenda
   Ambassadeurs           /ambassadors
Investudy  ▾
   Catalogue  ▸ Programmes · Certificats · Modules · Salles · Formateurs · Rythmes   /training?rubrique=…
   Sessions               /training/sessions
   Inscriptions           /training/enrollments
   Apprenants             /training/learners
Finance  ▾
   Commissions à verser   /commissions
   (Paiements, Revenus : à venir)
Ressources humaines  ▾                (sprint MVP : voir le cadrage à produire)
Reporting  ▾                          (Tableaux de bord, Indicateurs, Rapports : à venir, S6)
Administration  ▾
   Utilisateurs           /admin/users
   (Rôles et permissions : lecture seule à produire ; Paramètres, Journal d'audit : à venir)
─────────────
Compte  (pied de menu)
   Mon profil et sécurité   /account
   Mes sessions             /account/sessions
   Se déconnecter
```

### 3.2 Investudy : ce qui diffère de votre liste
Votre liste (Formations, Programmes, Certifications, Modules, Sessions, Inscriptions, Apprenants) recouvre le **catalogue réel** décidé en S5.1 : **Programme → Certificat → Modules** (le « certificat » est la formation vendue, il n'y a pas de rubrique « Formations » à part). Je propose donc **un seul « Catalogue »** dont les six rubriques (Programmes, Certificats, Modules, Salles, Formateurs, Rythmes) deviennent des **entrées de sous-menu** adressables (`?rubrique=certificats`), plutôt que de multiplier les entrées de premier niveau.

### 3.3 Administration : ce qui diffère de votre liste
Vous citez Utilisateurs, Rôles, Permissions, Paramètres. Aujourd'hui **seuls les Utilisateurs existent**. Les **rôles et permissions sont définis dans le code** (catalogue de 108 permissions, 10 rôles) : un écran de **consultation** de la matrice (qui peut quoi) est utile et peu coûteux ; leur **modification par l'interface** est un autre sujet (sécurité, traçabilité) et n'est **pas** dans ce chantier. « Paramètres » n'a pas de contenu défini : je ne crée pas d'entrée vide.

### 3.4 Effets sur l'usage
| Situation | Aujourd'hui | Après |
|---|---|---|
| Voir les offres d'une entreprise | fiche → panneau, ou menu → Offres → chercher l'entreprise | fiche → « Ouvrir les offres » : 1 clic, liste déjà filtrée |
| Ouvrir un contact depuis une entreprise | impossible (pas de fiche) | 1 clic sur son nom |
| Inscrire un apprenant | Apprenants → ligne → menu → Inscrire, ou fiche de session | idem + bouton « Nouvelle inscription » sur la page Inscriptions |
| Trouver un écran | parcourir 12 entrées d'une même rubrique | ouvrir le domaine (6 choix), puis 4 à 8 entrées |

## 4. Navigation contextuelle : mécanisme (D-NAV-2 B)

**Contrat d'adresse** (identique partout) : `?companyId=` (entreprise), `?offerId=`, `?opportunityId=`, `?status=`, `?q=` ; `?new=1` et `?plan=1` restent réservés à l'ouverture d'une création préremplie.

**Composants** (nouveaux, partagés) :
- `ContextFilter` : pastille « Entreprise : Banque X ✕ » (retire le paramètre de l'adresse, annoncée au lecteur d'écran) et message clair si l'entreprise est « introuvable » (hors portée).
- `useUrlFilters` : lit et écrit les filtres dans l'adresse (liste, page, recherche, état), de façon à **conserver l'état** au retour arrière du navigateur.
- `Breadcrumbs` : « Entreprises › Banque X › Offres », ramène à la fiche.

**Pages à modifier** : Agenda, Opportunités, Offres, Contacts, Relances, Commissions, Agréments (nouvelle liste), Ambassadeurs (après l'ajout du filtre) : chacune lit `companyId` et le transmet à son appel d'API.

**Côté serveur** : **deux** compléments seulement : `GET /followups?companyId=` (via l'offre de l'entreprise) et `GET /ambassadors?companyId=`. La portée de l'utilisateur est **déjà** appliquée par le serveur : un `companyId` hors portée renvoie « introuvable », jamais les données d'un autre.

## 5. Références cliquables : stratégie (D-NAV-3 B)

**Un composant, un tableau de correspondance** : `EntityLink` (type + identifiant + libellé) et `lib/entity-links.ts` (type → adresse de la fiche, droit de lecture requis). Un lien n'est affiché **que si l'utilisateur a le droit de lire la cible** ; sinon le libellé reste du texte (pas de lien menant à un « interdit »).

| Entité | Où elle apparaît aujourd'hui | Fiche | Travail |
|---|---|---|---|
| Entreprise | listes, fiches | **existe** (`/companies/:id`) | utiliser `EntityLink` partout |
| Contact | fiche entreprise (panneau), apprenants | à créer | `/contacts/:id` |
| Offre | fiche entreprise, relances, rendez-vous | à créer | `/offers/:id` |
| Opportunité | fiche entreprise, rendez-vous, agréments | à créer | `/opportunities/:id` (étapes, valeur, rendez-vous décideur, agrément) |
| Agrément | fiche entreprise, commissions, inscriptions | à créer | `/approvals/:id` (+ consommation par les inscriptions) |
| Rendez-vous | agenda, fiche entreprise | fenêtre existante | ouvrir la fenêtre de détail depuis le lien (pas de page) |
| Relance | page Relances, offre | fenêtre existante | idem |
| Ambassadeur | page Ambassadeurs | à créer | `/ambassadors/:id` |
| Commission | page Commissions | à créer (plus tard) | basse priorité |
| Apprenant | Apprenants, inscriptions | à créer | `/learners/:id` (inscriptions, entreprise, contact lié) |
| Session | sessions, inscriptions | **existe** | utiliser `EntityLink` |

**Mise en page commune** (`EntitySheet`) : en-tête (titre, état, actions), carte de résumé, panneaux d'éléments liés, et plus tard l'historique d'audit. Chaque fiche est une page, donc **adressable, accessible au clavier et rejouable au retour arrière**.

## 6. Écarts de complétude (vérifiés)

| Entité | Créer | Lister / filtrer | Fiche | Modifier | Archiver / supprimer | Actions métier | **Manque** |
|---|---|---|---|---|---|---|---|
| Entreprises | ✔ | ✔ | ✔ | ✔ | archiver ✔ (statuts) | statut, responsable, export | — |
| Contacts | ✔ | ✔ (entreprise, fonction) | ✘ | ✔ | supprimer ✔ | — | **fiche** |
| Opportunités | ✔ | ✔ (entreprise, étape) | ✘ | ✔ | — | avancer, dérogation, clore | **fiche** |
| Offres | ✔ | ✔ (entreprise, état) | ✘ | ✔ | retirer ✔ | déposer, accepter, refuser, décharge | **fiche, cloner** |
| Agréments | ✔ (depuis l'opportunité) | ✔ API ; **pas de page de liste** | ✘ | — | annuler ✔ | recevoir, honorer, expirer | **page liste, fiche** |
| Relances | ✔ | ✔ (offre, état) | fenêtre | ✔ | annuler ✔ | terminer | **filtre entreprise** |
| Agenda | ✔ | ✔ | fenêtre | ✔ | annuler ✔ | tenu, reporter | filtre entreprise par l'adresse |
| Ambassadeurs | ✔ | ✔ (origine, recherche) | ✘ | ✔ | **✘** | — | **archiver, fiche, filtre entreprise** |
| Commissions | (née d'un agrément) | ✔ | ✘ | — | annuler ✔ | débloquer, attente, verser, montant | fiche (basse priorité) |
| Apprenants | ✔ | ✔ | ✘ | ✔ | supprimer ✔ | inscrire | **fiche** |
| Inscriptions | ✔ (depuis apprenant ou session) | ✔ | ✘ | **pas de modification** (par conception) | annuler ✔ | confirmer, replacer | **bouton « Nouvelle inscription » sur la page Inscriptions** |
| Sessions | ✔ | ✔ | ✔ | ✔ | annuler ✔ | ouvrir, reporter | **clôturer (S5.3)** |
| Catalogue | ✔ | ✔ | — | ✔ | archiver ✔ | — | rubriques adressables |

Deux remarques de fond :
- **« Modifier une inscription »** : volontairement absent. Une inscription engage une place et un agrément ; la corriger = **l'annuler** ou la **replacer**. Je recommande de ne pas ajouter de modification libre.
- **« Clôturer une session »** : c'est S5.3 (présences, évaluations, certifications) ; ce n'est pas un simple bouton.

## 7. Travail à produire

### 7.1 Écrans à créer
Fiches : contact, offre, opportunité, agrément, ambassadeur, apprenant · page **Agréments** (liste) · page **Droits** (matrice rôles et permissions, lecture seule) · bouton **Nouvelle inscription** · menu hiérarchique et pied de menu « Compte ».

### 7.2 Écrans à modifier
Menu latéral · hub · fiche entreprise (liens contextuels, noms cliquables) · Agenda, Opportunités, Offres, Contacts, Relances, Commissions, Ambassadeurs (filtres par l'adresse, pastille) · Catalogue (rubriques adressables) · listes où figure une référence (inscriptions, relances, rendez-vous, agréments).

### 7.3 Composants réutilisables
`EntityLink`, `EntitySheet`, `ContextFilter`, `Breadcrumbs`, `useUrlFilters`, `NavGroup` (domaine repliable accessible).

### 7.4 Endpoints à créer ou compléter
| Endpoint | Pourquoi | Droit |
|---|---|---|
| `GET /followups?companyId=` | filtre contextuel | `bd.followup.read` (déjà) |
| `GET /ambassadors?companyId=` | filtre contextuel | `bd.ambassador.read` (déjà) |
| `POST /ambassadors/:id/status` (archiver, réactiver) | archivage réversible | `bd.ambassador.update` (déjà), ou un droit dédié si vous le souhaitez |
| `POST /offers/:id/clone` | cloner une offre | `bd.offer.create` (déjà) |
| `GET /access/matrix` (lecture seule) | page Droits | `iam.role.read` (à vérifier au catalogue) |

**Aucune nouvelle table** pour ce chantier, hormis un statut d'archivage sur les ambassadeurs.

## 8. Priorités et feuille de route

**Préalable (hors chantier, 1 à 2 h)** : valider et commiter **S5.2b**. Le menu et la page Sessions/Inscriptions changent dans les deux chantiers ; les enchaîner dans cet ordre évite des conflits.

| Priorité | Lot | Contenu | Durée estimée |
|---|---|---|---|
| **P0** | **N1 — Menu par domaines et compte en pied** | D-NAV-1, D-NAV-4 ; hub aligné ; tests de droits (un domaine vide n'apparaît pas) ; accessibilité au clavier | 0,5 jour |
| **P0** | **N2 — Filtres contextuels** | D-NAV-2 ; `ContextFilter`, `useUrlFilters`, `Breadcrumbs` ; 8 pages ; 2 endpoints (relances, ambassadeurs) ; liens de la fiche entreprise | 1 jour |
| **P1** | **N3 — Fiches contact, offre, opportunité** + `EntityLink`/`EntitySheet` | D-NAV-3 pour les trois entités les plus utilisées ; noms cliquables partout | 1,5 jour |
| **P1** | **N4 — Agréments : page liste et fiche** ; **Nouvelle inscription** | colmate la seule rupture de parcours CRM → Investudy | 0,5 jour |
| **P2** | **N5 — Ambassadeurs** (archivage, fiche) et **Offres** (cloner) ; fiche apprenant | observations 2, 3, 6 | 1 jour |
| **P2** | **N6 — Catalogue adressable**, **page Droits** | confort et transparence | 0,5 jour |
| **P3** | Fiche commission ; volet latéral éventuel ; favoris | à reconsidérer après usage | — |

**Capacité** : P0 + P1 représentent **environ 3,5 jours**. Le sprint MVP de la semaine porte aussi sur **Ressources humaines** (aucun code aujourd'hui) et le **Compte**. Pour tenir **RH + Compte + CRM fonctionnel** dans la semaine, je propose : **N1 et N2 dès le jour 1** (ils changent le plus l'impression d'ensemble pour le moins de travail), **N3 et N4 ensuite**, et le **cadrage RH en parallèle** (il faut vos règles métier avant d'écrire du code). **Le déploiement n'est pas décidé** (hébergement en suspens) : c'est le risque principal pour une « MVP à déployer » cette semaine.

## 9. Décision
**« Applique les recommandations »** (2026-11-09) : D-NAV-1 B, D-NAV-2 B, D-NAV-3 B, D-NAV-4 A, consignées en **D51 à D54**. Précisions de la Direction produit : **S5.2b commité d'abord** (fait : `ac2ab0b`) ; **les ambassadeurs intègrent un archivage réversible** (archiver et réactiver, jamais de suppression) ; **la section Ressources humaines vient après** ce chantier.

Ordre d'exécution : N1 (menu) → N2 (filtres contextuels) → N3 (fiches contact, offre, opportunité) → N4 (agréments, nouvelle inscription) → N5 (ambassadeurs, clonage d'offre, fiche apprenant) → N6 (catalogue adressable, page Droits) → **Ressources humaines**.
