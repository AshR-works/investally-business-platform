# Charte de tests

*Investally Business Platform — version 1.0, 2026-11-08. Elle complète la stratégie technique de [`TESTING.md`](TESTING.md) et s'applique à toute l'équipe technique, session après session.*

## 1. Objet
Dire **ce que nous testons, comment, avec quelles preuves**, et à quelles conditions un lot est déclaré « terminé » et présenté à la validation. La charte est la règle ; les **fiches de test** en sont l'application :
- une fiche par **interface** (écran) : [`tests/interfaces/`](tests/README.md) ;
- une fiche par **session** (lot) : [`tests/sessions/`](tests/README.md).

## 2. Principes
1. **Les tests naissent avec le code.** Un bug trouvé = un test qui échoue d'abord, puis la correction.
2. **On ne change jamais un test pour le faire passer** sans comprendre pourquoi il échoue : soit le code est faux, soit l'attente l'était, et la raison est notée dans la recette.
3. **Un test qui ne peut pas échouer ne prouve rien.** C'est le rôle des mutants (§ 7) : une faute injectée doit être détectée.
4. **Aucune donnée réelle, aucun secret** dans les tests, les fixtures ou les captures (le dépôt est public). Données fictives uniquement.
5. **Jamais la base de travail.** Les tests d'intégration et l'audit utilisent une base PostgreSQL jetable.
6. **Honnêteté des preuves.** Ce qui n'a pas été vérifié, ou l'a été partiellement, est écrit dans les « réserves » de la recette. Un contrôle qui échoue est rapporté avec sa sortie, jamais passé sous silence.
7. **Pas de fusion avec une CI rouge ou en attente**, ni sans la validation explicite de la direction produit.

