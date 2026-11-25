# Investally Business Platform — entretien avec la Direction générale : état, retours et décisions à prendre

*Préparé le 2026-11-25 pour l'entretien avec la Direction générale. Document de travail : les propositions ci-dessous ne sont pas des décisions. Le détail technique de chaque point est dans les cinq arbitrages de [l'index des cadrages](README.md).*

## 1. L'essentiel en une page
- **Ce qui est fait :** l'application couvre déjà l'accès sécurisé, le commercial, la formation Investudy et une grande partie des ressources humaines. Cette version est **archivée telle quelle** sous le nom « Investally BP - Beta » : la restructuration n'en détruit rien.
- **Ce que vous avez demandé :** une application proche d'un intranet, organisée en quatre plateformes (CRM qui absorbe Investudy, RH, Assets Management, Finances), chacune accessible par un lien propre et sans être exposée aux autres.
- **Ce que nous proposons :** une connexion commune, un lien propre par plateforme, un compte qui n'ouvre que ce à quoi il a droit, une supervision qui voit que tout fonctionne sans lire les données des agents, et des échanges limités et contrôlés entre plateformes.
- **Ce qu'il nous faut de vous :** huit réponses courtes (section 5). Sans elles, nous ne pouvons pas arrêter l'architecture.
- **Ce qu'il faut savoir :** c'est un chantier important, et la comptabilité conforme OHADA, CEMAC et COSUMAF demandera la validation d'un expert-comptable ou d'un juriste.

## 2. Où nous en sommes
| Domaine | Ce qui est livré |
|---|---|
| **Accès et sécurité** | Connexion avec second facteur obligatoire pour tous, gestion des sessions, droits par rôle, journal d'audit, exports d'administration |
| **Commercial (CRM)** | Entreprises, contacts, offres, relances, agenda, opportunités, agréments, ambassadeurs, commissions : module terminé |
| **Investudy** | Catalogue, sessions, inscriptions, présences, évaluations, certificats et attestations, suggestions d'ambassadeur : module terminé |
| **Ressources humaines** | Annuaire, organigramme, fiches du personnel, absences et congés, contrats, parcours d'intégration et de départ, présences déclaratives |
| **Qualité** | Tests automatisés tous verts (environ 1 560 côté serveur, 844 côté interface) ; sur le dernier lot, 31 fautes volontairement injectées, toutes détectées ; un parcours complet de 514 requêtes sans échec |

**À dire honnêtement :**
- Les données de la démonstration sont **fictives**.
- Les certificats délivrés sont des documents internes : la note sur 20 est une appréciation du responsable, pas un examen certifiant par un tiers.
- **Pas encore réalisés :** les tableaux de bord, la gestion des équipements (Assets), les Finances, le reporting.
- **En attente d'éléments extérieurs :** l'envoi réel des e-mails (accès à la messagerie), l'avis juridique sur la conservation des données, un second administrateur nominatif, les logos officiels.

## 3. Ce que nous avons retenu de vos retours
| Retour | Notre compréhension |
|---|---|
| Se rapprocher d'un **intranet** | Une entrée commune, des plateformes distinctes |
| **CRM** | Absorbe Investudy ; ses menus nombreux sont remplacés par une entrée qui condense les choix prioritaires |
| **RH** | Trois axes : organigramme, absences (demandes et absences des employés), demandes de formation des employés, pour des formations **externes** |
| **Assets Management** | Gestion logistique : ordinateurs, écrans, avec toutes les informations liées |
| **Finances** | Comptabilité complète, conforme à OHADA, CEMAC et COSUMAF |
| **Adresses différentes** | Un lien propre par service ou par personne concernée |
| **Ne pas exposer les applications les unes aux autres** | À préciser avec vous : voir la question 1 |

## 4. Ce que nous proposons
| Sujet | Proposition | Ce que cela change pour un utilisateur |
|---|---|---|
| **Entrée** | Une adresse de connexion centrale, plus un lien propre par plateforme | Un seul identifiant ; on arrive directement dans sa plateforme ; aucune liste des plateformes avant la connexion |
| **Accès** | Chaque compte n'ouvre que les plateformes autorisées | Un agent RH ne voit pas le CRM, et ignore ce que contient Finances |
| **Isolation** | Une application par plateforme, chacune avec sa base ; Finances isolée en priorité | Un incident dans une plateforme n'atteint pas les autres |
| **Administration** | Fonctions séparées : un administrateur des comptes, un superviseur en lecture seule, un administrateur par plateforme, un compte de secours | Personne ne détient toutes les clés |
| **Supervision** | Voir que tout fonctionne (connexions, erreurs, état), **sans lire le contenu des données** | La supervision technique est possible tout de suite ; voir l'activité des agents demande d'abord un avis juridique et RH |
| **Échanges** | Un canal unique et contrôlé, une liste fermée d'informations autorisées | Un employé créé en RH est connu d'Assets ; les commissions du CRM arrivent en Finances ; rien d'autre ne circule |

