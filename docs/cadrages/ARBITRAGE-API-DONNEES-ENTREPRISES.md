# Arbitrage — Données manquantes dans l'API des entreprises

**Date** : 2026-10-21 · **Statut** : à décider · **Origine** : constat de l'écart entre le mockup et l'application (D38, `ECART-MOCKUP-VS-REEL.md`).

> Méthode : [METHODE-D-ARBITRAGE.md](../METHODE-D-ARBITRAGE.md). **Aucune décision n'est prise dans ce document** : les recommandations sont des avis, la décision est celle de la direction produit.

## 1. La question en une phrase
Le tableau **Entreprises** de l'application est loin du mockup. **Quoi ajouter à l'API, quand, et avec quelles précautions ?** Quatre décisions à prendre, de la plus structurante (ARB-API-1) à la plus ciblée (ARB-API-4).

## 2. Ce que l'API fournit déjà
| Information du mockup | Disponible dans l'API aujourd'hui ? | Affichée aujourd'hui ? |
|---|---|---|
| Nom, secteur, statut | Oui | Oui |
| **Pays** | **Oui** (`country`) | Non — peut l'être **sans toucher à l'API** |
| **Date de création** | **Oui** (`createdAt`) | Non — peut l'être **sans toucher à l'API** |
| Responsable | Identifiant seulement (`ownerUserId`) | Non — le nom exige ARB-API-2 |
| Dernière modification | En base, non exposée | Non |
| Dernière activité | Non (dépend de S4.2 et S4.3) | Non |
| Valeur estimée | Non (dépend des opportunités, S4.3) | Non |
| Filtres : statut, « les miennes », tri | Non (la liste accepte seulement page, taille, recherche) | Non |
| Compteurs par statut | Non | Non |
| Export, réassignation | Non (actions sensibles) | Non |

## 3. Les décisions
| N° | Question | Options | Ma recommandation |
|---|---|---|---|
| ARB-API-1 | Quand et jusqu'où enrichir l'API | A statu quo · B mini-lot maintenant · C intégrer à S4.1 après le cadrage UX · D lot complet | **C** |
| ARB-API-2 | Nom du responsable | A port d'annuaire côté serveur · B endpoint dédié · C ne pas l'afficher | **A** |
| ARB-API-3 | Export et réassignation | A cadrage de sécurité dédié · B avec S4.1 · C jamais | **A** |
| ARB-API-4 | « Dernière activité » | A attendre la vraie donnée · B « Dernière modification » · C estimation via l'audit | **A** |

---

### ARB-API-1 — Quand et jusqu'où enrichir l'API des entreprises

**Contexte.** Le tableau Entreprises réel n'a que 3 colonnes de données alors que le mockup en montre 7. Une partie de l'écart vient de champs que l'API ne fournit pas, une autre de modules qui n'existent pas encore. La question : faut-il enrichir l'API des entreprises maintenant, au démarrage de S4.1, ou laisser les champs arriver avec leurs modules ?

**Déjà décidé, ne bouge pas.** Un élément du mockup n'apparaît que s'il a une donnée réelle derrière lui ; la visibilité des entreprises suit la portée de l'utilisateur (Propre / Équipe / Tous) et se calcule côté serveur ; S4.1 livre API et écrans ensemble (DEC-005) ; le cadrage UX précède S4.1 et décide quelles colonnes et quels filtres comptent vraiment.

**Options.**

**A. Statu quo : ne rien prévoir de plus** — Les colonnes manquantes arriveront avec leurs modules (contacts S4.1, offres S4.2, opportunités S4.3), sans plan d'ensemble pour les tableaux.

| | |
|---|---|
| Avantages | Aucun travail ni risque ajouté ; pas de champ construit pour rien. |
| Inconvénients | L'écart avec le mockup persiste jusqu'à S4.3 ; chaque module décide seul de ses colonnes, risque d'incohérence ; D38 reste ouverte. |
| Impact UX | Tableau Entreprises simple pendant plusieurs sessions. |
| Impact métier | Aucune amélioration du pilotage commercial à court terme. |
| Impact technique | Aucun. |
| Impact maintenance | Dette D38 qui vieillit. |
| Coût et délai | 0 |
| Réversibilité | Excellente. |

**B. Mini-lot maintenant (avant le cadrage UX)** — Session courte (≈ 0,6) : filtre par statut et « les miennes », tri, compteurs par statut, pays et date de création affichés, nom du responsable.

