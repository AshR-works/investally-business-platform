# S3.8 — Rôles et permissions (UX-02) : recette

*Branche `sprint/s3-8-roles-ux` · 2026-10-28 · retour de tests UX-02 (cadrage : `docs/cadrages/CADRAGE-RETOURS-TESTS-UX-01-A-04.md` §2 ; décisions D23 et DDR-0011).*

## Ce qui est livré
| Élément | Livré |
|---|---|
| **Sélecteur de rôles par familles** | Pilotage, Commercial, Investudy (formation), Support et fonctions support, Administration (en dernier). Chaque rôle est une **carte entièrement cliquable** : case native, nom, description, nombre de permissions. Un rôle inconnu tombe dans « Autres rôles » |
| **Aperçu des droits effectifs** (lecture seule) | Par module (accordéons natifs), puis par ressource ; portée **écrite** (Propres, Équipe, Tous). Se met à jour à chaque choix. **Collé en haut de la fenêtre** : il reste visible pendant qu'on choisit les derniers rôles |
| **Cumul de rôles** (conservé) | Pour une même permission, la **portée la plus large** l'emporte (règle du serveur) |
| **Aides** | Compteur annoncé (« 2 rôles sélectionnés · N permissions »), « Tout désélectionner », badge « Accès complet » et avertissement d'audit sur le Super administrateur |
| **Modification d'un compte** | Rôles ajoutés ou retirés signalés en toutes lettres (« Sera ajouté », « Sera retiré ») + phrase de synthèse ; « Enregistrer » actif **seulement** s'il y a un changement réel et au moins un rôle |
| **Ses propres rôles** | Sélection bloquée avec explication (le serveur l'interdisait déjà, l'interface laissait essayer) |
| **Fenêtres larges** | `Modal size="wide"` : deux colonnes dès 1 024 px, une colonne en dessous |

**Aucun changement d'API ni de droits** : `GET /admin/roles` fournit déjà les permissions de chaque rôle ; le serveur reste le seul juge de chaque requête.

## Preuves
| Contrôle | Résultat |
|---|---|
| Types (`tsc`) | 0 erreur |
| Tests de l'interface | **102 / 102** (dont 21 nouveaux) |
| **Cohérence interface ↔ serveur** | La fusion des droits de l'interface est comparée à celle du serveur (matrice et `widestScope` réels) sur **les 1 024 combinaisons** de rôles : identique pour chaque permission |
| Libellés | Tous les modules, ressources et actions du catalogue du serveur ont un libellé (un test échoue sinon) ; les 10 rôles du serveur sont rangés dans une famille, sans oubli ni doublon |
| Mutants (logique des droits et contrat de l'interface) | **11 / 11 tués** (portée la plus étroite, rôles non choisis comptés, rôle inconnu perdu, retraits non calculés, « inchangé » toujours vrai, ordre des modules, pluriel, libellé manquant, blocage de ses propres rôles, enregistrement sans changement…). Un mutant avait d'abord survécu : le test manquant a été ajouté |
| **Navigateur réel (Edge)** | Invitation **réelle** (avec confirmation MFA récente) puis modification **réelle** d'un compte : 5 familles / 10 cartes ; clic sur la carte ; compteur égal à la somme des permissions de l'aperçu ; cumul de 2 rôles ; portée la plus large retenue (« Entreprises → Consulter » non limité à « Propres ») ; **l'aperçu reste visible après défilement** ; badge et avertissement « Accès complet » ; « Tout désélectionner » ; rôles actuels pré-cochés ; « Sera ajouté / Sera retiré » et synthèse ; retour à l'état d'origine = « Enregistrer » désactivé ; liste mise à jour ; **ses propres rôles bloqués** |
| Audit d'accessibilité (axe-core + arbre) | Nouveaux états : Inviter avec aperçu, Modifier les rôles (changements signalés), Modifier ses propres rôles : **0 violation** ; **0** violation de politique de contenu |
| Captures | `docs/accessibilite/s38-captures/` · résultats : `docs/accessibilite/resultats/axe-2026-10-28-s38.json` |

**À vérifier à la main** : axe ne détermine pas le fond du paragraphe des deux nouvelles fenêtres (« recouvrement partiel »), comme pour les fenêtres précédentes. Contrôle manuel : texte `#1D1D1B` sur fond blanc (≈ 17 : 1), même jeton que partout.

## Défaut trouvé et corrigé pendant la recette
Les captures ont montré que l'aperçu des droits, placé en haut de la colonne de droite, **sortait de l'écran** quand on défilait vers les derniers rôles (Support, Finance, Super administrateur) : on choisissait sans rien voir. Il est maintenant **collé en haut** (`lg:sticky`) et ne s'étire plus. Un test de contrat et un contrôle dans le navigateur réel l'empêchent de revenir.

## Réserves sur la recette
- **Un passage complet de bout en bout** (82 vérifications, 46 états, 0 violation) a été obtenu **avant** la correction de l'aperçu collé ; ses résultats détaillés n'ont pas été conservés. Le dernier passage, **après** la correction, couvre tout UX-02 et 42 états (0 violation) mais s'est interrompu plus loin, sur la révocation groupée des sessions (écran de H2b que ce lot ne modifie pas), à cause d'une **machine presque sans mémoire libre** (0,5 Go sur 15,8 Go : captures d'écran de plus de 60 s). Les fichiers archivés sont ceux de ce dernier passage.
- Le script d'audit a été renforcé : délai maximal par appel du navigateur, captures non bloquantes.
- Quelques captures du parcours n'ont pas pu être produites pour la même raison (aucune ne concerne UX-02, sauf la capture « Inviter » : celle d'avant la correction n'est pas archivée).

## Dette et limites
- **D50** libellés des modules, ressources et actions dupliqués dans l'interface (test de complétude contre le serveur) ; **D51** familles de rôles codées dans l'interface ; **D52** aperçu calculé côté interface (cohérence testée sur 1 024 combinaisons) ; **D49** prototype de design à mettre à jour (version 0.5.0, avec les composants de S3.7).
- L'écoute avec un vrai lecteur d'écran (D31) doit couvrir ces fenêtres (familles, compteur annoncé, aperçu en accordéons, état « Sera ajouté / retiré »).
- Non testé : mobile réel et tablette (la mise en page passe sur une colonne sous 1 024 px).

## À valider
1. Les textes (familles, avertissement d'accès complet, message sur ses propres rôles) : modifiables en un endroit (`lib/roles.ts`, `components/admin/`).
2. « Je valide S3.8 » → fusion avec commit de fusion et étiquette `s3-8-validated`.
