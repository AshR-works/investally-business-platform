# S5.3c — recette complète des certificats, attestations et suggestions d'ambassadeur : mutants, Newman, fiches de test

*Branche `feat/s5-3c-recette` · 2026-11-24 · décisions D77 et D79, lot (c) de S5.3 ([ADR-0018](adr/0018-certifications-et-suggestion-d-ambassadeur.md)).*

Dernière tranche du lot (c) (après l'API et l'écran) : elle n'ajoute aucune fonction, elle **éprouve** le travail des deux premières. Classé **à risque réel** (D73, D77) : une délivrance engage l'organisme (un document remis à l'apprenant) et la suggestion d'ambassadeur ne doit jamais ouvrir la lecture des certifications au chargé de compte (S8).

## Ce qui est livré
| Livrable | Contenu |
|---|---|
| **Mutants** | `scripts/mutants/s5-3c-certifications-ambassadeurs.py` : **31 fautes** injectées une à une (domaine, cas d'usage, routes, dépôt, règles de la base, droits) |
| **Tests ajoutés** | domaine (`certification.spec.ts`), cas d'usage (`certification-use-cases.spec.ts`), droits (`roles.spec.ts`), intégration (`sessions-http.integration.spec.ts`) — voir les survivants ci-dessous. **Aucun code applicatif modifié** : tous les survivants étaient des tests manquants |
| **Parcours Postman 90.8** (20 étapes) | planifier, ouvrir, inscrire et confirmer, cinq présences, note, délivrance refusée avant clôture, clôture, type invalide refusé, délivrance (référence `CERT-AAAA-NNNNNN`), seconde délivrance refusée, feuille de délivrances, révocation sans motif refusée, révocation avec motif, nouvelle délivrance refusée après révocation, lecture des suggestions. Ajouté dans `scripts/api-docs/build-postman.mjs` (la collection n'est jamais écrite à la main) ; collection et catalogue (`tests-api.json`) régénérés |
| **Fiche de test** | session `s5-3c` (`docs/tests/sessions/s5-3c.md`, 15 vérifications) ; index mis à jour |

## Preuves
| Contrôle | Résultat |
|---|---|
| **Mutants** | première passe : **20 tués sur 31**, 11 survivants. Après correction des tests (jamais du code) : **11 sur 11 rejoués tués**. Bilan final : **31 tués sur 31**, aucun survivant |
| Référence sans mutation | `sessions-http` (base jetable) : **19 sur 19** avec les nouvelles assertions ; specs unitaires du lot : 45 sur 45 |
| **Newman** (base jetable neuve, migrations seules, Super administrateur) | **514 requêtes, 1787 assertions, 0 échec**, en 1 min 6 s, dont le parcours 90.8 (20 étapes) |

## Mutants : les 11 survivants de la première passe, expliqués
Tous corrigés par un test manquant.

| Mutant | Cause | Correction |
|---|---|---|
| `D1` un type délivré invalide est accepté | le test appelait `parseCertificationKind` seul ; la fabrique `Certification.issue` n'était jamais exercée avec un type invalide (la validation d'entrée HTTP masquait le trou) | test sur `Certification.issue` |
| `D5` un motif de plus de 500 caractères est accepté | aucun test de la limite côté domaine (seul le DTO la contrôlait) | test à 501 caractères |
| `U2` délivrance acceptée pour une inscription non confirmée | tous les tests confirmaient l'inscription avant de délivrer | test avec inscription annulée |
| `U3` délivrance acceptée pour une inscription d'une autre session | aucun test croisant session et inscription | test sur une seconde session clôturée |
| `U10` lignes de la feuille triées à l'envers | un seul inscrit dans les tests : aucun ordre à casser | second inscrit, ordre alphabétique vérifié |
| `R3` lire et révoquer exigent la même permission | **le commentaire du test promettait « la Direction ne révoque pas » sans l'asserter** : seule la délivrance était refusée à la Direction | assertion ajoutée : la Direction reçoit 403 sur la révocation |
| `P1` un conflit d'unicité n'est plus un conflit | le cas d'usage vérifie l'existence avant d'appeler le dépôt : aucun test n'atteignait la conversion du dépôt | test direct sur le dépôt (`save` d'une seconde délivrance, `CONFLICT`) |
| `P2` le numéro de référence ne s'incrémente plus | la regex `CERT-\d{4}-\d{6}` valide le format, pas l'unicité | test : deux appels successifs de `nextReferenceNumber` donnent deux valeurs |
| `G5` l'inscription d'une suggestion n'est plus contrôlée | la clé vers l'inscription n'était testée que pour les délivrances | insertion directe refusée sur `ambassador_suggestions` |
| `L1` le Responsable commercial passe de la portée Équipe à Tous | aucune assertion sur les portées de lecture des certifications | `roles.spec.ts` : Équipe pour le Responsable commercial, Propre pour le formateur, Tous pour la Direction, aucun droit pour le chargé de compte |
| `L2` le formateur perd tout droit de lecture | idem | même test |

## Constat à relever (sans correction)
- L'erreur de conflit d'unicité du dépôt répond « une délivrance est déjà enregistrée pour cette inscription » **quel que soit l'index violé** (inscription ou numéro de référence). Un conflit sur le numéro de référence serait donc mal libellé. Il ne peut survenir qu'avec une séquence détournée (la séquence PostgreSQL garantit l'unicité) : dette mineure, non corrigée ici.
- Une délivrance révoquée **bloque toute nouvelle délivrance** pour la même inscription (une ligne par inscription, jamais supprimée). Le message du cas d'usage (« la révoquer avant d'en délivrer une autre ») suggère à tort qu'une réémission est possible après révocation. Comportement testé tel quel (parcours 90.8) ; à trancher avec la Direction produit si une réémission est voulue.

## Limites connues
- Le parcours 90.8 réutilise l'étudiant sans entreprise de 90.2 : il ne crée donc **aucune suggestion d'ambassadeur** (couverte par l'intégration DB et vérifiée à la main sur écran). Créer un apprenant d'entreprise sous agrément en Newman exigerait un parcours commercial entier (opportunité, agrément).
- La passe d'intégration complète (37 suites) reste instable sur cette machine, sans lien avec ce lot : voir la section suivante.

## Passe d'intégration complète : constat
Deux passes complètes sur base neuve (hors outil habituel puis `scripts/test-db.mjs`) ont donné 26 puis 75 tests en échec sur 8 suites, dont des 500 au login. Les suites touchées (`idor-contract`, `seed-demo`, `hr-leave-http`, agenda, relances) ne sont pas celles de ce lot. Cause non établie : à ouvrir comme dette distincte.

## Comment rejouer
1. Mutants : `python scripts/mutants/s5-3c-certifications-ambassadeurs.py` (**jamais deux exécutions à la fois**, ne pas toucher à `apps/` pendant la passe ; un mutant « tué » doit l'être par un test qui passe sans mutation : vérifier la référence d'abord). `DRY=1` vérifie seulement les motifs.
2. Newman : base jetable ou pile locale sur **des ports libres** (`LOCAL_DB_PORT`, `LOCAL_API_PORT`, `LOCAL_WEB_PORT`), compte administrateur enrôlé au second facteur, environnement copié depuis `docs/api/postman/Investally-local.postman_environment.json` (hors du dépôt), puis `node scripts/api-docs/run-newman.mjs --env <environnement>`.
3. Fiche : `docs/tests/sessions/s5-3c.md`.
4. Pile locale : **rebuild : non** ; **reset : non** (aucun code ni migration ajoutés, seulement des tests et de la documentation).
