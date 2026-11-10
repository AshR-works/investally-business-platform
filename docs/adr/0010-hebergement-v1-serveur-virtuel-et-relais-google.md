# ADR-0010 — Hébergement de la V1 : serveur virtuel et Docker Compose ; envoi d'e-mails par le relais Google

| | |
|---|---|
| **Statut** | Accepté (2026-11-10, décisions D60 à D63 de la Direction produit). **Précise D-PROD-2** du plan de mise en production : l'hébergement retenu est l'option « serveur virtuel » (le repli pour un pilote), pas le cloud géré. Les valeurs par défaut de l'équipe (fournisseur, sous-domaine, Cloudflare, sauvegardes) sont **à confirmer**. |
| **Contexte** | La V1 doit être **déployée et fonctionnelle** : accès à la plateforme, sessions, paramètres de compte, RH-1. L'hébergement n'était pas décidé ; l'accès Microsoft 365 est en pause (détenu par la Direction générale) alors que la configuration de production refuse tout fournisseur d'e-mail autre que Microsoft 365. |
| **Lié à** | `docs/cadrages/PLAN-DE-MISE-EN-PRODUCTION.md` (D-PROD-1 à 5), ADR-0008 (stockage des documents derrière un port), D9 (accès Microsoft 365), R9 (dépendance à une personne), R13 (SuperAdmin unique), D164 |

## 1. Hébergement

### Options considérées
| Option | Principe | Total (sur 100) |
|---|---|---|
| **A. Serveur virtuel + Docker Compose (retenue)** | Un serveur virtuel, la pile actuelle dans des conteneurs, certificat automatique, Cloudflare ajouté ensuite | **77** |
| B. Hébergement mutualisé (cPanel, Node.js via l'outil du fournisseur, PostgreSQL inclus, pas d'accès root, Docker non mentionné) | Moins d'administration mais la pile doit être adaptée, sans garantie | 60 |
| C. Vercel pour l'interface, l'API et la base ailleurs | Les fonctions de Vercel sont limitées par requête (300 s sur le plan Pro selon sa documentation) : elles ne conviennent pas à un serveur NestJS permanent ; licence par utilisateur ; deux hébergeurs | 47 |
| D. Statu quo (démonstration locale) | Aucun risque, mais pas de V1 déployée | 60 |

Critères et poids (fixés par l'équipe) : adéquation à la pile existante (5), tenir vendredi (5), charge d'exploitation pour un seul développeur (4), coût et prévisibilité (3), maîtrise des données et des sauvegardes (3) ; maximum 100. **D** obtient 60 parce qu'elle ne risque rien ; elle échoue sur l'exigence ferme (V1 déployée).

### Décision
- **Serveur virtuel + Docker Compose.** L'API possède déjà une image ; il faut créer celle de l'interface et exécuter pour de vrai la composition (jamais fait).
- Valeurs par défaut à confirmer : **fournisseur Hostinger** (interchangeable : la composition est portable) ; l'application sur **un sous-domaine dédié**, **sans modifier le DNS du domaine principal** avant la migration de la messagerie ; **certificat automatique** sur le serveur ; **Cloudflare ensuite** (tunnel, protection, stockage d'objets) quand le DNS sera maîtrisé ; **sauvegardes quotidiennes hors du serveur** et test de restauration.
- Cloudflare n'est pas un hébergeur pour cette pile : couche devant le serveur, jamais à la place de la base ou de l'API (compatibilité de NestJS et Prisma avec ses fonctions serverless **non vérifiée**).

## 2. E-mails

### Options considérées
1. **Attendre Microsoft 365** : en pause, bloque la V1.
2. **Remise des liens par le SuperAdmin** : du code nouveau sur le chemin le plus sensible, le SuperAdmin voit les liens d'accès des autres, « mot de passe oublié » devient faux ; **écartée**.
3. **Envoi par Google Workspace, SMTP avec mot de passe d'application** : un secret de plus, plafond d'environ 2 000 messages par jour, validation en deux étapes exigée.
4. **Envoi par Google Workspace, relais SMTP par adresse IP (retenue)** : aucun mot de passe à stocker si l'IP suffit, plafond plus haut ; demande un super administrateur Google et **une IP fixe en sortie** (ce que le serveur virtuel fournit).

### Décision
- Envoi par le **relais SMTP de Google Workspace, autorisé par l'adresse IP du serveur**. Un **adaptateur d'envoi** derrière le port existant (`EmailSender`), la configuration de production qui l'accepte, des tests ; aucun secret dans le dépôt.
- Les comptes utilisent les **adresses professionnelles du domaine de l'entreprise** : elles resteront valides après la migration vers Microsoft 365 (l'identifiant est une chaîne, pas un lien vers une boîte). Le jour de la migration : changement de configuration et adaptateur Microsoft déjà écrit.
- **Prérequis externes** : un super administrateur Google Workspace (configuration du relais, clé DKIM), l'accès au DNS du domaine, l'IP du serveur.

### Constat sur la délivrabilité (DNS publics, relevé du 2026-11-10)
- Les MX pointent vers Google (messagerie Google Workspace confirmée).
- Le **SPF ne déclare pas Google** (il déclare un service d'envoi transactionnel et l'hébergeur DNS) ; il n'y a **pas d'enregistrement DMARC** ; aucune clé DKIM sur le sélecteur par défaut de Google (un autre sélecteur peut exister).
- Sans correction, les messages envoyés par Google depuis le domaine risquent d'être signalés ou classés comme indésirables. **À corriger avant la mise en service** : ajouter Google au SPF **sans retirer les entrées existantes**, publier la clé DKIM générée par la console d'administration, ajouter un DMARC en surveillance. La migration vers Microsoft 365 modifiera à nouveau ces enregistrements.

## Conséquences
- (+) La pile reste telle quelle ; aucune dépendance à Microsoft 365 pour la V1 ; chaque parcours par e-mail (invitation, mot de passe oublié, réinitialisation) fonctionne comme construit.
- (−) **Exploitation par une seule personne** (R9) : mises à jour du système, pare-feu, sauvegardes, supervision, à écrire et à tester. Le **second SuperAdmin** et un second opérateur deviennent une condition de la V1, pas un risque noté.
- (−) Le fournisseur annonce des tarifs de renouvellement bien supérieurs aux prix d'appel : à vérifier au contrat.
- (−) Deux dépendances externes sur les mêmes personnes : l'administration Google et le DNS.
- **Dettes** : D165 (délivrabilité du domaine), D166 (exploitation, sauvegardes et supervision à construire).
- À revoir si : Microsoft 365 est livré (changer d'adaptateur), la charge dépasse un serveur, un second développeur arrive, ou le DNS passe sous Cloudflare.
