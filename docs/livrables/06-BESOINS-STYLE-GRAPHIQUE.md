# Livrable 6 — Ce dont j'ai besoin pour adopter votre style graphique

**Objet** : vous me transmettez des captures d'écran du style visuel souhaité pour l'application ; ce document dit **quoi envoyer, quoi préciser et quoi décider**, pour que je puisse reproduire le style fidèlement et sans aller-retour inutile.
**Temps de préparation côté vous** : 20 à 30 minutes. **Ce que je rends en retour** : voir §7.

> Vous n'avez pas à tout remplir. Les rubriques marquées **★ indispensable** suffisent pour démarrer ; le reste affine le résultat.

---

## 1. Les captures à fournir

### 1.1 Captures indispensables ★
| # | Ce que montre la capture | Pourquoi j'en ai besoin |
|---|---|---|
| 1 | **Une page de connexion** qui vous plaît | Première impression de l'application ; mise en page, champs, boutons |
| 2 | **Un tableau de bord** (indicateurs, cartes, graphiques) | Hiérarchie visuelle, couleurs des indicateurs, densité d'information |
| 3 | **Une page de liste** avec tableau (clients, contacts, utilisateurs…) | Tableaux, recherche, filtres, pagination, badges d'état |
| 4 | **Un formulaire** (création ou modification) | Champs, libellés, messages d'erreur, boutons d'action |
| 5 | **Le menu de navigation** (latéral ou supérieur) avec une page ouverte | Structure générale, icônes, état « page active » |