| | |
|---|---|
| Avantages | Résultat visible tout de suite ; écart avec le mockup réduit. |
| Inconvénients | Écarte l'ordre DEC-005 ; construit avant que le cadrage UX ait dit quelles colonnes comptent (risque de refaire) ; une session de plus avant S4.1. |
| Impact UX | Tableau plus riche immédiatement. |
| Impact métier | Meilleur suivi des entreprises dès maintenant. |
| Impact technique | Nouveaux filtres, endpoint de compteurs, nom du responsable (voir ARB-API-2). |
| Impact maintenance | Contrat d'API figé trop tôt. |
| Coût et délai | ≈ 0,6 session |
| Réversibilité | Bonne. |

**C. Intégrer à S4.1, après le cadrage UX** — Le périmètre de S4.1 inclut un lot « tableaux » : filtres, tri, compteurs, colonnes décidées en séance de cadrage UX, nom du responsable.

| | |
|---|---|
| Avantages | Colonnes et filtres choisis par vous en séance, donc pas de refonte ; cohérent avec « API et écrans ensemble » ; une seule recette. |
| Inconvénients | Le résultat n'est visible qu'en S4.1 ; S4.1 s'allonge d'environ 0,5 session. |
| Impact UX | Tableau conçu avec vous, avec les contacts dans le même mouvement. |
| Impact métier | Les besoins réels pilotent le contenu. |
| Impact technique | Même travail qu'en B, mieux ciblé. |
| Impact maintenance | Contrat d'API figé au bon moment. |
| Coût et délai | ≈ 0,5 session dans S4.1 |
| Réversibilité | Bonne. |

**D. Lot complet : B + export + réassignation** — En plus du mini-lot, export des listes et réassignation groupée (barre de sélection).

| | |
|---|---|
| Avantages | La barre de sélection devient utile ; mockup quasi complet. |
| Inconvénients | Export = risque de fuite de la liste de prospects ; réassignation modifie les portées de visibilité ; décisions de sécurité non cadrées. |
| Impact UX | Barre d'actions complète. |
| Impact métier | Gain de productivité, mais risque métier. |
| Impact technique | Nouvelles permissions, step-up MFA, audit, limites de volume. |
| Impact maintenance | Surface d'attaque et tests de droits en plus. |
| Coût et délai | ≈ 1,5 session |
| Réversibilité | Moyenne (permissions publiées). |

**Grille** (notes de 1 à 5, 5 = favorable ; poids fixés avant notation ; totaux calculés).

| Critère (poids) | A | B | C | D |
|---|---|---|---|---|
| Valeur métier (5) | 2 | 4 | 4 | 4 |
| Risque (favorable = faible) (5) | 5 | 3 | 4 | 2 |
| Cohérence architecture / décisions (4) | 4 | 3 | 5 | 2 |
| Réversibilité (4) | 5 | 4 | 4 | 3 |
| Coût et délai (favorable = faible) (3) | 5 | 3 | 3 | 1 |
| **Total sur 5** | **4,10** | **3,43** | **4,05** | **2,52** |

**Risques.**

| Risque | Probabilité | Impact | Parade |
|---|---|---|---|
| Colonnes construites puis jugées inutiles (B) | Moyenne | Moyen | Attendre le cadrage UX (C) |
| Fuite d'informations via l'export ou le nom du responsable | Faible | Élevé | Voir ARB-API-2 et ARB-API-3 : permissions, audit, step-up, volumes bornés |
| Tableau Entreprises trop pauvre en démonstration (A) | Élevée | Faible | Ajouter dès maintenant les champs déjà fournis par l'API (pays, date de création) |

**Dette induite.** A : D38 vieillit. B : contrat figé trop tôt. C : S4.1 plus longue. D : sécurité à cadrer.

**Recommandation.** Option **C**. A et C sont quasi à égalité dans la grille (4,10 contre 4,05, écart non significatif) parce qu'A ne coûte rien, mais A laisse D38 sans échéance ; C obtient le même résultat avec un périmètre décidé en séance de cadrage UX. **Complément sans décision à prendre** : le pays et la date de création sont déjà fournis par l'API ; je peux les afficher dès maintenant sans toucher à l'API. Ferait changer d'avis : une démonstration à un tiers avant S4.1 qui exigerait un tableau plus riche (alors B).

**Décision (direction produit).** ☐ À renseigner : option retenue · date · motif · réserves.

