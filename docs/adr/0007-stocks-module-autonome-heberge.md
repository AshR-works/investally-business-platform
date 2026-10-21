# ADR-0007 — Stocks : module autonome hébergé dans le monolithe du CRM, conçu pour être extrait

| | |
|---|---|
| **Statut** | Accepté (2026-10-21, décision DEC-004 de la direction produit) |
| **Dérogation à** | ADR-0005 (séparation CRM / ERP) : **dérogation provisoire, avec échéance** |
| **Contexte** | Approvisionnements internes d'Investally (articles, fournisseurs, entrées, sorties, inventaire, seuils). Aucune relation avec les clients ni les opportunités. L'ERP n'existe pas encore : son socle (identité unique, paquets partagés) est à construire |

## Options considérées
1. **Dans le CRM** sans frontière : rapide mais pollue le périmètre et impose un déménagement coûteux (🔴).
2. **Dans l'ERP** : cohérent, mais attend l'ERP (risque de ne jamais commencer).
3. **Service indépendant** : disproportionné pour ≈ 20 utilisateurs.
**3′ (retenue)** : **module autonome** hébergé dans le monolithe du CRM, conçu pour être extrait.

## Décision
Créer un contexte **`stock`** :
- **schéma de base propre** (`stock`), aucune clé étrangère vers les schémas du CRM ;
- **aucune dépendance** vers les modules métier du CRM (`business-development`, formation) : uniquement `shared-kernel`, et l'**interface publique** des modules `iam`, `audit` et `notifications` ;
- échanges avec le reste de la plateforme par **événements** ;
- **permissions propres** (`stock.*`), rôle dédié (« Logistique ») à confirmer ;
- **mouvements immuables** (ajout seul, correction par contre-mouvement), comme le journal d'audit ;
- interface dans la section « Opérations » du menu.

## Garde-fous
1. **Règle d'architecture automatique** (`.dependency-cruiser.cjs`, règle `stock-sans-dependance-crm`) : un fichier de `modules/stock/` ne peut pas importer les modules métier du CRM. Elle est active dès maintenant (aucun fichier concerné encore).
2. **Échéance d'extraction** : réévaluer au démarrage de l'ERP ; si l'ERP est décidé **avant la fin de S4**, appliquer l'option 2 (le module se déplace sans réécriture).
3. Ce rattachement provisoire est inscrit comme **dette** (`TECH-DEBT.md`, D28).

## Conséquences
- (+) Livrable tôt, en réutilisant identité, droits, audit et interface ; extraction sans réécriture.
- (−) Exige de la discipline de frontière (contrôlée par la CI) ; un ADR dérogatoire à relire à l'arrivée de l'ERP.
- Réversibilité : 🟢 à 🟡.