## 3. Les niveaux de test (ceux que nous utilisons vraiment)
| Niveau | Ce qu'il prouve | Outil et emplacement | Quand |
|---|---|---|---|
| **Types et architecture** | Le code compile ; la Clean Architecture est respectée (domaine pur, application sans persistance ni HTTP, frontières de module, pas de cycle) | `tsc`, `pnpm arch` (dependency-cruiser) | à chaque changement ; bloquant en CI |
| **Unitaires du domaine** | Les règles métier d'un agrégat, sans base ni framework | Jest, `apps/crm-api/src/**/*.spec.ts` | toute règle métier |
| **Cas d'usage** | L'orchestration (droits, portée, version, audit, transaction) avec des dépôts en mémoire (`test/support/in-memory-*.ts`) | Jest, `src/**/*-use-cases.spec.ts` | tout cas d'usage |
| **Intégration (HTTP + PostgreSQL)** | La route réelle, les droits par rôle, les erreurs (400, 403, 404, 409, 422), les **contraintes de la base**, le verrou optimiste, l'audit | Jest + base jetable, `apps/crm-api/test/*.integration.spec.ts` (lancés par `apps/crm-api/scripts/test-db.mjs`) | toute route, toute migration |
| **Contrat anti-IDOR** | Un objet hors portée répond **comme un objet inexistant** (404 identique, aucune fuite, aucune écriture) | `test/idor-contract*.spec.ts`, registre `test/support/idor-registry.ts` | toute route désignant un objet |
| **Interface** | Logique des écrans (saisie, actions selon l'état et les droits, formats), **cohérence avec le domaine réel du serveur** | Vitest, `apps/crm-web/test/*.test.ts` | toute logique d'écran |
| **Mutation** | Que les tests ci-dessus détectent bien les fautes | scripts [`scripts/mutants/`](../scripts/mutants/) | chaque lot, avant la validation |
| **Navigateur réel et accessibilité** | Le parcours dans un vrai navigateur ; absence de violation WCAG 2.1 AA (axe-core) ; messages annoncés ; clavier | `scripts/a11y-audit.mjs` (Edge sans fenêtre) | chaque lot qui touche un écran |
| **Recette utilisateur** | Que le résultat convient à l'usage | fiches de test (§ 9), exécutées par la direction produit | avant « Je valide » |

Non couverts à ce jour (assumés, voir § 11) : tests de bout en bout dans plusieurs navigateurs, lecteur d'écran réel, tests de charge.

## 4. Ce qu'il faut tester selon la nature du changement
**Une règle métier (domaine)** — cas nominal ; chaque refus avec son message ; bornes (0, 1, maximum, juste au-dessus) ; états définitifs ; aucune modification partielle quand une règle échoue.

**Un cas d'usage** — portée (Propre, Équipe, Tous) ; **hors portée = « introuvable »**, jamais « interdit » ; droit distinct par action (tester avec un droit construit à la main quand aucun rôle ne sépare deux droits) ; version périmée = conflit ; entreprise archivée = lecture seule ; trace d'audit (ancienne et nouvelle valeur).

**Une route** — classée dans le registre IDOR si elle désigne un objet, avec sa sonde ; protégée par `@Protected` avec la bonne permission ; validation des entrées (champ inconnu refusé, identifiant mal écrit refusé) ; code HTTP exact de chaque refus ; aucune fuite dans le corps de la réponse.

**Une migration** — chaque contrainte (`CHECK`, unicité, clé étrangère) est vérifiée par une **écriture directe refusée** ; `COALESCE(..., false)` pour qu'un résultat inconnu ne passe pas pour vrai ; le verrou optimiste au niveau de la base (deux écritures sur la même version : la seconde échoue).

**Une permission nouvelle** — matrice `docs/RBAC.md` mise à jour ; rôles concernés ; libellé dans l'interface (un test échoue sinon) ; test « sans ce droit, c'est refusé ».

**Un document joint** — visible uniquement dans la portée de son objet (y compris pour un rôle qui lit tous les documents mais pas l'objet) ; formats et tailles ; fichier trompeur refusé.

**Un écran** — voir la fiche d'interface (§ 9) : scénarios, droits, clavier, titres, champs non conformes (surbrillance **et** message écrit, jamais la couleur seule), annonces (`role=alert`, `aria-live`), états vide / chargement / erreur.

## 5. Données et environnements
- **Base jetable** : `node apps/crm-api/scripts/test-db.mjs` (port 54340 par défaut ; 54341 pour les mutants ; pile d'audit 54360/3001/3000). Jamais la base locale de travail.
- **Comptes** : créés par les tests ; en local, comptes de démonstration (mots de passe dans le fichier local de comptes de démonstration, **jamais dans le dépôt**). Aucun mot de passe réel n'est saisi dans un test ou une capture.
- **API sur 127.0.0.1 seulement.** Aucun courriel réel n'est envoyé (les liens d'invitation et de réinitialisation sont écrits dans le journal local de l'API).
- **Une pile à la fois** : deux audits ou deux séries de mutants en parallèle se disputent les ports et les fichiers.
- **Nettoyage** : l'audit arrête sa pile et ses navigateurs à la fin ; vérifier qu'aucun processus ne reste (mémoire).

## 6. Intégration continue
Fusion possible seulement si le contrôle `verify` est vert : types, architecture, tests unitaires et d'intégration, interface, construction. Les protections de `main` l'imposent (PR obligatoire, pas de poussée forcée).

## 7. Tests de mutation
Pour chaque lot : au moins **un mutant par règle importante** (règle métier, droit de route, portée, contrainte de base, persistance, lecture/affichage). Tous doivent être **tués**. Un **survivant** n'est jamais ignoré : soit le test manque (on l'ajoute, puis on retue le mutant), soit le mutant est équivalent (on l'explique dans la recette). Les scripts sont versionnés dans `scripts/mutants/`, un par lot.

## 8. Audit navigateur et accessibilité
- Parcours scripté dans Edge sans fenêtre, avec axe-core à chaque état d'écran ; objectif : **0 violation**, et les points « à vérifier » analysés.
- Chaque lot qui touche un écran ajoute les états nouveaux (vide, saisie non conforme, succès, refus, fenêtre de confirmation).
- Les captures et le résultat JSON sont conservés dans `docs/accessibilite/`.
- **Limites connues** : le navigateur sans fenêtre est instable sur certains écrans lourds (agenda) ; l'audit possède un mode « fiche entreprise seule » (`AUDIT_COMPANY_ONLY=1`). Une capture manquante ou un parcours limité est écrit dans les réserves.
- Pas de lecteur d'écran réel à ce jour (dette D31).

## 9. Fiches de test : par interface et par session
**Fiche d'interface** (`docs/tests/interfaces/NN-nom.md`) : pour chaque écran — route, droits, préconditions, **scénarios** (étapes, résultat attendu, case « constaté »), contrôles d'accessibilité, tests automatisés qui le couvrent, limites. Elle sert à la **recette utilisateur** et à la **non-régression** : on la rejoue quand l'écran change.

**Fiche de session** (`docs/tests/sessions/<lot>.md`) : pour chaque lot — ce qu'il livre, les **vérifications à rejouer** (une ligne par fonction livrée), les preuves automatisées relevées à la validation, les réserves. Elle est **dérivée de la recette du lot** ; en cas de doute, la recette fait foi.

Règles d'usage : on coche, on date, on signe ; un écart devient un défaut (§ 10), jamais une note perdue.

## 10. Défauts
Tout défaut trouvé pendant un lot est : reproduit par un test qui échoue ; corrigé ; **consigné dans la recette** (« défauts trouvés et corrigés ») avec sa cause. Un défaut non corrigé devient une ligne de `docs/TECH-DEBT.md` (identifiant `D…`, lot, responsable, échéance).

## 11. Définition de « terminé » d'un lot
Un lot n'est présenté à la validation que si **toutes** les cases sont cochées :
- [ ] types (API et web) et architecture sans erreur ;
- [ ] tests unitaires et d'intégration verts (suite complète, pas seulement les nouveaux) ;
- [ ] tests d'interface verts ;
- [ ] contrat IDOR étendu aux nouvelles routes ;
- [ ] mutants : tous tués, survivants expliqués ;
- [ ] audit navigateur : 0 violation sur les états nouveaux ; réserves écrites ;
- [ ] recette du lot (`docs/SPRINT-*-RECETTE.md`) avec **chiffres réels**, défauts, réserves, valeurs par défaut « à confirmer » ;
- [ ] fiche de session et fiches d'interface touchées mises à jour ;
- [ ] journal `docs/TESTING.md`, registre des décisions, dette, changelog et décisions de conception (DDR), Gantt et sa copie Excel à jour ;
- [ ] CI verte sur la PR ;
- [ ] **validation explicite** de la direction produit (« Je valide <lot> »), puis fusion avec commit de fusion et étiquette `<lot>-validated`.

## 12. Responsabilités
- **Équipe technique** : écrit les tests, les mutants, l'audit, la recette ; tient les fiches ; signale les écarts.
- **Direction produit** : exécute la recette utilisateur sur les fiches, confirme les valeurs par défaut, valide ou demande des corrections.
- **Aucune fusion, poussée ou étiquette sans accord explicite.**

## 13. Dette de test assumée
Pas de tests de bout en bout multi-navigateurs ; pas de lecteur d'écran réel (D31) ; pas de tests de charge ni de reprise après incident ; sécurité vérifiée par tests d'autorisation et revue, sans test d'intrusion externe. Chaque point sera planifié avant la mise en production.

## 14. Évolution de la charte
Toute modification passe par une PR de documentation, validée comme les autres. La version et la date figurent en tête.
