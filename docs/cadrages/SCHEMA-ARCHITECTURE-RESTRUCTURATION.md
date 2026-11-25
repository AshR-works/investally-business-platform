# Schéma annoté — architecture actuelle et cible proposée

*2026-11-25 · Synthèse visuelle des cinq arbitrages de [l'index des cadrages](README.md). **Tout ce qui figure dans la cible est recommandé, rien n'est décidé** : chaque point attend la réponse du DG ou de la Direction produit. Aucun code n'est écrit.*

## 1. Avant : l'architecture actuelle (« Investally BP - Beta »)
```
+---------------------------- Un seul déploiement -----------------------------+
|                                                                              |
|   +--------------------------------------------------------------------+     |
|   |                  Interface Next.js unique                          |  <- Une session, un seul accès
|   +---------------------------------+----------------------------------+     |
|                                     v                                        |
|   +--------------------------------------------------------------------+     |
|   |                           API NestJS                               |  <- Appels directs entre modules
|   |        bd · training · hr · iam · audit · docs                     |     |
|   +---------------------------------+----------------------------------+     |
|                                     v                                        |
|   +--------------------------------------------------------------------+     |
|   |                  PostgreSQL, six schémas                           |  <- Super administrateur : tous les droits
|   +--------------------------------------------------------------------+     |
+------------------------------------------------------------------------------+
```

## 2. Après : la cible proposée
```
                +----------------------------------------+
                |           CONNEXION COMMUNE            |   identité
                |  Comptes, second facteur, sessions,    |
                |  accès par plateforme                  |
                +--+----------+----------+----------+----+
                   |          |          |          |
            +------v--+ +-----v---+ +----v----+ +---v-------+
            |   CRM   | |   RH    | | Assets  | | Finances  |   plateformes,
            | absorbe | | org.,   | | équipe- | | isolée en |   chacune avec
            |Investudy| |absences | |  ments  | | priorité  |   son lien propre
            +----^----+ +----^----+ +----^----+ +-----^-----+
                 |           |           |            |
            +----v-----------v-----------v------------v-----+
            |  CANAL D'ÉCHANGE UNIQUE                       |   échanges
            |  boîte d'envoi, interface signée, liste fermée|
            +---------------------+-------------------------+
                                  |
                    +-------------+--------------+
                    v                            v
        +-----------------------+    +--------------------------+
        | Supervision           |    | Espace central Direction |
        | lecture seule, audit  |    | indicateurs agrégés      |
        | expurgé, sans contenu |    |                          |
        +-----------------------+    +--------------------------+
```

## 3. Ce qui change
| Changement | Avant | Après (proposé) | Statut |
|---|---|---|---|
| **Entrée** | Une adresse, un accès | Connexion commune, plus un lien propre par plateforme | Option C, [parcours d'entrée](ARBITRAGE-PARCOURS-D-ENTREE-AUX-APPLICATIONS.md) |
| **Comptes et sessions** | Module `iam` dans l'API unique | Service d'identité à part, avec un accès par plateforme et des jetons à audience propre | Réutilise `iam`, les jetons ES256 et les sessions existantes |
| **Plateformes** | Modules d'un même monolithe | Quatre plateformes : CRM (avec Investudy), RH, Assets, Finances | Finances isolée dès la conception (option D, [architecture](ARBITRAGE-ARCHITECTURE-RESTRUCTURATION.md)) |
| **Déploiement** | Un seul | Une application et une base par plateforme (option 3), ou regroupement (option 4) | À trancher selon le DG, [adressage](ARBITRAGE-ADRESSAGE-ET-ISOLATION-DES-APPLICATIONS.md) |
| **Échanges** | Appels directs dans un processus | Canal unique : boîte d'envoi, interface signée, liste fermée d'événements | Option B, évolutive vers un courtier, [échanges](ARBITRAGE-ECHANGES-ET-EVENEMENTS-ENTRE-PLATEFORMES.md) |
| **Rôles** | Super administrateur à tous les droits | Administrateur d'identité, superviseur en lecture seule, administrateur par plateforme, compte de secours | Option C, [administration](ARBITRAGE-ADMINISTRATION-ET-SUPERVISION-DES-PLATEFORMES.md) |
| **Audit** | Avant et après, données métier incluses | Journal complet par plateforme, version expurgée vers la supervision | Travail à prévoir |
| **Direction** | Lit tout | Espace central d'indicateurs agrégés | À valider |

## 4. Réutilisé, nouveau, points durs
**Réutilisé :** le module `iam`, le second facteur obligatoire, les jetons ES256, un schéma par module, les références par identifiant.

**Nouveau :**
- le service d'identité séparé ;
- l'accès par plateforme ;
- le canal d'échange ;
- la console de supervision ;
- l'expurgation de l'audit.

**Points durs :**
- la déconnexion unique doit se propager à toutes les plateformes ;
- le second facteur récent (step-up) doit être transporté d'une plateforme à l'autre ;
- la connexion commune est un point de défaillance unique ;
- cinq adresses sont nécessaires en option 3 (quatre plateformes et la connexion), et l'accès au DNS reste en attente (D62) ;
- le chantier est confié à un seul développeur.

**Non vérifié :** les durées exactes des jetons, et la question de savoir si l'API contrôle l'état de la session à chaque requête. Ces deux points pèsent sur la déconnexion unique.
