# N1 à N6 — navigation, fiches et complétude MVP : recette

*Branche `sprint/n1-navigation` (partie de `sprint/s5-2b-inscriptions`, donc **elle contient S5.2b, non encore fusionné**) · 2026-11-09 · décisions D51 à D54 prises sur le cadrage [CADRAGE-NAVIGATION-ET-COMPLETUDE-MVP](cadrages/CADRAGE-NAVIGATION-ET-COMPLETUDE-MVP.md) (« Appliques les recommandations » : D-NAV-1 B, D-NAV-2 B, D-NAV-3 B, D-NAV-4 A ; les ambassadeurs intègrent un archivage réversible). Six lots, sept commits.*

## Ce qui est livré

| Lot | Demande (observation de l'utilisateur) | Réponse |
|---|---|---|
| **N1** `6e7b742` — menu par domaines (D51) | Le menu latéral à plat (12 entrées) est illisible | **Sept domaines repliables** : CRM, Investudy, Finance, Ressources humaines, Stocks, Reporting, Administration ; un domaine sans module visible pour le profil n'apparaît pas ; le domaine du module courant se rouvre à chaque page ; **le module le plus précis gagne** (Sessions n'allume plus Catalogue) ; les modules à venir restent sur le hub, rangés par domaine ; en rail replié toutes les entrées restent visibles ; **Commissions sous Finance** (D54) |
| **N2** `feae8e3` — navigation contextuelle (D52) | Depuis une entreprise, voir **ses** offres, contacts, rendez-vous… | Le filtre `?companyId=` est porté par **l'adresse** (partageable) sur Offres, Contacts, Commissions, Relances, Opportunités, Agenda ; **bandeau de contexte** (fil d'Ariane Entreprises › Nom › Section, pastille retirable annoncée aux lecteurs d'écran, entreprise introuvable ou hors périmètre expliquée avec « Voir toutes les entreprises ») ; la fiche entreprise ouvre des **listes déjà filtrées** ; côté API, `GET /followups?companyId=` (le seul filtre qui manquait avec les ambassadeurs) |
| **N3** `bc59698` — fiches dédiées (D53) | Les noms ne mènent nulle part | Composants uniques `EntityLink` (le nom accessible dit où mène le lien) et `EntitySheet`, adresses de fiche construites à un seul endroit ; **fiches contact, offre (avec ses relances) et opportunité** ; les noms des listes et des panneaux de la fiche entreprise y mènent ; fiches en **lecture** (le cycle de vie reste dans les listes : une seule voie de modification) |
| **N4** `2a1c197` — Agréments | Pas de page des agréments, pas de bouton d'inscription | Page **Agréments** (menu CRM, `bd.approval.read`) : filtre par état et par entreprise, cycle de vie en menu de ligne selon l'état et les droits ; **fiche d'agrément** ; liens depuis la fiche entreprise ; bouton **« Nouvelle inscription »** sur la page Inscriptions (droit de création) |
| **N5a** `8098e09` — ambassadeurs | « Les ambassadeurs doivent intégrer un archivage réversible » | **Archiver / réactiver, jamais de suppression** : migration `20261115000000_n5_ambassadors_archive` (état, date et motif, contrainte de cohérence) ; `POST /ambassadors/:id/status` (version lue, audit avant/après, droit et portée de la modification) ; un archivé est **gelé** (non modifiable) et **garde son e-mail** ; liste `?status=` et `?companyId=` ; écran : Actifs / Archivés / Tous, Archiver / Réactiver avec motif facultatif, **fiche d'ambassadeur**, contexte d'entreprise |
| **N5b** `295e307` — clonage et apprenant | Cloner une offre ; fiche apprenant | `POST /offers/:id/clone` : **nouveau brouillon** de la même entreprise (objet, montant, devise, note ; ni état, ni dates, ni décharge, ni relances), nouvelle référence, audit avec l'offre d'origine ; bouton dans le menu des offres et sur la fiche ; **fiche apprenant** avec ses inscriptions |
| **N6** `039d87c` — catalogue et droits | Catalogue non adressable ; page Droits | `/training?rubrique=rooms` ouvre la rubrique demandée **si le profil peut la lire** (inconnue ou interdite : première rubrique lisible) ; liens Salles / Formateurs depuis les sessions ; page **Droits** (Administration, `iam.role.read`) : matrice permissions × rôles avec portée (Propre, Équipe, Tous, ou « aucun droit » dit aux lecteurs d'écran), filtre par domaine, recherche, légende, **lecture seule** |

**Droits.** Aucune permission nouvelle. L'archivage d'un ambassadeur exige `bd.ambassador.update` : seuls le **Responsable commercial** (portée Équipe) et le **Super administrateur** l'ont ; le chargé de compte, la Direction (lecture seule) et le Responsable Investudy n'archivent pas, comme ils ne modifient pas déjà.

**Écart au cadrage.** `GET /access/matrix` n'a **pas** été créé : `GET /admin/roles` (droit `iam.role.read`) renvoyait déjà les rôles et leurs portées tels qu'enregistrés en base.

## Preuves

| Contrôle | Résultat |
|---|---|
| Types (`tsc`, API et web), architecture (`pnpm arch`), build de l'interface | 0 erreur · **284 modules, aucune violation** · le build compile les nouvelles routes (`/approvals`, `/approvals/[id]`, `/contacts/[id]`, `/offers/[id]`, `/opportunities/[id]`, `/ambassadors/[id]`, `/training/learners/[id]`, `/admin/rights`) |
| Tests unitaires de l'API | **1 056 réussis**, 1 ignoré (61 suites) : ambassadeurs (domaine : archivage ; cas d'usage : archiver, réactiver, gel, e-mail réservé, droits et portée, version périmée, filtres), offres (clonage : reprise des champs, original intact, IDOR, droits, entreprise archivée), relances (filtre d'entreprise) |
| Tests d'intégration (PostgreSQL jetable) | **Rejoués : ambassadeurs, contrat IDOR (intégration) et contrat IDOR (registre), 3 suites, 105 passed ; offres, 12 passed ; relances, 11 passed.** Scénarios : archivage et réactivation de bout en bout, gel, e-mail réservé, filtres état et entreprise (404 hors portée, 400 identifiant mal écrit), droits refusés, **contraintes de la base** (état incohérent refusé), audit ; clonage et ses refus. **La passe d'intégration complète n'a pas été rejouée** (D149) |
| IDOR | Deux routes ajoutées au registre (`POST /ambassadors/:id/status`, `POST /offers/:id/clone`) classées « objet », chacune avec sa sonde ; le contrat passe |
| Tests de l'interface | **635 tests** (33 fichiers) : menu et domaines, contexte d'entreprise dans les requêtes, fiches et liens, actions d'ambassadeur selon l'état et les droits, clonage, catalogue adressable, matrice des droits (construction, filtre, absence de toute écriture) |
| **Mutants** | **Non lancés pour ces lots.** Les tests ci-dessus n'ont pas été éprouvés par mutation (à faire si vous le voulez : l'archivage et le clonage sont les deux endroits à risque) |
| **Navigateur réel (Edge + axe-core)** | **Non rejoué** : le lancement est refusé par l'environnement (D160) ; **aucune des pages ci-dessus n'a été ouverte dans un navigateur par moi**. Rendu, repli du menu, focus, tailles d'écran et lecteur d'écran sont **non vérifiés** |

