# RH-4b — écran « Présences » et données de démonstration

*Branche `feat/rh-4b-ecrans` (sur la branche de RH-4a) · 2026-11-12 · décision D69 ([ADR-0015](adr/0015-presences-declaratives.md)).*

Deuxième tranche de RH-4 : l'**écran** et la **démonstration**. L'API, les droits et la base viennent de RH-4a ; la recette complète (mutants, Newman, fiches de test) viendra en RH-4c.

## Ce qui est livré
| Livrable | Contenu |
|---|---|
| **Écran « Présences »** (`/hr/presences`) | un tableau par semaine (du lundi au dimanche) : une ligne par personne, une colonne par jour ; navigation d'une semaine à l'autre et retour à la semaine en cours ; filtre par service pour la RH et la Direction ; total du jour (sur site, télétravail, déplacement, absents) |
| **Fenêtre de saisie** | trois choix (sur site, télétravail, déplacement), « Retirer la déclaration », erreur reliée au groupe de choix ; aucune heure, aucun lieu, aucun texte libre |
| **Menu** | entrée « Présences » dans le domaine « Ressources humaines », pour qui a le droit `hr.presence.read` |
| **Démonstration** | bloc `presences` : une semaine et demie de présences sur dix personnes du personnel fictif, déclarées par leur propre compte quand elles en ont un, sinon saisies par la RH ; aucune déclaration sur le congé validé de l'agente de support |
| **Libellés des droits** | « Présences déclaratives du personnel » et l'action « Déclarer » dans l'aperçu des droits |

## Règles de l'écran
- Chacun clique sur **sa propre ligne** (de 7 jours en arrière à 30 jours en avant) ; la RH clique sur **n'importe quelle ligne** (90 jours de part et d'autre). Les autres cases sont de simples indications.
- Un **jour d'absence validée** n'est pas modifiable : la case dit « absent (absence validée) ».
- Le mode est dit par **un texte et un symbole** (■ sur site, ⌂ télétravail, → déplacement, ✕ absence validée, · non déclaré), jamais par le symbole ou la couleur seuls.
- Un compte sans fiche employé voit un message : « Demandez à la RH de la relier ».
- Le serveur reste juge : l'écran reprend ses fenêtres de saisie, un test vérifie qu'elles sont identiques.

## Preuves
| Contrôle | Résultat |
|---|---|
| Types | `tsc` propre (API et interface) |
| Tests de l'interface | `rh-4b.test.ts` : 24 cas (semaine, modes, fenêtres aux bornes, qui saisit quelle case, contenu d'une case, totaux, menu, structure : ni heure, ni lieu, ni texte libre, groupe de choix nommé) |
| Démonstration | plan : jours ouvrés, une déclaration par employé et par jour, jamais sur l'absence validée, dans la fenêtre de saisie, après les absences ; intégration : chargement par les cas d'usage, déclarations en base cohérentes avec les absences, chargement seul du bloc sur une démo qui a déjà le personnel |

## Limites connues
- **Pas encore vérifié dans le navigateur** : l'écran n'a pas été parcouru sur une pile réelle au moment de cette PR (la pile jetable était encore en construction) ; seuls les tests de l'interface, de la démonstration et les types le couvrent. À faire avant la validation.
- **Non vérifié** : mode sombre, 1280 px, navigation au clavier, lecteur d'écran, axe-core (D160).
- **Pas de mutants, de Newman ni de fiche de test** : RH-4c.
- La vue est **hebdomadaire** ; pas de vue mensuelle, pas d'export (D185).
- Dettes ouvertes : D185 à D189 (voir [TECH-DEBT](TECH-DEBT.md)).

## Comment rejouer
1. Interface : `pnpm crm-web typecheck` puis, dans `apps/web`, `npx vitest run`.
2. Démonstration : `node scripts/test-db.mjs "--tests=seed-demo"` dans `apps/api`.
3. Pile locale : `node scripts/local-stack.mjs --demo --rebuild` : **rebuild : oui** (code de l'interface et de la démonstration changé) ; **reset : non** (le bloc `presences` se charge seul sur ta démonstration, sans rien effacer).
