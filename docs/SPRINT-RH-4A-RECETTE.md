# RH-4a — présences déclaratives du personnel (API)

*Branche `feat/rh-4a-presences` · 2026-11-12 · décision D69 ([ADR-0015](adr/0015-presences-declaratives.md)).*

Première tranche de RH-4 : l'**API**, les droits et la base. Les écrans et la démonstration viennent en RH-4b, la recette complète (mutants, Newman, fiches de test) en RH-4c, comme pour RH-2 et RH-3.

**Périmètre retenu par la Direction produit : l'option B, présences déclaratives.** Le cadrage RH classait les présences « non recommandé » (pointage = surveillance des salariés) ; il n'y a donc **ni heure, ni lieu, ni retard, ni texte libre**.

## Ce qui est livré
| Livrable | Contenu |
|---|---|
| **Base** | migration `20261121000000_rh_4a_presences` : table `hr.presence_declarations`, énumération `PresenceMode` (sur site, télétravail, déplacement), **une ligne au plus par employé et par jour** (index unique), version positive, clé vers l'employé |
| **Domaine** | `presence.ts` : la déclaration (trois modes, jour valide), les fenêtres de saisie, `coversWholeDay` (une absence couvre-t-elle la journée entière ?) |
| **Cas d'usage** | `DeclarePresenceUseCase` (idempotent, audité), `RemovePresenceUseCase`, `GetPresenceBoardHandler` (tableau d'une période de 93 jours au plus, avec les jours d'absence validée) |
| **Routes** | `GET /hr/presences?from&to[&department]`, `PUT /hr/presences/:day[?employeeId]`, `DELETE /hr/presences/:day[?employeeId]` |
| **Droits** | `hr.presence.read` et `hr.presence.declare` : chacun déclare pour soi (Propre) et lit sa ligne et celles de ses subordonnés directs ; la RH et le Super administrateur déclarent pour tous ; la RH, la Direction et le Super administrateur lisent tout |
| **Documentation** | ADR-0015, décision D69, dettes D185 à D189, droits régénérés (124 permissions), dictionnaire de la base, référence des routes et collection Postman |

## Règles
- Un employé déclare **pour lui seulement**, de 7 jours en arrière à 30 jours en avant ; la RH, de 90 jours en arrière à 90 en avant, pour n'importe qui (saisie marquée « par un autre »).
- Jamais avant l'entrée ni après le départ de l'employé, jamais pour un employé archivé.
- Une **absence validée sur la journée entière** interdit la déclaration (409) ; une demi-journée d'absence laisse déclarer l'autre moitié ; une demande en attente ne bloque pas.
- Redéclarer le même mode ne change rien et n'écrit rien dans l'audit ; changer écrit l'avant et l'après ; retirer écrit l'ancienne valeur.
- Un employé hors périmètre (collègue, responsable, Direction pour une saisie) est **« introuvable »** : même réponse qu'un employé inexistant (contrat anti-IDOR, deux routes ajoutées au registre).
- Un compte sans fiche employé reçoit un message clair (« demandez à la RH de la relier »).

## Preuves
| Contrôle | Résultat |
|---|---|
| Types | `tsc` propre (API) |
| Tests unitaires | `presence.spec.ts` (domaine) et `presence-use-cases.spec.ts` (27 cas : droits, fenêtres aux bornes, absences, idempotence, audit, tableau par portée et par service) ; matrice des droits `roles.spec.ts` (test dédié aux présences) |
| Intégration (base jetable) | `hr-presences-http` (12 cas : cycle complet audité, RH pour un autre, compte sans fiche, validation, fenêtres, absence validée, tableau par portée, période bornée, sans jeton, trois règles de la base) ; contrat anti-IDOR (sondes `PUT` et `DELETE`, contrôle positif par la RH) ; droits ; schéma |

## Limites connues
- **Aucun écran** : RH-4b. **Aucune démonstration** : RH-4b. **Ni mutants, ni Newman, ni fiches de test** : RH-4c.
- Les fenêtres de saisie, les trois modes et l'absence de validation par le responsable sont des valeurs de départ « à confirmer » (D186, D187).
- Lecture limitée aux subordonnés directs ; une demi-journée d'absence n'apparaît pas dans les jours d'absence du tableau (D188).
- **Durée de conservation non définie** (D189) : à valider avant la mise en production.
- **Dettes ouvertes** : D185 à D189 (voir [TECH-DEBT](TECH-DEBT.md)).

## Comment rejouer
1. Unitaires : `pnpm crm-api test` (ou `npx jest src/modules/hr` dans `apps/api`).
2. Intégration : `node scripts/test-db.mjs "--tests=hr-presences|idor-contract|rbac-http|core-schema"` dans `apps/api`.
3. Mise à jour de ta pile locale : **rebuild : oui** (code de l'API changé) ; **reset : non** (la migration s'applique seule au lancement).
