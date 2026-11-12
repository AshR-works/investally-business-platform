# RH-2a — absences et congés (API) : recette

*Branche `sprint/rh-2a-conges` · 2026-11-10 · décision D64 (« B puis C »), cadrage [CADRAGE-RH-COMPLETE](cadrages/CADRAGE-RH-COMPLETE.md) · **API seulement** : les écrans (Mes absences, À valider, Calendrier d'équipe, Soldes, Paramètres RH) arrivent avec RH-2b. **Toutes les règles de congés sont des valeurs de départ « à confirmer »**, modifiables par la RH : aucune n'est dans le code.*

## Ce qui est livré
| Demande | Réponse |
|---|---|
| **Types d'absence paramétrables** | Congé annuel (seul type qui décompte le solde), Maladie, Permission exceptionnelle, Sans solde, Maternité et paternité ; la RH en crée, modifie, désactive (jamais supprimés) ; plafond de jours par demande facultatif ; validation exigée ou non |
| **Règles de départ (« à confirmer »)** | 1,5 jour acquis par mois (18 par an), jours ouvrés du lundi au vendredi (le samedi compte si la RH le dit), demi-journées permises, solde négatif interdit, aucun report automatique (la RH ajuste) ; **aucun jour férié présumé** : la RH saisit la liste |
| **Demande** | L'employé (compte lié) demande ; contrôles : employé en poste, type actif, au moins un jour décompté, plafond du type, pas dans le passé (sauf la RH), pas avant l'entrée, **aucun chevauchement à la demi-journée près**, solde suffisant pour un type qui décompte ; deux demandes simultanées du même employé se suivent (verrou de sa fiche) |
| **Circuit** | Validation ou refus (refus **motivé**) par le **responsable direct de l'organigramme RH** (pas `users.manager_id`, D58) ou par la RH ; **jamais sa propre demande**, pas même la RH ni le Super administrateur ; chevauchement et solde **revérifiés à la validation** ; annulation par l'employé (en attente, ou validée mais pas commencée, avec motif) ou par la RH (motif obligatoire pour une demande validée) |
| **Saisie par la RH pour un employé** | Validée d'emblée ; la RH qui demande pour elle-même attend une autre personne |
| **Solde** | Acquis (mois de service × taux, proratisé : le mois d'entrée entamé ne compte qu'une fois complet, la sortie arrête l'acquisition) + ajustements − pris − en attente, par année de congé (celle de la date de début) ; jamais calculé à partir de la date du jour |
| **Ajustements (report, correction)** | RH seulement, motif obligatoire, ajout seul, audité |
| **Calendrier d'équipe** | Absences **validées** du service, trois mois au plus ; un collègue voit « absent » **sans le type** ; l'employé, son responsable, la RH et la Direction voient le type |
| **Droits** | Nouvelles permissions `hr.leave.read / create / approve / manage` : chacun lit, demande et valide pour son équipe directe (portée Propre) ; **la RH et le Super administrateur gèrent** (portée Tous) ; la Direction lit tout ; hors périmètre : « introuvable » (même réponse qu'un identifiant inexistant) |
| **Aucune donnée de santé** | Pas de champ de diagnostic ni de pièce : un motif libre et facultatif ; test qui vérifie les colonnes de la base |
| **Base** | Migration `20261117000000_rh_2a_leave` : schéma `hr`, **aucune clé étrangère vers un autre schéma** ; 24 règles garanties par la base (dates ordonnées, jours valides, demi-journées cohérentes, année de congé, état cohérent, ajustements, types, règles à ligne unique, jours fériés uniques, RESTRICT) |
| **API** | 17 routes sous `/hr/leave` ; **audit avant et après** de chaque action ; les 9 routes à identifiant sont dans le **contrat anti-IDOR** avec leurs sondes |

## Preuves
| Contrôle | Résultat |
|---|---|
| Types, architecture | `tsc` propre ; `pnpm arch` : **309 modules, aucune violation** |
| Tests unitaires de l'API | **1 293 réussis**, 1 ignoré (71 suites) ; nouveaux : calendrier 28, demande 15, règles et types 17, **cas d'usage 72**, matrice des rôles 16 |
| Intégration complète (base jetable) | **466 sur 466, 32 suites**, en 7 min 2 s ; nouvelle suite `hr-leave-http` (**14** tests : types et règles de départ, cycle complet demande → validation → solde → calendrier → annulation avec audit, droits et portée, validations, **demandes simultanées** (une seule passe sur trois), paramétrage, 24 règles de la base, verrou optimiste, recherche de chevauchement) |
| Contrat anti-IDOR | Les 9 nouvelles routes : réponse identique pour un objet étranger et pour un objet inexistant, aucune fuite |
| Mutants | **126 sur 126 tués** (`scripts/mutants/rh2a-conges.py`) : 119 au premier passage, **7 survivants rejoués et tués** après ajout de tests : fin de mois du 31 (`monthsOfService`), arrondi des droits, portée du droit de gestion, contenu de l'audit de création, nom de la contrainte d'ordre des dates, recherche de chevauchement en base, filtre par année |
| RBAC | `docs/RBAC.md` régénéré depuis le code (117 permissions, règle 6 ter) |

## Limites connues (dettes D167 à D172, voir TECH-DEBT)
- Une demande à cheval sur deux années est comptée **entièrement sur l'année de début** (D167).
- « Aujourd'hui » se compte en **UTC** (le Cameroun est en UTC+1) : au passage de minuit, un jour peut être refusé ou accepté à tort (D168, comme D153).
- **Aucune notification** : le responsable n'est pas prévenu d'une demande à valider ; l'envoi d'e-mails par le relais Google existe désormais, à décider (D169).
- **Pas de suppléant** : si le responsable est absent, la demande attend ; la RH peut valider (D170).
- Un employé **sans compte lié** ne peut pas demander : la RH saisit pour lui (D171).
- Les droits annuels sont **disponibles dès le 1er janvier** (anticipation), proratisés l'année d'entrée ; aucun report automatique (D172).
- Aucun écran, aucune donnée de démonstration d'absences (RH-2b) ; le module reste masqué si `RELEASED_DOMAINS` n'inclut pas `hr`.

## Comment vérifier
1. Lire les tests : `apps/api/src/modules/hr/application/leave-use-cases.spec.ts` (72 scénarios nommés en français) et `test/hr-leave-http.integration.spec.ts`.
2. Les règles se changent sans code : `PUT /hr/leave/settings`, `/hr/leave/types`, `/hr/leave/holidays` (RH ou Super administrateur).
3. Les écrans de RH-2b rendront ces vérifications visibles ; en attendant, l'API se lit dans `/api/docs`.