**Trace.** À enregistrer dans `docs/QUESTIONS-ET-DECISIONS.md` (et, pour le design, dans `docs/design/decisions/`).

---

### ARB-API-2 — Comment afficher le nom du responsable d'une entreprise

**Contexte.** L'API fournit le responsable sous forme d'identifiant (`ownerUserId`), pas de nom. L'afficher exige un nom. Or le module Business Development n'a pas le droit de dépendre du module Identité, et un chargé de compte n'a pas le droit de lister les utilisateurs (permission d'administration).

**Déjà décidé, ne bouge pas.** Architecture en contextes séparés (règles `pnpm arch`) ; chaque information visible suit les droits de l'appelant ; données personnelles minimisées.

**Options.**

**A. Nom calculé côté serveur par un port d'annuaire** — Un port « annuaire des utilisateurs » (interface neutre), implémenté par le module Identité, fournit seulement le nom d'affichage des propriétaires présents dans la page de résultats.

| | |
|---|---|
| Avantages | Aucun nouvel endpoint exposé ; seuls les noms des propriétaires des lignes affichées sortent ; architecture respectée. |
| Inconvénients | Un port et son adaptateur à écrire ; une lecture groupée de plus par page. |
| Impact UX | Nom du responsable dans la liste. |
| Impact métier | Qui suit quel dossier est visible. |
| Impact technique | Port dans le noyau partagé, adaptateur Identité, requête groupée. |
| Impact maintenance | Un contrat de plus, mais interne. |
| Coût et délai | ≈ 0,15 session |
| Réversibilité | Excellente. |

**B. Endpoint d'annuaire dédié (identifiant → nom)** — Nouvelle route accessible à tout utilisateur connecté, appelée par l'interface pour résoudre les noms.

| | |
|---|---|
| Avantages | Réutilisable par toute l'interface. |
| Inconvénients | Nouvelle surface d'exposition : permet d'énumérer des noms d'employés par identifiant ; permission et limites à concevoir. |
| Impact UX | Identique. |
| Impact métier | Aucun gain par rapport à A. |
| Impact technique | Route, permission, limitation du débit, tests de droits. |
| Impact maintenance | Contrat public à maintenir. |
| Coût et délai | ≈ 0,3 session |
| Réversibilité | Moyenne. |

**C. Ne pas afficher le responsable** — La colonne Responsable est abandonnée ; le filtre « Les miennes » reste.

| | |
|---|---|
| Avantages | Aucun développement ni exposition. |
| Inconvénients | Manque pour un responsable commercial qui supervise une équipe. |
| Impact UX | Moins d'information. |
| Impact métier | Supervision d'équipe plus difficile. |
| Impact technique | Aucun. |
| Impact maintenance | Aucun. |
| Coût et délai | 0 |
| Réversibilité | Excellente. |

**Grille** (notes de 1 à 5, 5 = favorable ; poids fixés avant notation ; totaux calculés).

| Critère (poids) | A | B | C |
|---|---|---|---|
| Valeur métier (5) | 4 | 4 | 2 |
| Risque (favorable = faible) (5) | 5 | 2 | 5 |
| Cohérence architecture / décisions (4) | 5 | 3 | 3 |
| Réversibilité (4) | 5 | 3 | 5 |
| Coût et délai (favorable = faible) (3) | 4 | 3 | 5 |
| **Total sur 5** | **4,62** | **3,00** | **3,90** |

**Risques.**

| Risque | Probabilité | Impact | Parade |
|---|---|---|---|
| Exposer des noms hors portée | Faible | Moyen | Résolution limitée aux propriétaires des lignes déjà autorisées par la portée ; test dédié |

**Dette induite.** A : un port à maintenir.

**Recommandation.** Option **A** : elle donne le nom sans créer de route d'annuaire ni exposer de personnes qui ne figurent pas déjà dans les résultats autorisés.

**Décision (direction produit).** ☐ À renseigner : option retenue · date · motif · réserves.

**Trace.** À enregistrer dans `docs/QUESTIONS-ET-DECISIONS.md` (et, pour le design, dans `docs/design/decisions/`).

---

### ARB-API-3 — Export et réassignation des entreprises

**Contexte.** Le mockup prévoit « Exporter » et « Réassigner » dans la barre de sélection. Ces actions sont sensibles : un export copie la liste de prospects hors de l'application ; une réassignation change la portée de visibilité (Propre / Équipe / Tous) de ceux qui voient l'entreprise.

