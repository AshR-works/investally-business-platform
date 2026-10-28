# DDR-0012 — Fiche de création d'entreprise : coordonnées et mise en relation par un facilitateur

| | |
|---|---|
| **Statut** | Acceptée (réalisée dans l'application) ; prototype à mettre à jour |
| **Date** | 2026-10-28 |
| **Version du design** | 0.4.1 (le prototype n'est pas encore à jour : version 0.5.0 à décider) |
| **Lié à** | Demande de la direction produit du 2026-10-28 (fiche de création) ; décision D24 ; lot S4.0 |

## Contexte
La direction produit a défini le contenu d'une fiche de création d'entreprise : nom, secteur d'activité, e-mail et téléphone de l'entreprise, **méthode de prise de contact** (message WhatsApp, appel…) **via un facilitateur** (qui peut être un employé de l'entreprise), avec pour le facilitateur : nom, prénom, téléphone, un **commentaire**, et une **commission** éventuelle.

Le facilitateur est un concept **nouveau** (différent de l'« ambassadeur » du pipeline, qui est un client ou un apprenant converti en relais commercial).

## Décision (option B de l'arbitrage, retenue le 2026-10-28)
Le facilitateur est une **fiche séparée et réutilisable**, liée à l'entreprise par un **lien** qui porte la méthode de contact, l'indicateur « employé de l'entreprise » et la commission (propre à chaque affaire).

Valeurs par défaut appliquées (recommandations de l'arbitrage, à confirmer ou corriger par la direction produit) :
1. **Commission** : montant fixe **avec devise obligatoire** (aucune devise par défaut), ou pourcentage de 0 (exclu) à 100. Pas de suivi des versements dans ce lot.
2. **Qui voit et définit la commission** : deux permissions nouvelles. `bd.commission.read` : Direction et Finance (tout), Responsable commercial (son équipe), Super administrateur. `bd.commission.manage` : Responsable commercial (son équipe) et Super administrateur. **Le chargé de compte voit le facilitateur mais ni la commission ni même son existence** (la clé est absente de la réponse).
3. **Facilitateur** : `bd.facilitator.read` / `create`. Le créateur en est le propriétaire (portée Propre, Équipe, Tous comme les entreprises). Un facilitateur hors portée est **introuvable** (même réponse qu'un identifiant inexistant : prévention d'IDOR).
4. **Méthode de contact** : liste fermée côté serveur — message WhatsApp, appel téléphonique, e-mail, rencontre, autre.
5. **Obligations** : seul le nom de l'entreprise est obligatoire (e-mail et téléphone facultatifs, contrôlés s'ils sont saisis). Le facilitateur est facultatif ; s'il est saisi, son nom, son prénom et son téléphone sont obligatoires. Un seul facilitateur par entreprise.
6. **Écran** : fenêtre large à deux groupes de champs (« L'entreprise » et « Mise en relation »). Les choix sont filtrés selon les droits ; sans le droit de commission, une note l'explique. Les erreurs de saisie sont listées avant l'envoi (`role="alert"`). La fiche entreprise affiche un bloc « Mise en relation ».

## Mesures de rigueur
- La base elle-même refuse une commission incohérente (contrainte `CHECK` : tout ou rien, pourcentage ≤ 100, montant fixe avec devise sur trois lettres). Un test de la base a révélé qu'une première écriture de la contrainte acceptait une colonne manquante (logique à trois valeurs de SQL) : corrigée avec `COALESCE`.
- Le montant est un texte décimal de bout en bout (colonne `DECIMAL(12,2)`), jamais un nombre flottant.
- L'audit garde la commission (lisible des seuls détenteurs de `audit.log.read`) ; la réponse à l'appelant ne la contient que s'il y a droit.
- Les méthodes de contact et les règles de validation de l'interface sont comparées à celles du serveur par des tests.

## Conséquences
- Réversible : une migration (deux tables, deux colonnes sur `companies`), 4 permissions.
- **Données personnelles de tiers** (facilitateur) : base légale et durée de conservation à faire valider (D55, avis juridique prévu en S7).
- **Dette** : D53 à D56 (`docs/TECH-DEBT.md`) ; prototype à mettre à jour (D49).