## 5. Les décisions que nous attendons de vous
Chaque question est accompagnée de notre recommandation.

| N° | Question | Notre recommandation |
|---|---|---|
| 1 | **Que doit-il être impossible de faire** quand vous dites ne pas exposer les applications les unes aux autres : qu'un employé accède à un métier qui ne le concerne pas, ou qu'un incident dans une application atteigne les autres ? | Les deux, si possible ; la seconde coûte plus cher |
| 2 | **Les quatre plateformes** sont-elles bien quatre applications distinctes, ou certaines sont-elles regroupées ? | Quatre distinctes |
| 3 | **Acceptez-vous des échanges contrôlés** entre plateformes (employé RH vers Assets, commissions CRM vers Finances, budget d'une formation externe RH vers Finances) ? | Oui, sur une liste fermée validée par vous. Sinon, des ressaisies manuelles |
| 4 | **Supervision** : voulez-vous d'abord la supervision technique, en attendant l'avis juridique et RH pour suivre l'activité des agents ? | Oui |
| 5 | **Qui administre** chaque plateforme (par exemple RH pour RH, la direction financière pour Finances) ? Qui est le second administrateur nominatif des comptes, et qui détient le compte de secours ? | À nommer |
| 6 | **Finances** : quel périmètre exact, et quel expert-comptable ou juriste valide la conformité ? Quel est le rôle de COSUMAF : obligation de déclaration, ou norme comptable ? | Désigner l'expert avant de lancer ce chantier |
| 7 | **Ordre de priorité** des quatre plateformes et date visée | Commencer par l'identité commune et la page d'entrée, puis CRM, RH, Assets, Finances |
| 8 | **Adresses** : qui peut créer les adresses de chaque plateforme (sous-domaines et certificats) et à quelle date ? | À désigner : c'est un prérequis extérieur, déjà en attente |

## 6. Phasage proposé, sans date
Proposition à valider après vos réponses.
1. **Décisions** : les huit questions ci-dessus.
2. **Identité commune et page d'entrée** : connexion unique, accès par plateforme. C'est le préalable de tout le reste.
3. **CRM** : absorber Investudy, remplacer les menus par une entrée qui condense les choix prioritaires.
4. **RH** : réorganiser autour de l'organigramme, des absences et des demandes de formation externes.
5. **Assets Management**, puis **Finances**.

## 7. Risques et points d'attention
- **Charge :** la restructuration est un chantier important, mené par un développeur seul. Plus il y a de plateformes séparées, plus il y a à déployer, à surveiller et à sauvegarder.
- **Comptabilité :** nous construisons la structure, nous ne certifions pas la conformité. Une validation externe est indispensable.
- **Connexion unique :** si le service de connexion tombe, personne n'entre nulle part ; il doit être surveillé de près.
- **Données sensibles :** les données personnelles des employés restent exclues de l'application (salaire, paie, naissance, adresse personnelle). La supervision de l'activité des agents est soumise à l'avis juridique et RH.
- **Délais :** nous ne donnons pas de date tant que les décisions et les prérequis extérieurs (adresses, messagerie, expert-comptable) ne sont pas levés.

## 8. Déroulé suggéré de l'entretien (environ 30 minutes) — notes pour l'intervenant, à retirer avant de remettre le document
1. **Rappel de l'état** (5 min) : section 2, en insistant sur ce qui est terminé et conservé.
2. **Vos retours et notre compréhension** (5 min) : section 3, pour confirmer que nous avons bien compris.
3. **Nos propositions** (10 min) : section 4, en ne détaillant que ce que le DG demande.
4. **Vos décisions** (10 min) : section 5, en commençant par les questions 1 et 3, qui conditionnent le reste.

## 9. Pour aller plus loin
Cinq arbitrages détaillés, avec options, grilles chiffrées et recommandations, sont disponibles :
- [Architecture de la restructuration](ARBITRAGE-ARCHITECTURE-RESTRUCTURATION.md)
- [Adressage et isolation des applications](ARBITRAGE-ADRESSAGE-ET-ISOLATION-DES-APPLICATIONS.md)
- [Parcours d'entrée aux applications](ARBITRAGE-PARCOURS-D-ENTREE-AUX-APPLICATIONS.md)
- [Administration et supervision des plateformes](ARBITRAGE-ADMINISTRATION-ET-SUPERVISION-DES-PLATEFORMES.md)
- [Échanges et événements entre les plateformes](ARBITRAGE-ECHANGES-ET-EVENEMENTS-ENTRE-PLATEFORMES.md)