**Déjà décidé, ne bouge pas.** Actions sensibles : permission dédiée, nouvelle preuve MFA (step-up), audit de chaque exécution ; suppression logique uniquement.

**Options.**

**A. Un cadrage de sécurité dédié avant de livrer** — Ni export ni réassignation tant qu'un cadrage court n'a pas fixé : qui, quel volume, quel format, quelles preuves, quelle conservation de la trace.

| | |
|---|---|
| Avantages | Décisions de sécurité prises à froid ; barre de sélection utile dès qu'elles sont livrées. |
| Inconvénients | Une étape de plus ; boutons absents d'ici là. |
| Impact UX | Boutons absents (honnête). |
| Impact métier | Cas d'usage précisés avant de coder. |
| Impact technique | Aucun avant le cadrage. |
| Impact maintenance | Aucun. |
| Coût et délai | ≈ 0,2 session de cadrage |
| Réversibilité | Excellente. |

**B. Livrer avec S4.1 sans cadrage séparé** — Export CSV et réassignation conçus au fil de S4.1.

| | |
|---|---|
| Avantages | Barre de sélection utile plus tôt. |
| Inconvénients | Décisions de sécurité prises dans le feu du développement ; risque de fuite ou de visibilité inattendue. |
| Impact UX | Barre d'actions complète. |
| Impact métier | Gain rapide, risque non évalué. |
| Impact technique | Permissions, step-up, audit, volumes. |
| Impact maintenance | Tests de droits en plus. |
| Coût et délai | ≈ 0,8 session |
| Réversibilité | Moyenne. |

**C. Ne jamais exporter ni réassigner en masse** — La barre de sélection reste informative ; les changements se font un à un.

| | |
|---|---|
| Avantages | Risque minimal. |
| Inconvénients | Réassigner une équipe dossier par dossier est pénible ; la barre de sélection reste sans actions. |
| Impact UX | Sélection peu utile. |
| Impact métier | Productivité limitée. |
| Impact technique | Aucun. |
| Impact maintenance | Aucun. |
| Coût et délai | 0 |
| Réversibilité | Excellente. |

**Grille** (notes de 1 à 5, 5 = favorable ; poids fixés avant notation ; totaux calculés).

| Critère (poids) | A | B | C |
|---|---|---|---|
| Valeur métier (5) | 3 | 4 | 2 |
| Risque (favorable = faible) (5) | 5 | 2 | 5 |
| Cohérence architecture / décisions (4) | 5 | 3 | 4 |
| Réversibilité (4) | 5 | 3 | 5 |
| Coût et délai (favorable = faible) (3) | 4 | 2 | 5 |
| **Total sur 5** | **4,38** | **2,86** | **4,10** |

**Risques.**

| Risque | Probabilité | Impact | Parade |
|---|---|---|---|
| Fuite de la liste de prospects par export | Moyenne | Élevé | Cadrage : permission dédiée, step-up, volume borné, audit, filtres obligatoires |
| Réassignation qui rend un dossier visible à de mauvaises personnes | Moyenne | Élevé | Réassigner uniquement dans la portée de l'appelant ; audit avant/après ; test de matrice de droits |

**Dette induite.** A : un cadrage de plus. B : décisions non cadrées. C : barre de sélection sans actions (D37).

**Recommandation.** Option **A**. Les deux actions touchent la sécurité des données commerciales ; un cadrage court, mené après le cadrage UX, vaut mieux qu'une décision improvisée en cours de S4.1. Ferait changer d'avis : une demande métier urgente d'export (alors B, avec step-up obligatoire).

**Décision (direction produit).** ☐ À renseigner : option retenue · date · motif · réserves.

**Trace.** À enregistrer dans `docs/QUESTIONS-ET-DECISIONS.md` (et, pour le design, dans `docs/design/decisions/`).

---

### ARB-API-4 — La colonne « Dernière activité »

**Contexte.** Le mockup affiche « il y a 2 h », « il y a 3 jours »… Une vraie dernière activité vient des rendez-vous, offres et relances, qui n'existent pas avant S4.2 et S4.3. L'API connaît seulement la date de création ; la date de dernière modification existe en base mais n'est pas exposée.

**Déjà décidé, ne bouge pas.** Aucune donnée fictive ; un libellé doit dire ce qu'il mesure.

**Options.**

