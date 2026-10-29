# DDR-0011 — Sélecteur de rôles par familles et aperçu des droits effectifs

| | |
|---|---|
| **Statut** | Acceptée (réalisée dans l'application) ; prototype à mettre à jour |
| **Date** | 2026-10-28 |
| **Version du design** | 0.4.1 (le prototype n'est pas encore à jour : version 0.5.0 à décider) |
| **Lié à** | EXD-14 ; retour de tests UX-02 ; `docs/cadrages/CADRAGE-RETOURS-TESTS-UX-01-A-04.md` §2 ; décision D23 |

## Contexte
Les fenêtres « Inviter un utilisateur » et « Modifier les rôles » présentaient dix cases à cocher avec une description : difficiles à (dé)sélectionner, sans indication des **droits** réellement accordés, ni du fait que les rôles se **cumulent** (portée la plus large retenue).

## Décisions (option B+C du cadrage, retenue par la direction produit le 2026-10-22)
1. **Sélection par familles** : Pilotage, Commercial, Investudy (formation), Support et fonctions support, Administration (en dernier). Chaque rôle est une **carte entièrement cliquable** (case native, nom, description, nombre de permissions). Un rôle inconnu de l'interface tombe dans « Autres rôles » au lieu de disparaître.
2. **Aperçu des droits effectifs, en lecture seule**, regroupé par module (accordéons natifs `details`) puis par ressource, avec la portée **écrite** (Propres, Équipe, Tous) ; il se met à jour à chaque choix. Le cumul de plusieurs rôles est conservé : la portée la plus large l'emporte.
3. **Aides** : compteur annoncé (`role="status"`) « N rôles sélectionnés · M permissions », bouton **Tout désélectionner**, badge **Accès complet** et avertissement d'audit sur le Super administrateur.
4. **Modification** : les rôles ajoutés ou retirés sont signalés en toutes lettres (« Sera ajouté », « Sera retiré ») avec une phrase de synthèse ; « Enregistrer » exige un **changement réel** et au moins un rôle.
5. **Ses propres rôles** : sélection bloquée avec explication (le serveur l'interdisait déjà) ; « Enregistrer » désactivé.
6. **Fenêtres larges** (`Modal size="wide"`, deux colonnes à partir de 1024 px, une colonne en dessous).
7. **Option C seule (sélection de permissions une à une) écartée** : elle contredit le modèle (l'API n'attribue que des rôles). Elle n'existe qu'en aperçu.

## Mesures de rigueur
- **Aucun changement d'API ni de droits** : `GET /admin/roles` fournit déjà les permissions de chaque rôle. L'aperçu **informe**, le serveur reste le seul juge de chaque requête.
- **La règle de cumul de l'interface est comparée à celle du serveur** par un test automatique sur les **1 024 combinaisons** de rôles ; un autre test vérifie que tous les modules, ressources et actions du catalogue du serveur ont un libellé (aucun code brut à l'écran).
- Accessibilité : familles en `fieldset`/`legend`, nom et description reliés (`aria-labelledby`/`aria-describedby`), l'état est dit par le texte (jamais par la couleur seule), tout au clavier.

## Conséquences
- Réversible : trois composants (`RolePicker`, `RightsPreview`, `Modal` large).
- **Dette** : libellés des ressources et familles de rôles codés dans l'interface (D50, D51) ; prototype à mettre à jour (D49).
