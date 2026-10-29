# S4.0 — Fiche d'entreprise : facilitateur et commission : recette

*Branche `sprint/s4-0-facilitateurs` · 2026-10-28 · demande de la direction produit du 2026-10-28 ; décision D24 (option B) ; DDR-0012.*

## Ce qui est livré
| Élément | Livré |
|---|---|
| **Fiche de création d'entreprise** | Nom (obligatoire), secteur d'activité, **e-mail** et **téléphone** de l'entreprise (contrôlés s'ils sont saisis ; e-mail enregistré en minuscules) |
| **Mise en relation** | Un **facilitateur** (existant, réutilisable, ou nouveau) avec nom, prénom, téléphone, **commentaire** ; case « employé de l'entreprise » ; **méthode de prise de contact** (message WhatsApp, appel téléphonique, e-mail, rencontre, autre) |
| **Commission** | Montant **fixe** (devise sur trois lettres obligatoire) ou **pourcentage** (de 0 exclu à 100), propre à chaque entreprise |
| **Droits** (corrigés le 2026-10-29) | 4 permissions nouvelles (99 au total) : `bd.facilitator.read/create`, `bd.commission.read/manage`. Le **chargé de compte voit la commission de ses entreprises** (c'est lui qui la verse) mais ne la définit pas ; la Finance et la Direction la lisent ; le Responsable commercial (équipe) la lit et la définit ; le Support ne voit ni facilitateur ni commission |
| **Fiche entreprise** | E-mail, téléphone et bloc « Mise en relation » (facilitateur, téléphone, méthode, appartenance, commentaire, commission formatée « 7,50 % » ou « 1 500,00 XAF ») |
| **API** | `POST /facilitators`, `GET /facilitators`, `GET /facilitators/:id` ; `POST /companies` accepte les coordonnées et la facilitation ; le propriétaire vient toujours de la session |

## Preuves
| Contrôle | Résultat |
|---|---|
| Types (`tsc`), architecture (`pnpm arch`) | 0 erreur · aucune violation (161 modules) |
| Tests unitaires de l'API | **476 / 476** (1 ignoré, antérieur) |
| **Tests d'intégration (PostgreSQL jetable, 7 migrations)** | **183 / 183** (13 suites), dont les 9 nouveaux de `facilitators-http` |
| Tests de l'interface | **140 / 140** (38 nouveaux) |
| **IDOR** | Le contrat anti-IDOR est étendu : `GET /facilitators/:id` est classé et sondé (même réponse pour le facilitateur d'un collègue et pour un identifiant inexistant, aucune fuite) ; lier une entreprise au facilitateur d'un collègue répond **404 identique** à un identifiant inexistant et ne crée rien ; la liste des facilitateurs ne montre que les siens |
| **Droits de bout en bout (HTTP)** | Le chargé de compte reçoit 403 s'il fixe une commission (rien n'est créé) et la lit sur ses entreprises ; la réponse du Support ne contient ni le nom, ni le montant, ni le mot « commission » ; la Finance voit la commission ; le Support reçoit 403 sur la liste et la création ; un propriétaire dans le corps est refusé (400) |
| **Base de données** | Contrainte `CHECK` testée directement (valeur > 100, devise sur un pourcentage, type absent, type sans cohérence : toutes refusées) |
| **Audit métier** | La création de l'entreprise **et** celle du facilitateur sont tracées, commission comprise |
| **Mutants** | **15 / 15 tués** (dont : chargé de compte sans lecture de commission, pas de devise par défaut, « FCFA » non reconnu) : commission sans droit, facilitateur étranger accepté, pourcentage > 100, méthode inconnue, devise non exigée, création sans droit, e-mail non contrôlé, commission toujours rendue, commission rendue à tous en lecture, portée ignorée sur le facilitateur (lecture, fiche, liste) |
| **Navigateur réel (Edge)** | Parcours complet joué avec le Super administrateur : fenêtre à deux groupes de champs (fieldset/légende), aucun champ de facilitateur tant qu'on n'en choisit pas, **saisie invalide refusée avant l'envoi** avec message annoncé (`role="alert"`), création réelle, fiche affichant facilitateur, téléphone, méthode, appartenance, commentaire, commission « 7,50 % », e-mail en minuscules |
| Audit d'accessibilité (axe-core + arbre) | Passage complet : **91 vérifications ✔ / 0 ✘**, **49 états, 0 violation** ; les 3 nouveaux états (création avec facilitateur, erreurs de saisie, fiche avec mise en relation) : **0 violation** |
| Captures | `docs/accessibilite/s40-captures/` · résultats : `docs/accessibilite/resultats/axe-2026-10-28-s40.json` |

## Défauts trouvés par les tests et corrigés
1. **Contrainte de la base trop permissive** : une commission dont le type était absent mais la valeur présente était **acceptée** (en SQL, un `CHECK` laisse passer le résultat « inconnu »). Corrigé (`COALESCE`), avec un test de la base.
2. **Ordre des opérations** : une méthode de contact inconnue n'était refusée qu'après la création du facilitateur (la transaction l'aurait annulée, mais autant refuser avant). Corrigé : validation avant toute écriture.
3. **Libellés** : le test de complétude des libellés de S3.8 a échoué dès l'ajout des nouvelles permissions : l'aperçu des droits aurait affiché des codes bruts. Libellés ajoutés.

## Réserves sur la recette
- **Deuxième passage d'audit avec captures** : il s'est arrêté plus loin (nouveaux codes de secours, écran du compte non modifié) car la machine manquait de mémoire (captures sans réponse après 60 s). Les captures S4.0 archivées viennent de ce passage ; les résultats archivés viennent du passage **complet** (49 états, 0 violation).
- **Droits vérifiés par l'API, pas dans le navigateur** : le navigateur a été joué avec le Super administrateur, **avant** la correction du 2026-10-29 (devise par défaut, lecture de la commission par le chargé de compte) : cette correction est couverte par les tests, pas par un nouveau passage dans le navigateur. Les restrictions (Support sans facilitateur ni commission) sont prouvées en HTTP, pas à l'écran.
- **Écoute avec un vrai lecteur d'écran (D31)** à étendre à ces écrans ; **mobile et tablette** non testés.

## Dette et points à confirmer
- **D53** facilitateur sans modification ni suppression, un seul par entreprise ; **D54** pas de suivi des versements de commission, **devenu un besoin réel** (le chargé de compte verse la commission après déblocage des fonds par la direction administrative et financière) ; **D55** base légale et conservation des données du facilitateur (tiers) à faire valider ; **D49** prototype de design à mettre à jour (0.5.0).
- **Décidé le 2026-10-29** : le chargé de compte voit la commission ; le Responsable commercial et le Super administrateur la définissent ; devise par défaut XAF (FCFA). **À confirmer** : un facilitateur par entreprise, e-mail et téléphone facultatifs, et le suivi des versements (D54).
- Le **pays** n'est pas dans la fiche (non demandé) : l'API l'accepte toujours.

## À valider
1. Le contenu de la fiche et les droits sur la commission ci-dessus.
2. « Je valide S4.0 » → fusion avec commit de fusion et étiquette `s4-0-validated`.
