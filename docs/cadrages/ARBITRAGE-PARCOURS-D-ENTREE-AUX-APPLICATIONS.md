# Arbitrage — parcours d'entrée aux applications (choisir puis s'authentifier, ou s'authentifier puis être orienté)

*2026-11-25 · Méthode : [METHODE-D-ARBITRAGE](../METHODE-D-ARBITRAGE.md) (options dont le statu quo, grille recalculée, recommandation, **décision laissée à la Direction produit**). **Aucun code n'est écrit** tant que la décision n'est pas prise. Les notes de la grille sont des jugements de l'équipe technique, à contester. Suite de [ARBITRAGE-ADRESSAGE-ET-ISOLATION-DES-APPLICATIONS](ARBITRAGE-ADRESSAGE-ET-ISOLATION-DES-APPLICATIONS.md) et de [ARBITRAGE-ARCHITECTURE-RESTRUCTURATION](ARBITRAGE-ARCHITECTURE-RESTRUCTURATION.md), toujours en attente de décision.*

## 1. La question
Quatre applications, chacune à sa propre adresse (noms temporaires : Investudy CRM, Investudy RH, Investudy Finance, Investudy Assets Management). Comment l'utilisateur y entre-t-il ?

Précisions de la Direction produit (2026-11-25) :
- Les adresses différentes servent à donner **à chaque service ou personne concernée un lien propre à son application**.
- Deux parcours sont envisagés pour une page commune : (1) **choisir la plateforme, puis s'authentifier** ; (2) **s'authentifier, puis voir s'ouvrir la plateforme correspondant à ses accès**.

Condition d'entrée : plusieurs applications à adresses propres. Si la décision d'adressage retenait finalement une seule adresse, la question se réduirait au parcours 2.