**A. Attendre la vraie dernière activité (S4.2 / S4.3)** — La colonne apparaît quand les rendez-vous et offres existent.

| | |
|---|---|
| Avantages | Libellé exact, donnée utile (suivi commercial réel). |
| Inconvénients | Colonne absente pendant plusieurs sessions. |
| Impact UX | Colonne manquante jusque-là. |
| Impact métier | Bonne information le moment venu. |
| Impact technique | Aucun maintenant. |
| Impact maintenance | Aucun. |
| Coût et délai | 0 |
| Réversibilité | Excellente. |

**B. Afficher « Dernière modification » maintenant** — Exposer la date de dernière mise à jour de la fiche et l'afficher sous ce libellé exact.

| | |
|---|---|
| Avantages | Colonne présente tout de suite, sans confusion si le libellé est exact. |
| Inconvénients | Mesure l'édition de la fiche, pas le suivi commercial ; peut être prise pour de l'activité ; à remplacer plus tard. |
| Impact UX | Colonne présente. |
| Impact métier | Information limitée. |
| Impact technique | Exposer un champ existant. |
| Impact maintenance | Colonne à retirer ou remplacer en S4.3. |
| Coût et délai | ≈ 0,05 session |
| Réversibilité | Bonne. |

**C. Afficher une activité estimée à partir de l'audit** — Déduire l'activité des lignes d'audit (consultations, modifications).

| | |
|---|---|
| Avantages | Colonne présente, ressemble à l'activité. |
| Inconvénients | Mesure l'usage de l'application, pas le suivi du client ; calcul lourd sur une table partitionnée ; risque de faux sens. |
| Impact UX | Trompeuse. |
| Impact métier | Peut fausser les décisions. |
| Impact technique | Requêtes coûteuses. |
| Impact maintenance | Dette. |
| Coût et délai | ≈ 0,4 session |
| Réversibilité | Faible. |

**Grille** (notes de 1 à 5, 5 = favorable ; poids fixés avant notation ; totaux calculés).

| Critère (poids) | A | B | C |
|---|---|---|---|
| Valeur métier (5) | 3 | 2 | 2 |
| Risque (favorable = faible) (5) | 5 | 4 | 2 |
| Cohérence architecture / décisions (4) | 5 | 3 | 1 |
| Réversibilité (4) | 5 | 4 | 2 |
| Coût et délai (favorable = faible) (3) | 5 | 4 | 2 |
| **Total sur 5** | **4,52** | **3,33** | **1,81** |

**Risques.**

| Risque | Probabilité | Impact | Parade |
|---|---|---|---|
| Une « activité » qui n'en est pas une influence des décisions commerciales | Moyenne | Moyen | Libellé exact ou colonne absente ; jamais d'estimation déguisée |

**Dette induite.** B : colonne à remplacer. C : calcul à retirer.

**Recommandation.** Option **A** : on attend la donnée réelle. La date de création est déjà disponible et peut s'afficher dès maintenant sous le libellé « Créée le » (sans décision supplémentaire).

**Décision (direction produit).** ☐ À renseigner : option retenue · date · motif · réserves.

**Trace.** À enregistrer dans `docs/QUESTIONS-ET-DECISIONS.md` (et, pour le design, dans `docs/design/decisions/`).

---

## 4. Effet cumulé si les recommandations sont retenues
- **Maintenant, sans décision supplémentaire** : afficher **Pays** et **Créée le** dans le tableau Entreprises (champs déjà fournis). Petite retouche d'interface, sans toucher à l'API.
- **Dans S4.1** (après le cadrage UX) : filtres, tri, compteurs, nom du responsable (par port d'annuaire), avec les colonnes que vous aurez choisies.
- **Cadrage dédié** pour l'export et la réassignation, après le cadrage UX.
- **Plus tard** : dernière activité et valeur estimée avec les modules qui les produisent (S4.2, S4.3).
- **Dettes** : D38 reçoit une échéance (S4.1) ; D37 (actions groupées) est liée au cadrage export/réassignation.

## 5. Comment décider
Répondez par exemple : « **ARB-API-1 : C ; ARB-API-2 : A ; ARB-API-3 : A ; ARB-API-4 : A** », ou indiquez vos écarts. Je consigne les choix dans le registre (`QUESTIONS-ET-DECISIONS.md`, D21), j'ajuste le plan de S4.1 et je peux afficher Pays et Créée le tout de suite.