## Réserves sur la recette

- **Écrans non vus.** Tout ce qui précède est vérifié par les tests, pas à l'œil : la mise en page de la matrice des droits (dix colonnes de rôles, défilement horizontal), le repli du menu et le bandeau de contexte sont les points à regarder en priorité.
- **Fiches en lecture seule** : contact, offre, opportunité, agrément, ambassadeur et apprenant ne portent pas d'action de modification (sauf le clonage d'offre). Les actions restent dans les listes. À arbitrer si vous voulez les actions sur les fiches.
- **Clonage sur la même entreprise uniquement.** Cloner vers une autre entreprise ajouterait un identifiant en entrée et une règle de portée ; non fait.
- **Fiche d'agrément** : pas de lien vers les inscriptions qui le consomment (la liste des inscriptions n'a pas de filtre `approvalId`).
- **Jeu de démonstration** : aucun ambassadeur archivé, aucune démonstration du clonage.
- **Branche empilée** : elle inclut S5.2b (commit `ac2ab0b`, non validé, non poussé) ; elle ne peut être fusionnée qu'après lui.
- **Droit d'archiver** : réservé au Responsable commercial et au Super administrateur (voir plus haut) ; un droit dédié pour le chargé de compte est possible si vous le voulez.

## À valider

1. Réinitialiser la pile locale (nouvelles migrations `20261113…`, `20261114…`, `20261115…`) : `node scripts/local-stack.mjs reset` puis `node scripts/local-stack.mjs --demo --rebuild`.
2. **Menu** (compte Direction ou Responsable commercial) : sept domaines repliables ; Commissions sous Finance ; Sessions et Catalogue ne s'allument pas ensemble ; repli du menu en rail.
3. **Contexte** : ouvrir une entreprise, « Ouvrir les offres de l'entreprise » → liste filtrée avec bandeau ; retirer la pastille ; copier l'adresse dans un autre onglet ; adresse avec un identifiant d'entreprise inventé → message explicatif.
4. **Fiches** : cliquer un nom dans les listes contact, offre, opportunité, agrément, ambassadeur, apprenant ; entreprise cliquable partout ; une fiche d'un collègue (autre chargé de compte) → « introuvable ».
5. **Agréments et inscription** : page Agréments (filtre par état, menu de ligne) ; page Inscriptions → « Nouvelle inscription ».
6. **Ambassadeurs** (Responsable commercial) : Archiver (avec et sans motif) → disparaît des Actifs, visible dans Archivés, non modifiable ; Réactiver ; le chargé de compte ne voit pas les actions.
7. **Clonage** : offre déposée → « Cloner en nouveau brouillon » → arrivée sur le brouillon, nouvelle référence, original inchangé.
8. **Catalogue** : `/training?rubrique=rooms`, `…=trainers` (valeur inconnue : ouvre Programmes) ; liens Salles et Formateurs depuis les sessions.
9. **Droits** (Super administrateur) : matrice lisible, filtre « CRM », recherche « archiver », aucun bouton de modification.
10. « Je valide N1 à N6 » → fusion (après S5.2b) avec commit de fusion et étiquette `n-validated`.
