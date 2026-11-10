# Fiche de rencontre avec la Direction générale — accès Google, DNS et exploitation de la V1

*2026-11-10 · À préparer pour l'échange avec la Direction générale · Ce document nomme des **fonctions**, jamais des personnes ni des secrets : le dépôt est public. Il découle de l'[ADR-0010](../adr/0010-hebergement-v1-serveur-virtuel-et-relais-google.md) (décisions D60 à D63).*

## Pourquoi cet échange
La V1 (accès à la plateforme, sessions, paramètres de compte, RH) envoie des e-mails (invitations, mot de passe oublié) par **Google Workspace** et se déploie sur un **serveur virtuel**. Trois choses ne peuvent pas être faites par l'équipe technique seule : **configurer le côté Google**, **modifier le DNS du domaine**, **engager la dépense du serveur**. Sans elles, la V1 reste une démonstration.

## Ce qu'on a observé (DNS publics, 2026-11-10)
| Élément | Constat | Conséquence |
|---|---|---|
| Messagerie | MX chez Google | Google Workspace est bien la messagerie actuelle |
| Où est le DNS | Serveurs de noms d'un hébergeur français (pas Google, pas Cloudflare) | C'est **là** qu'il faut ajouter des enregistrements ; savoir **qui détient ce compte** |
| SPF | Déclare un service d'envoi transactionnel et l'hébergeur ; **ne déclare pas Google** | Il faut **ajouter** Google, sans retirer l'existant |
| DMARC | Aucun | À publier, d'abord en surveillance |
| DKIM Google | Aucune clé sur le sélecteur par défaut | À générer dans la console d'administration Google, puis à publier |

## Ce qu'il faut obtenir
1. **Qui est super administrateur de Google Workspace ?** Il doit : autoriser le **relais SMTP par adresse IP** (avec l'IP du serveur, connue après l'achat), créer l'**adresse d'expédition** de la plateforme et **générer la clé DKIM**. *À vérifier avec Google : si un rôle délégué suffit à la place du super administrateur.*
2. **Qui détient le compte de l'hébergeur DNS du domaine ?** Soit un accès délégué à l'équipe technique, soit une personne qui ajoute les enregistrements que nous lui transmettons : un enregistrement pour le **sous-domaine de la plateforme**, la mise à jour du **SPF**, la **clé DKIM**, le **DMARC**.
3. **À quoi sert le service d'envoi déjà déclaré dans le SPF ?** (site, lettre d'information ?) Il ne doit pas être cassé.
4. **Migration vers Microsoft 365** : date prévue, les adresses resteront-elles identiques, qui modifiera le DNS à ce moment ? (Les enregistrements ci-dessus changeront une seconde fois.)
5. **Le serveur** : accord sur la dépense mensuelle, **qui paie et qui détient le compte** chez le fournisseur (la dépendance à une seule personne est un risque).
6. **Second administrateur** : qui peut être **second SuperAdmin** de la plateforme, et **second opérateur** du serveur (sauvegardes, reprise) ?
7. **Données du personnel** : qui valide la durée de conservation et la base légale avant d'y mettre de vraies fiches RH (questions D11, D65) ?

## Ce que l'équipe technique fera ensuite, dans l'ordre
1. Image de l'interface, composition exécutée pour de vrai, sauvegardes quotidiennes hors serveur.
2. Adaptateur d'envoi par le relais Google, essayé avec de vraies adresses.
3. Pages « prévu pour les prochaines mises à jour » pour tout ce qui est hors V1.
4. Création des vrais comptes et enrôlement du second facteur, un à un.
5. Essai de bout en bout avant d'ouvrir à toute l'équipe.
