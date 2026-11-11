# V1 — déploiement : images, e-mails par Google, publication, sauvegardes : recette

*Branche `sprint/v1-deploiement` · 2026-11-10 · décisions D60 à D63, [ADR-0010](adr/0010-hebergement-v1-serveur-virtuel-et-relais-google.md) · exploitation : [EXPLOITATION-V1](EXPLOITATION-V1.md). **Rien n'est déployé** : ces quatre lots préparent le serveur ; il reste des prérequis externes (§ 5).*

## 1. Ce qui est livré
| Lot | Contenu | Où |
|---|---|---|
| **1. Images et composition** | Image de l'interface web (sortie « standalone »), image de l'API adaptée (réseau interne, dossier des documents), composition de production (`db`, `migrate`, `api`, `web`, `caddy`), entrée HTTPS à certificat automatique, générateur de réglages avec secrets aléatoires, `.dockerignore`. L'API écoute sur une adresse configurable (`API_HOST`, 127.0.0.1 par défaut) | `deploy/`, `apps/web/Dockerfile`, `apps/api/Dockerfile` |
| **2. E-mails par Google** | Adaptateur d'envoi par le **relais SMTP de Google Workspace**, autorisé par l'adresse IP du serveur (aucun mot de passe). Chiffrement STARTTLS **exigé** : un relais qui ne l'offre pas ne reçoit jamais le message en clair. Configuration de production qui l'accepte (`EMAIL_PROVIDER=google-relay`) | `modules/notifications/`, `platform/app-config.loader.ts` |
| **3. Publication** | Réglage `RELEASED_DOMAINS` (V1 = `iam,hr`, obligatoire en production) : le serveur répond « introuvable » à tout domaine non publié (même non connecté), le profil renseigne l'interface, qui masque les modules (menu, hub, recherche, boutons) et affiche « Prévu pour les prochaines mises à jour » | `platform/release-gate.guard.ts`, `apps/web/` |
| **4. Sauvegardes** | Sauvegarde de la base et des documents (fichiers vérifiés avant d'être gardés, somme de contrôle, rotation après succès), **vérification de restauration** dans une base temporaire, minuterie quotidienne, copie hors du serveur si un emplacement est configuré | `deploy/backup/` |

## 2. Tests et mutants
| Lot | Tests ajoutés | Mutants |
|---|---|---|
| 1 | 11 (adresse d'écoute de l'API) | inclus dans le lot 2 (L1 à L5) : tous tués |
| 2 | 58 dans `notifications` (dont un **vrai** nodemailer contre un faux serveur SMTP : remise, refus 550 et 452, relais injoignable, chiffrement exigé, mode « none » sans chiffrement), 8 de configuration du relais | **33 sur 34 tués** ; le survivant (`S12`) est **équivalent** : dans nodemailer, `requireTLS` l'emporte sur `ignoreTLS` |
| 3 | API : 7 de configuration, 8 de garde et d'aides ; **intégration : 6** (profil, domaine publié fonctionne, domaine non publié 404 même avec le droit et même sans connexion, routes sans permission ouvertes, **contrat : toute route protégée porte un domaine connu**) ; interface : 11 | **28 sur 28 tués** |
| 4 | Essai de bout en bout **en intégration continue** : pile démarrée en mode production, base migrée, sauvegarde, restauration vérifiée | non applicable (scripts d'exploitation, pas du code testé par mutants) |

Chiffres de la branche : API **1 160** tests unitaires réussis (1 ignoré), interface **680**, architecture sans violation (298 modules), contrôle de types propre. Passe d'intégration complète sur base jetable : **31 suites sur 31, 443 tests sur 443**, en 5 min 21 (la première passe avait trouvé un échec, le test qui fixe la liste exacte des champs du profil : il attend maintenant `releasedDomains` ; corrigé puis rejoué).

## 3. Ce que cela change pour l'utilisation
- Avec `RELEASED_DOMAINS=iam,hr`, **personne** (même la Direction, même le Super administrateur) ne peut lire ou écrire le commercial ou Investudy, ni par l'interface ni en appelant l'API directement.
- Un utilisateur connecté voit : **Vue d'ensemble**, **Ressources humaines** (annuaire, organigramme, personnel selon ses droits), **Administration** (utilisateurs, droits), **Mon compte**. Les modules du CRM et d'Investudy, Finance, Stocks, Reporting sont dans « À venir ». Une adresse tapée à la main affiche « Prévu pour les prochaines mises à jour ».
- Les invitations, « mot de passe oublié » et réinitialisations envoient de vrais e-mails par le relais Google, dès que Google l'autorise (§ 5).

## 4. Ce qui est vérifié, ce qui ne l'est pas
**Vérifié** : les tests ci-dessus ; la construction de l'interface en sortie autonome (essayée en local) ; la validité des fichiers de composition et de l'intégration continue (lus par un analyseur YAML) ; la syntaxe des scripts d'exploitation.

**Non vérifié (à ne pas présenter comme acquis)** :
- **Docker n'a jamais été lancé** sur la machine de développement (absent). La construction des deux images, le démarrage de la pile en mode production et l'essai de sauvegarde puis restauration sont vérifiés **par l'intégration continue**, au premier passage de la proposition de changement : un échec là est possible et se corrigera.
- **Le relais Google réel** : l'adaptateur n'a parlé qu'à un faux serveur SMTP.
- **L'adresse du client derrière deux relais** (`TRUST_PROXY=uniquelocal` : Caddy puis l'interface web) : à vérifier au premier déploiement (la limite de débit par IP en dépend).
- **Aucun regard visuel** sur la page « Prévu pour les prochaines mises à jour » ni sur le menu réduit (D160 : pas d'audit dans un navigateur réel).

**Défaut trouvé en route** : les sondes de santé de l'API sont `/health/live` et `/health/ready` (hors du préfixe `/api/v1`) ; mes premiers contrôles pointaient ailleurs et auraient laissé l'API « non saine » en permanence. Corrigé avant tout essai.

## 5. Prérequis externes (rien ne démarre sans eux)
| À obtenir | Auprès de | Pour |
|---|---|---|
| Super administrateur Google Workspace : relais SMTP par IP, adresse d'expédition, clé DKIM | Direction générale | Les e-mails |
| Accès au DNS du domaine : enregistrement du sous-domaine, SPF avec Google, DKIM, DMARC | Détenteur du compte de l'hébergeur DNS | Le certificat et la délivrabilité (D165) |
| Achat du serveur virtuel | Direction produit | L'adresse IP à déclarer à Google, et le serveur lui-même |
| Un second SuperAdmin, un second opérateur | Direction | R9, R13 : « mot de passe oublié » et reprise ne doivent pas dépendre d'une personne |
| Emplacement de la copie des sauvegardes hors du serveur | Direction produit | Une sauvegarde sur le même disque ne protège pas d'une perte du serveur |
| Avis sur la conservation des données du personnel | Juridique (D11, D65) | Avant de saisir de vraies fiches RH |

## 6. Comment vérifier (à ton tour)
1. Lire le résultat de l'intégration continue de la proposition de changement : `verify` (déjà exigé) et `images` (construction, démarrage en mode production, sauvegarde et restauration).
2. En local, sans Docker : les tests ci-dessus ; `pnpm --filter @investally/crm-api test` et `test:integration`.
3. Sur le serveur, une fois les prérequis obtenus : suivre [EXPLOITATION-V1](EXPLOITATION-V1.md) § 3 ; vérifier une invitation réelle, puis `restore-check.sh`.
4. Pour voir la V1 en local : `RELEASED_DOMAINS=iam,hr` dans l'environnement de l'API (pile locale), reconstruire (`--rebuild`), se connecter avec un compte RH.

## 7. Dette et suites
- **D165** (délivrabilité), **D166** (exploitation d'un serveur unique : supervision, second opérateur, mises à jour du système).
- Antivirus des documents (D42, bloquant avant d'ouvrir les documents), stockage d'objets (D41), Cloudflare devant le serveur : après la V1.
- RH complète (congés) : après la mise en place de la V1 ; règles de congés toujours attendues (D59).