### 1.2 Captures utiles
| # | Ce que montre la capture | Pourquoi |
|---|---|---|
| 6 | Une **fenêtre de confirmation** ou une boîte de dialogue | Actions sensibles (désactiver un compte, saisir un code) |
| 7 | Un **état vide** (« aucun résultat ») et un **message d'erreur** | Ton et présentation des cas non idéaux |
| 8 | Une **page de détail** (fiche entreprise, fiche contact) | Futur cœur de l'outil commercial |
| 9 | Un **pipeline / tableau Kanban** (colonnes d'étapes) | Opportunités commerciales (S4.3) |
| 10 | Un **calendrier ou une liste de tâches** | Rendez-vous et relances (S4.2-S4.3) |
| 11 | Le **mode sombre**, s'il existe | Je dois savoir si vous le voulez |
| 12 | L'écran **sur téléphone** | Priorité mobile ou non |

### 1.3 Pour chaque capture, une ligne de commentaire
Écrivez simplement **ce que vous aimez** et, si possible, **ce que vous n'aimez pas**. Exemple : « J'aime les cartes blanches sur fond gris clair et les boutons arrondis ; je n'aime pas les ombres trop marquées. » Cela m'aide plus que dix captures sans commentaire.

### 1.4 Conseils pour de bonnes captures
- **Pleine page**, en haute résolution (pas de recadrage sur un détail, sauf pour montrer un composant précis).
- **Une capture par écran**, avec le **nom du produit d'origine** si vous le connaissez (pour que je retrouve ses règles de style).
- **Aucune donnée réelle** : pas de noms de clients, d'adresses e-mail, de montants, de mots de passe ni de codes. Floutez ou utilisez un compte de démonstration.
- **Format** : PNG ou JPEG ; un dossier ou un document PDF regroupant les captures convient.

---

## 2. Votre identité visuelle (si elle existe) ★

| Élément | À me fournir | Statut |
|---|---|---|
| **Logo** (Investally et Investudy) | Fichier **SVG** de préférence (sinon PNG haute résolution, fond transparent), version claire et version foncée | ☐ |
| **Couleurs de marque** | Codes (hexadécimal, ex. `#1F4FD8`) : couleur principale, couleur secondaire, couleurs d'alerte | ☐ |
| **Polices** | Noms et **licences** (voir §4) | ☐ |
| **Charte graphique** | Le document de charte, s'il existe (PDF) | ☐ |
| **Ton des textes** | Vouvoiement / tutoiement ; sobre ou chaleureux | ☐ |

Si rien n'existe encore, dites-le : je proposerai une base cohérente à partir de vos captures, que vous validerez.

---

## 3. Décisions de style à trancher

Cochez ou écrivez votre choix ; en cas de doute, j'applique ma recommandation (colonne de droite).

| # | Question | Options | Ma recommandation |
|---|---|---|---|
| 1 | **Thème** | Clair seulement · Sombre seulement · Les deux (suit le réglage de l'appareil) | **Les deux** (déjà prévu dans l'interface actuelle) |
| 2 | **Densité** | Aérée · Standard · Compacte (beaucoup d'informations par écran) | **Standard**, compacte pour les tableaux |
| 3 | **Formes** | Angles droits · Légèrement arrondis · Très arrondis | Selon vos captures |
| 4 | **Navigation** | Barre latérale · Barre supérieure · Mixte | **Barre latérale** (usage de bureau, ~10 menus à terme) |
| 5 | **Icônes** | Avec icônes · Texte seul | Avec icônes, jeu libre de droits unique |
| 6 | **Appareils prioritaires** | Ordinateur · Tablette · Téléphone | **Ordinateur d'abord**, lisible sur téléphone |
| 7 | **Couleur dominante** | Une couleur de marque + neutres · Plusieurs couleurs | Une couleur de marque + neutres ; une couleur par **statut** |
| 8 | **Graphiques** | Sobres (une teinte) · Colorés | Sobres, couleurs réservées aux comparaisons |
| 9 | **Langue** | Français seul · Français + anglais | Français seul pour l'instant |
| 10 | **Fidélité aux captures** | Copie **fidèle** de la mise en page · **Inspiration** (couleurs, formes, ton) | À préciser par capture (voir §5) |

---

## 4. Polices, images et droits

| Sujet | Ce que je dois savoir | Pourquoi |
|---|---|---|
| **Polices payantes** | Si vos captures utilisent une police sous licence, avez-vous la **licence d'usage web** ? | Sinon je propose l'équivalent libre le plus proche (ex. Inter, Source Sans) |
| **Hébergement des polices** | Aucune demande à un service externe : les fichiers sont **inclus dans l'application** | Notre politique de sécurité (CSP) interdit les connexions sortantes |
| **Illustrations et photos** | Uniquement celles dont vous détenez les droits | Je ne reprends **jamais** un logo ni une illustration d'un autre produit : seulement son *style* |
| **Icônes** | Jeu libre de droits (licence MIT ou équivalente), un seul jeu | Cohérence et conformité |

---

## 5. Fiche à remplir par capture

*(Copiez ce bloc autant de fois que de captures.)*

```
Capture n° : ____        Écran montré : ______________________
Produit d'origine (si connu) : ______________________
À reproduire : ☐ fidèlement la mise en page   ☐ seulement les couleurs
               ☐ seulement les formes/boutons ☐ seulement le ton général
J'aime : __________________________________________________
Je n'aime pas : ___________________________________________
Pour quel(s) écran(s) de notre application : ______________
```

---

## 6. Les écrans de l'application concernés

**Déjà construits** (je les restylerai) :

| Écran | Chemin |
|---|---|
| Connexion | `/login` |
| Second facteur (saisie du code) et première configuration (QR code, codes de secours) | `/mfa` |
| Mot de passe oublié | `/forgot-password` |
| Nouveau mot de passe (lien reçu par e-mail) | `/reset-password` |
| Activation d'invitation | `/invitation` |
| Entreprises (liste et création) | `/` |
| Administration des utilisateurs (liste, invitation, rôles, actions) | `/admin/users` |
| Mon compte (mot de passe, codes de secours, sessions) | `/account` |
| Fenêtres : confirmation, saisie de code MFA | partout |

**À venir** (le style devra les anticiper) : fiches entreprise et contact, pipeline des opportunités, rendez-vous et relances, agrément, catalogue de formations, sessions et inscriptions, tableaux de bord, documents.

---

## 7. Ce que vous recevrez en retour

| Livrable | Contenu |
|---|---|
| **Guide de style** | Palette (avec rôle de chaque couleur), typographie, espacements, rayons, ombres, états des boutons et champs, exemples |
| **Prototype statique** | Une page HTML montrant les composants (boutons, champs, tableaux, badges, cartes, dialogues) en clair et en sombre, **à valider avant de toucher à l'application** |
| **Application restylée** | Les 8 écrans existants au nouveau style ; **aucune règle de sécurité ni logique métier modifiée** |
| **Contrôles d'accessibilité** | Contraste des couleurs (cible WCAG AA), focus visible, navigation au clavier, lisibilité sur téléphone et en mode sombre |
| **Recette** | Parcours rejoués dans un navigateur réel, comparaison avec vos captures, résultats consignés comme pour les sprints précédents |

---

## 8. Déroulé proposé

| Étape | Contenu | Qui | Validation |
|---|---|---|---|
| 1 | Vous envoyez captures, éléments de marque et réponses du §3 | Vous | — |
| 2 | Je rends le **guide de style** et le **prototype statique** | Claude | **Vous validez le prototype** |
| 3 | J'applique le style aux écrans existants et je rejoue la recette | Claude | « Je valide » |
| 4 | Le style devient la base des écrans du pipeline (S4+) | Claude + vous | Au fil des sprints |

**Où cela se place dans le plan** : idéalement **avant S4.1**, avec le *cadrage UX* déjà prévu : on évite de coder deux fois les écrans du pipeline. La séance de cadrage (5 écrans clés) peut alors partir directement de vos captures.

---

## 9. Récapitulatif : votre liste de contrôle

☐ Captures ★ (connexion, tableau de bord, liste, formulaire, navigation) — 5 minimum
☐ Un commentaire « j'aime / je n'aime pas » par capture
☐ Logo en SVG et codes de couleurs de marque (ou « rien n'existe »)
☐ Polices et leurs licences (ou « aucune préférence »)
☐ Réponses au §3 (ou « appliquez vos recommandations »)
☐ Confirmation : aucune donnée réelle dans les captures
