# Cadrage : retours de tests locaux UX-01 à UX-04

*2026-10-22 · analyse avant implémentation · aucune ligne de code produite. Source : vos retours de tests et relecture du code (`components/auth/*`, `app/(app)/account`, `app/(app)/admin/users`, `app/mfa`, `components/modal.tsx`). Les comportements décrits ont été lus dans le code, **pas rejoués dans un navigateur**.*

> Méthode d'arbitrage (`docs/METHODE-D-ARBITRAGE.md`) : les choix structurants (UX-02, UX-04) sont présentés avec options, grille pondérée (poids 5, 5, 4, 4, 3, total maximal 105) et recommandation. **La décision vous appartient.**

## 0. Synthèse

| | Sujet | Criticité du problème | Recommandation | Priorité |
|---|---|---|---|---|
| UX-01 | Œil sur les mots de passe | Moyenne | Un composant unique `PasswordField` partout | **Haute** (effort faible, gain large) |
| UX-02 | Rôles et permissions | Haute (une erreur d'attribution = un droit en trop) | Sélection **par groupes** + **aperçu des droits par module** en lecture seule | Moyenne (plus gros chantier, vos choix d'abord) |
| UX-03 | Confirmation avant régénération | **Haute** (action irréversible sans garde-fou) | Fenêtre de confirmation « danger », focus sur Annuler, puis MFA récent | **Haute** |
| UX-04 | Export contrôlé des codes de secours | **Haute** (perte des codes = compte bloqué) | Copier + TXT + PDF (impression), affichage limité à l'écran, protection à la sortie | **Haute** (copie/TXT/sortie), Faible (PDF) |

**Écart avec votre liste d'écrans (UX-01)** : seuls 4 écrans portent réellement un champ mot de passe. « Mot de passe oublié » ne demande que l'adresse e-mail, « Activation MFA » ne demande qu'un code à 6 chiffres, et le formulaire d'invitation côté administrateur (e-mail, nom, rôles) n'en a pas : c'est l'invité qui choisit son mot de passe sur la page d'activation. « Changement de mot de passe » et « Mon compte » sont le même écran.

**Constat à connaître (UX-04)** : l'écran d'activation MFA offre déjà *Copier* et *Télécharger (TXT)*, une case « J'ai conservé ces codes » et un avertissement avant de quitter la page. L'écran **Mon compte**, lui, affiche les nouveaux codes **sans aucune copie ni téléchargement**, jusqu'au bouton « Masquer ». Le problème que vous avez rencontré vient donc de cet écran.

---

## 1. UX-01 : afficher / masquer le mot de passe

### 1.1 Analyse UX
- **Problème** : mots de passe longs (12 caractères minimum, phrases de passe) saisis à l'aveugle ; la confirmation du nouveau mot de passe double la difficulté.
- **Impact utilisateur** : fautes de frappe, échecs de connexion comptés contre le verrouillage, abandon du parcours d'activation.
- **Criticité** : Moyenne.

### 1.2 Analyse UI
- **Composants à modifier** : `app/login/page.tsx` (1 champ), `components/auth/new-password-fields.tsx` (2 champs, réinitialisation et activation d'invitation), `app/(app)/account/page.tsx` (3 champs). Total : **6 champs**, **un seul composant** à créer.
- **Règles visuelles** : bouton **pictogramme seul** (EXD-11) à droite du champ, dans le champ ; icône œil quand le texte est masqué, œil barré quand il est visible ; cible ≥ 24 px (WCAG 2.5.8), visible au clavier (anneau de focus du design system), contraste 3:1 minimum.
- **Comportement** : clic = bascule ; ordre de tabulation : champ puis bouton ; la valeur et la position du curseur sont conservées.
- **Piège réel** : Microsoft Edge affiche **déjà** sa propre icône œil dans les champs mot de passe. Il faut la masquer (`::-ms-reveal`) sinon deux icônes se superposent.

### 1.3 Écrans
Connexion · Réinitialisation du mot de passe · Activation d'invitation (page de l'invité) · Mon compte, « Changer le mot de passe » (3 champs).