## 2. Ce qui existe et ce qui contraint
| Fait | Source |
|---|---|
| Aujourd'hui : une seule application, un écran de connexion, une session | État actuel |
| Le second facteur est **obligatoire pour tous** les comptes | Décision du 2026-10-20 |
| Certaines actions exigent un second facteur **récent** (ex. changement de responsable d'une entreprise) | D41 |
| Un accès refusé ou hors portée répond « introuvable », sans révéler l'existence de l'objet | Contrat anti-IDOR |
| Le registre prévoyait « l'extraction de l'identité vers une connexion unique » | Reste à faire |
| Exigence du DG, formulée ainsi : ne pas exposer les applications les unes aux autres | Retours du DG |
| Développeur seul | — |

À noter : avec des adresses séparées, **une identité centrale est nécessaire dans tous les cas** (sinon quatre comptes à gérer par personne). Le choix porte donc sur le parcours, pas sur la nécessité de la connexion commune.

## 3. Options
| | Principe |
|---|---|
| **0. Statu quo** | Une application, un écran de connexion |
| **A. Choisir d'abord, puis s'authentifier** | Une page commune liste les plateformes ; on choisit, puis on s'authentifie auprès de l'identité centrale |
| **B. S'authentifier d'abord, puis être orienté** | Une page commune de connexion, sans liste ; après la connexion, la plateforme s'ouvre selon les accès (un seul accès : ouverture directe ; plusieurs : un lanceur) |
| **C. Lien propre par plateforme et connexion commune derrière** | Chaque plateforme a son adresse ; y entrer renvoie vers la connexion commune puis revient à elle. En plus, une page commune de connexion oriente (comme en B) pour qui ne connaît pas son lien |

## 3 bis. Précisions du 2026-11-25 : où se connecte-t-on, et comment les deux entrées coexistent
La Direction produit a demandé si le lien propre par plateforme et la connexion commune peuvent coexister, et où l'on se connecte. Réponse technique : **oui, c'est l'option C**, et la connexion se fait sur **une adresse centrale dédiée**, la même quelle que soit l'entrée.

**Ce que porte l'adresse centrale :**
- Les écrans qui quittent chaque plateforme : connexion, second facteur, mot de passe oublié, nouveau mot de passe, activation par invitation, mon compte, sessions et connexions. Il n'en reste qu'un exemplaire, au lieu de quatre.
- La session centrale : le cookie de connexion vit sur cette adresse seulement ; chaque plateforme ne reçoit qu'un jeton qui lui est propre.
- Aucune liste de plateformes avant la connexion. Arrivé par un lien propre, l'écran peut afficher le nom de cette seule plateforme, que l'utilisateur connaît puisqu'il a cliqué sur son lien.

**Après la connexion :**
| Cas | Comportement proposé |
|---|---|
| Un seul accès | La plateforme s'ouvre directement |
| Plusieurs accès | Un lanceur ne montre que les plateformes autorisées, ou une plateforme par défaut s'ouvre avec un menu pour changer |
| Aucun accès | Message neutre : le compte n'a accès à aucune plateforme, contacter l'administrateur |
| Déjà connecté | Retour direct, sans redemander le mot de passe |

**Règles pour que les deux entrées restent cohérentes :**
- Le lien propre prime sur la plateforme par défaut : un utilisateur qui a accès à RH et CRM et entre par le lien RH arrive dans RH.
- Un lien propre sans accès donne le même message neutre que « aucun accès », sans révéler le contenu de la plateforme (cohérent avec la règle actuelle « introuvable »).
- Les deux entrées partagent une seule liste d'adresses autorisées pour le retour après connexion.

**Table rôle vers plateformes** (indicative, à valider) :
| Rôle | Plateforme(s) | Statut |
|---|---|---|
| Direction | Plusieurs, en lecture | À valider |
| Responsable commercial, chargé de compte, Responsable Investudy, formateur | CRM (qui contient Investudy) | À valider |
| RH | RH | À valider |
| Finance | Finances | À valider |
| Super administrateur | Les quatre | À valider |
| Support, Fiscalité | **À définir** : ces rôles ont très peu de droits aujourd'hui | Ouvert |

**Conséquence sur l'adressage :** la connexion centrale est une adresse de plus, donc cinq avec quatre plateformes. Voir [ARBITRAGE-ADRESSAGE-ET-ISOLATION-DES-APPLICATIONS](ARBITRAGE-ADRESSAGE-ET-ISOLATION-DES-APPLICATIONS.md).

## 4. Grille (poids de 1 à 5, maximum 100)
| Critère (poids) | 0 | A | B | C |
|---|---|---|---|---|
| Fidélité à l'attente du DG : un lien propre par service, des applications non exposées entre elles (5) | 1 | 4 | 3 | 5 |
| Non-divulgation avant connexion : un visiteur non authentifié n'apprend rien sur les plateformes (4) | 5 | 2 | 5 | 4 |
| Simplicité pour l'utilisateur : peu de clics, pas de confusion (4) | 5 | 3 | 4 | 4 |
| Charge et risque techniques pour un développeur seul (4) | 5 | 4 | 3 | 3 |
| Sûreté de l'authentification : une seule étape de second facteur, pas de redirection détournable (3) | 4 | 4 | 3 | 3 |
| **Total** | **77** | **68** | **72** | **78** |

Totaux recalculés : 0 = 5 + 20 + 20 + 20 + 12 ; A = 20 + 8 + 12 + 16 + 12 ; B = 15 + 20 + 16 + 12 + 9 ; C = 25 + 16 + 16 + 12 + 9.

**L'option 0 est exclue** : elle ne répond pas à la demande (une seule application). Sa note élevée vient du fait qu'elle ne change rien, donc ne coûte rien.

Pourquoi A est en retrait : la liste des plateformes affichée avant la connexion révèle à n'importe quel visiteur que RH et Finance existent, ce qui va à l'encontre de l'exigence de ne pas les exposer. Pourquoi B seul est en retrait : sans lien propre, il ne donne pas à chaque service « son » adresse.

## 5. Exemples d'applications qui appliquent ces principes
Vérifiés dans la documentation des éditeurs le 2026-11-25. Ce sont des repères de comparaison, pas des modèles à copier.

| Exemple | Parcours | Ce qu'on en retient | Limite pour Investally |
|---|---|---|---|
| **Microsoft 365 / My Apps** | S'authentifier, puis un portail de lancement : on ne voit que les applications attribuées à son compte ; l'éditeur permet aussi de masquer une application à tous | Le modèle B abouti : l'utilisateur ne voit que ses accès | Suppose une identité centrale et un référentiel d'accès par application |
| **SAP Fiori Launchpad** | S'authentifier, puis un point d'entrée unique dont les tuiles dépendent des rôles de l'utilisateur | Même principe, appliqué à un système d'entreprise : l'accueil dépend du rôle | Une seule installation derrière le lanceur, pas des déploiements séparés |
| **Atlassian (Cloud)** | Une authentification unique pour plusieurs produits, passant par une page de connexion commune ; un administrateur choisit le produit d'arrivée d'un site | Le plus proche de C : une connexion commune, une arrivée directe dans le produit | Le détail des adresses par produit n'a pas pu être confirmé |

Aucun exemple fiable d'un produit qui affiche le catalogue complet avant la connexion n'a été trouvé : les grandes suites l'évitent.

Sources : [Microsoft Entra — My Apps](https://learn.microsoft.com/en-us/entra/identity/enterprise-apps/myapps-overview), [SAP — Fiori Launchpad](https://www.sap.com/design-system/fiori-design-web/v1-148/foundations/integration-and-services/sap-fiori-launchpad/launchpad), [Atlassian — authentification unique](https://confluence.atlassian.com/cloud/saml-single-sign-on-943953302.html).

## 6. Risques et dette
- **Une identité centrale à construire** (service de connexion commun, jetons propres à chaque application) : c'est le chantier principal, quel que soit le parcours.
- **Point de défaillance unique :** si l'identité tombe, plus personne n'entre nulle part.
- **Second facteur récent (D41) :** il doit être transmis d'une application à l'autre, sinon une action sensible redemande le code à tort, ou l'accepte à tort.
- **Redirections après connexion :** le retour vers la bonne application doit être strictement contrôlé (liste d'adresses autorisées), sinon une adresse piégée peut détourner la connexion. Risque plus présent en B et C qu'en A.
- **Accès par plateforme :** aujourd'hui les droits sont par rôle et par module ; il faut une notion nouvelle « accès à la plateforme X » et un écran pour la gérer.
- **Déconnexion :** une déconnexion unique est plus sûre mais plus complexe ; sinon des sessions restent ouvertes dans les autres applications.
- **Dette :** les noms et adresses sont temporaires ; ne rien figer dans le code, les prendre dans la configuration.

## 7. Recommandation
**Option C.** Elle répond le mieux à ce que le DG a décrit (un lien propre par service) et, sans afficher la liste des plateformes avant la connexion, elle laisse une page commune pour qui ne connaît pas son lien. A est écartée à cause de l'exposition du catalogue ; B seul, parce qu'il n'offre pas de lien propre.

C est aussi la moins coûteuse des options qui répondent à la demande : un lien propre vers une application qui renvoie à la connexion commune s'obtient presque gratuitement dès que l'identité centrale existe ; la page commune est un ajout.

## 8. Décision attendue
**Réponse courte** : « C », « B », « A » (ou « 0 »).

Sous-décisions :
1. **Liste avant connexion :** la page commune affiche-t-elle les plateformes avant l'authentification ? (recommandé : non)
2. **Comptes :** un compte unique avec des accès par plateforme (recommandé), ou un compte par plateforme ?
3. **Second facteur :** une seule fois pour toutes les plateformes (recommandé), avec un code récent redemandé pour les actions sensibles, ou à chaque plateforme ?
4. **Déconnexion :** unique pour tout (recommandé), ou par plateforme ?
5. **Plateforme sans accès :** message neutre, sans révéler ce qu'elle contient (recommandé, cohérent avec la règle actuelle « introuvable »).
6. **Un seul accès / plusieurs :** ouverture directe s'il n'y en a qu'un, lanceur s'il y en a plusieurs (recommandé).
7. **Noms et adresses :** temporaires, tirés de la configuration.
8. **Table rôle vers plateformes :** à valider, dont Support et Fiscalité, qui ne se rangent pas clairement.
9. **Nom de l'adresse de connexion centrale :** à choisir, par exemple `connexion.` ou `compte.`.

Après la réponse : consignation au registre des décisions (avec les deux arbitrages précédents), ADR, puis seulement exécution.