### 1.4 Design System
- **Nouveau composant** `PasswordField` (champ + bouton), états : masqué, visible, focus, désactivé, erreur.
- **Deux icônes** à ajouter à `icon.tsx` : `eye`, `eye-off`.
- Accessibilité : bouton `type="button"`, nom accessible constant « Afficher le mot de passe » avec `aria-pressed` (le nom ne change pas, l'état est annoncé) ; jamais de valeur du champ dans une région `aria-live`.

### 1.5 Sécurité
- **Risques** : lecture par-dessus l'épaule, partage d'écran, capture d'écran.
- **Protections** : retour automatique au mode masqué à l'envoi du formulaire, quand l'onglet perd la visibilité, et après 30 s ; l'état n'est jamais conservé (ni stockage navigateur, ni URL) ; `autocomplete` inchangé pour ne pas gêner les gestionnaires de mots de passe ; la CSP n'est pas touchée.

### 1.6 Recommandation
Un composant unique, un bouton par champ (indépendants, comportement identique partout). **Priorité Haute.**

---

## 2. UX-02 : rôles et permissions

### 2.1 Analyse UX
- **État actuel** : une liste de 10 cases à cocher avec une description ; aucune indication des **droits** obtenus ; aucune aide à la désélection (« Tout effacer »), ni compteur de sélection ; l'écran ne dit pas que les rôles **se cumulent** (union des droits, portée la plus large retenue).
- **Impact utilisateur** : l'administrateur ne sait pas ce qu'il accorde réellement ; risque d'attribuer un rôle trop large ou d'oublier d'en retirer un.
- **Criticité** : Haute (c'est un outil d'administration des droits).

### 2.2 Contraintes du modèle (importantes)
- L'API attribue des **rôles**, jamais des permissions isolées ; `PUT /admin/users/:id/roles` remplace la liste complète.
- Les rôles s'**additionnent** ; pour une même permission, la portée la plus large l'emporte.
- Règles serveur à refléter dans l'interface : on ne modifie **pas ses propres rôles** ; on ne retire pas le **dernier Super administrateur actif** ; l'invitation et la modification des rôles exigent un **MFA récent**.
- Les permissions de chaque rôle (95 permissions, portées Propre / Équipe / Tous) sont **déjà fournies** par `GET /admin/roles` : aucune évolution d'API n'est nécessaire pour les afficher.

### 2.3 Options comparées

| Option | Description |
|---|---|
| **0. Statu quo** | Liste de cases à cocher avec description |
| **A. Cases à cocher améliorées** | Même principe, avec compteur, « Tout effacer », recherche, aire de clic élargie |
| **B. Sélecteur par groupes** | Rôles regroupés par famille métier (Pilotage, Commercial, Investudy, Support et fonctions support, Administration), chaque rôle est une carte sélectionnable avec pastilles de sélection |
| **C. Permissions par module** | On choisit des permissions regroupées par module (iam, bd, docs, audit…) |
| **B+C. Groupes + aperçu** | Sélection par groupes (B), avec un panneau « Droits effectifs » en lecture seule, regroupé par module (C), qui se met à jour à chaque sélection |

| Critère (poids) | 0 | A | B | C | B+C |
|---|---|---|---|---|---|
| Lisibilité des rôles et des droits (5) | 2 | 3 | 4 | 3 | 5 |
| Facilité de sélection et de désélection (5) | 2 | 4 | 4 | 2 | 4 |
| Réduction du risque d'erreur d'attribution (4) | 2 | 3 | 3 | 2 | 5 |
| Effort et risque techniques (4, 5 = faible) | 5 | 4 | 3 | 1 | 3 |
| Accessibilité (3) | 3 | 4 | 4 | 3 | 3 |
| **Total / 105** | **57** | **75** | **76** | **46** | **86** |

**Option C seule, écartée comme mode de sélection** : elle contredit le modèle (l'API n'attribue que des rôles) et demanderait une évolution de l'API et de la matrice de droits, donc un nouvel arbitrage de sécurité. Gardée **en lecture seule** dans B+C.

### 2.4 Analyse UI (option recommandée B+C)
- **Composants à modifier** : `RoleChoices`, `InviteDialog`, `RolesDialog` (dans `app/(app)/admin/users/page.tsx`).
- **Mise en page** : fenêtre large (deux colonnes ≥ 900 px, une colonne en dessous) : à gauche les groupes et leurs cartes de rôle, à droite « Droits effectifs » regroupés par module, avec la portée en pastille (Propres / Équipe / Tous) et un compteur « 3 rôles, 41 permissions ».
- **Comportement** : une carte entière est cliquable (pas seulement la case) ; barre de sélection en haut : « 2 rôles sélectionnés · **Tout désélectionner** » ; rôles retirés ou ajoutés mis en évidence par rapport à l'état d'origine (« + Responsable commercial », « − Support ») avant validation ; **Super administrateur** avec avertissement (« accès complet, toutes les actions sont auditées ») ; rôles de sa propre fiche **désactivés avec explication** (« Vous ne pouvez pas modifier vos propres rôles ») ; validation désactivée si aucun rôle n'est choisi.
- **Accessibilité** : cases à cocher natives (groupes en `fieldset`/`legend`), compteur annoncé en région `role="status"`, l'aperçu en accordéons natifs (`details`), tout opérable au clavier.

### 2.5 Écrans
Utilisateurs (liste) → fenêtres « Inviter un utilisateur », « Modifier les rôles ». « Modification utilisateur » (nom, responsable) n'a pas de rôles : inchangé.

### 2.6 Design System
- **Nouveaux composants** : `RoleSelector` (groupes, cartes), `RightsPreview` (accordéons par module, pastilles de portée), `SelectionSummary` (compteur et « Tout désélectionner »).
- **États** : carte par défaut, survol, focus, sélectionnée, désactivée (propre compte), avertissement (Super administrateur), modifiée (ajout / retrait par rapport à l'original).

### 2.7 Sécurité
- Le **serveur reste la seule source de vérité** : l'aperçu informe, il n'autorise rien.
- Le calcul « droits effectifs » côté interface (union, portée la plus large) duplique une règle serveur : **un test automatique** devra comparer les deux pour éviter toute dérive.
- Aucune nouvelle donnée exposée : `GET /admin/roles` n'est déjà lisible qu'avec `iam.role.read`.
- Les règles serveur (propres rôles, dernier Super administrateur, MFA récent) restent l'ultime garde-fou : l'interface n'en remplace aucune.

### 2.8 Recommandation
**Option B+C** (86/105). Priorité **Moyenne** (chantier le plus lourd, dépend de vos choix ci-dessous).

---

## 3. UX-03 : confirmation avant régénération des codes de secours

### 3.1 Analyse UX
- **Problème** : le bouton « Générer de nouveaux codes » appelle directement la régénération ; le texte annonce « Une confirmation par code vous sera demandée », ce qui prête à confusion avec la confirmation proprement dite.
- **Impact** : un clic accidentel invalide les anciens codes, que l'utilisateur a peut-être rangés ; s'il ne sauvegarde pas les nouveaux, il perd son filet de sécurité.
- **Criticité** : Haute.

### 3.2 Contenu de la fenêtre
- **Titre** : « Remplacer vos codes de secours ? »
- **Corps** :
  - « Vos codes actuels seront **invalidés immédiatement** et ne fonctionneront plus. »
  - « Cette action est **irréversible**. »
  - « Les nouveaux codes ne seront affichés **qu'une seule fois**. Enregistrez-les avant de quitter la page. »
- **Actions** : **Annuler** (bouton secondaire, **focus initial**) et **Remplacer mes codes** (bouton danger). Échap = Annuler.
- **Hiérarchie visuelle** : pictogramme d'avertissement, titre, trois puces courtes (la deuxième en gras), boutons alignés à droite ; le bouton danger ne reçoit pas le focus au départ.
- **Messages de sécurité** : après confirmation, le **MFA récent** est redemandé si nécessaire (déjà géré) ; message de réussite sobre ; en cas d'échec de la régénération, les anciens codes restent valables (la génération est atomique côté serveur : à vérifier par test).

### 3.3 Analyse UI et Design System
- Réutiliser `Modal` (focus piégé, Échap, fond inerte, déjà accessible) ; **ajouter une variante `danger`** (couleurs, pictogramme).
- Ordre des étapes : bouton → **confirmation** → **MFA récent** → génération → affichage unique.

### 3.4 Sécurité
- Risque : clic accidentel ou « clickjacking » (déjà couvert par `X-Frame-Options: DENY`).
- Recommandation complémentaire (non obligatoire) : **e-mail d'information** à l'utilisateur après régénération. Il dépend du service de messagerie (Microsoft 365, pas encore accessible) : à inscrire en dette.

### 3.5 Recommandation
Confirmation en fenêtre `danger`, focus sur Annuler, texte ci-dessus. **Priorité Haute** (effort faible).

---

## 4. UX-04 : export contrôlé des codes de secours

### 4.1 Analyse UX
- **Écran d'activation MFA** : Copier et TXT existent ; pas de PDF.
- **Écran Mon compte** : aucun export ; les codes restent affichés jusqu'à « Masquer » ; **aucun avertissement si l'on quitte la page** (celui de l'activation ne s'y applique pas).
- **Impact** : perte des codes = verrouillage du compte en cas de téléphone perdu. **Criticité : Haute.**

### 4.2 Le sens de « une seule fois »
Deux lectures possibles, à arbitrer :
- **(i) Stricte** : après le premier téléchargement ou la première copie, les boutons se désactivent. Risque : si le navigateur bloque le fichier, les codes sont perdus.
- **(ii) Limitée à l'écran** : les trois actions restent disponibles **tant que l'écran de génération est affiché** ; dès que l'on le quitte, **plus aucun accès, plus aucun réaffichage**.

**Recommandation : (ii)**, avec case « J'ai conservé ces codes » comme sur l'écran d'activation, et confirmation avant de quitter. Elle respecte l'objectif (aucun accès ultérieur) sans créer de perte accidentelle.

### 4.3 Génération du PDF : options

| Critère (poids) | Bibliothèque PDF | Générateur maison | Impression navigateur |
|---|---|---|---|
| Fidélité à « télécharger un PDF » (5) | 5 | 5 | 3 |
| Surface d'attaque et dépendances (5) | 2 | 5 | 5 |
| Fiabilité et rendu (4) | 5 | 3 | 4 |
| Effort (4, 5 = faible) | 4 | 3 | 5 |
| Maintenance (3) | 3 | 3 | 5 |
| **Total / 105** | **80** | **83** | **91** |

Lecture : l'**impression navigateur** (feuille de style d'impression + « Enregistrer au format PDF ») est la plus sûre et la plus simple, mais ce n'est pas un téléchargement en un clic : l'utilisateur passe par la boîte d'impression. Le **générateur maison** (une page de texte, polices standard, environ 80 lignes) donne un vrai téléchargement sans dépendance, au prix d'un test de rendu. La **bibliothèque** ajoute une dépendance et une surface d'attaque pour un besoin minime.

**Recommandation : impression navigateur** (91/105), car la priorité du PDF est Faible et le risque minimal. **Écart avec votre exigence** : vous demandez un *téléchargement* PDF ; si le un-clic est indispensable, choisissez le **générateur maison** (83/105, écart de 8 points) et nous ajouterons un test de lecture du PDF généré (si générateur maison).

### 4.4 Analyse UI et Design System
- **Nouveau composant** `SecretCodesPanel` réutilisé par l'activation MFA **et** Mon compte : grille des codes, actions **Copier**, **Télécharger .txt**, **Télécharger .pdf**, case « J'ai conservé ces codes », états *copié* / *téléchargé* annoncés en `role="status"`.
- Contenu des fichiers : titre « Investally, codes de secours », date de génération, « Chaque code ne sert qu'une fois », liste des codes ; **aucun nom ni adresse e-mail** dans le fichier (il peut être perdu ou partagé).
- Nom des fichiers : `investally-codes-de-secours.txt` et `.pdf`, sans donnée personnelle.

### 4.5 Sécurité
- **Risques** : fichier en clair dans « Téléchargements » ; historique du presse-papiers (Windows Win+V, synchronisation) ; capture ou lecture à l'écran ; perte à la sortie.
- **Protections recommandées** : codes **uniquement en mémoire** de la page (jamais dans le stockage du navigateur ni dans l'URL) ; mémoire effacée dès que l'on quitte l'écran ; avertissement avant fermeture **et** avant navigation interne (l'événement `beforeunload` ne couvre pas les liens internes de l'application : il faut un garde-fou de navigation) ; avertissement clair « ce fichier contient des secrets : rangez-le dans un gestionnaire de mots de passe puis supprimez-le des Téléchargements » ; génération du PDF **entièrement dans le navigateur** (aucun aller-retour serveur, quelle que soit l'option) ; option d'affichage masqué par défaut avec bouton « Afficher » (recommandée, faible effort).
- La politique de contenu (CSP) n'est pas modifiée : un téléchargement par lien `blob:` est déjà utilisé pour le TXT.

### 4.6 Recommandation
Lecture (ii), composant partagé, copie + TXT, PDF par impression navigateur (ou générateur maison si le un-clic est exigé), protection à la sortie. **Priorité Haute** pour la copie, le TXT et la protection à la sortie sur Mon compte ; **Faible** pour le PDF.

---

## 5. Design System : récapitulatif

| Élément | Type | Détail |
|---|---|---|
| `PasswordField` | Composant | Champ + œil, états masqué/visible/focus/désactivé/erreur |
| `eye`, `eye-off` | Icônes | Ajout à `icon.tsx` |
| `Modal` variante `danger` | Variante | Pictogramme d'alerte, bouton danger |
| `RoleSelector` | Composant | Groupes, cartes, états (défaut, survol, focus, sélectionnée, désactivée, avertissement, modifiée) |
| `RightsPreview` | Composant | Accordéons par module, pastilles de portée |
| `SelectionSummary` | Composant | Compteur et « Tout désélectionner » |
| `SecretCodesPanel` | Composant | Grille de codes, copie, TXT, PDF, case de conservation, états |

À la mise en œuvre, le **document de design** sera mis à jour (journal des modifications, version, registre des exigences, décisions, captures, copie locale), conformément à la règle en vigueur. Exigences candidates : EXD-12 (affichage du mot de passe), EXD-13 (confirmation des actions irréversibles).

## 6. Séquencement proposé

| Lot | Contenu | Pourquoi dans cet ordre |
|---|---|---|
| 1 | UX-03 + UX-04 (copie, TXT, protection à la sortie, confirmation) + UX-01 | Sécurité et effort faible ; réutilise `Modal` |
| 2 | UX-04 PDF (impression, ou générateur maison selon votre décision) | Faible priorité, isolé |
| 3 | UX-02 | Chantier le plus lourd, dépend de vos choix |

Tests prévus : composants (clavier, états annoncés), non-régression du parcours d'activation MFA, audit d'accessibilité (axe + arbre d'accessibilité) sur les écrans touchés, test de cohérence « droits effectifs » entre interface et serveur, test de lecture du PDF généré (si générateur maison).

## 7. Décisions attendues de votre part

1. **UX-02 :** option **B+C** (recommandée, 86/105), ou une autre ?
2. **UX-02 :** conserve-t-on la possibilité de **cumuler plusieurs rôles** (comportement actuel de l'API) ?
3. **UX-04 :** « une seule fois » lu comme **(ii) limité à l'écran** (recommandé) ou **(i) strict** ?
4. **UX-04 :** PDF par **impression navigateur** (recommandé, 91/105) ou **générateur maison** (téléchargement en un clic, 83/105) ?

Question complémentaire, non bloquante : souhaitez-vous l'**e-mail d'information** après régénération (dépend de Microsoft 365, dette à inscrire) ?
