# S4.1b — tableau des entreprises (filtres, tri, effectifs, colonnes) : recette

*Branche `sprint/s4-1b-tableaux-entreprises` · 2026-10-30 · lot « tableaux » (ARB-API-1 C) ; D38 ; DDR-0016 ; décision D30.*

## Ce qui est livré
| Demande | Réponse |
|---|---|
| **Filtre par statut avec effectifs** | « Toutes · Cible · Contactée · Qualifiée · Cliente · Archivée », chacun avec son nombre ; les effectifs suivent la recherche, le pays et le secteur (pas le statut) |
| **Filtres Pays et Secteur** | Valeurs réellement présentes dans la portée de l'utilisateur ; casse ignorée |
| **Tri par colonne** | Nom, secteur, pays, statut, date ; fait par le serveur sur toutes les pages ; valeurs absentes en dernier ; sens annoncé (`aria-sort`) |
| **Colonnes au choix** | Menu « Colonnes » ; e-mail et téléphone proposés ; nom toujours affiché ; choix mémorisé dans le navigateur |
| **Réinitialiser, compteur** | Bouton visible seulement si un filtre est actif ; « n entreprises correspondantes » annoncé |
| **Affichage « en bulles »** | La décision d'origine (cartes par lignes de 6) concerne les **Opportunités** (S4.3) ; les entreprises restent un tableau. Bascule « Cartes » possible plus tard : **à confirmer (D30)** |

## Preuves
| Contrôle | Résultat |
|---|---|
| Types (`tsc`), architecture (`pnpm arch`) | 0 erreur · aucune violation (176 modules) ; l'architecture a d'abord refusé que le DTO importe le domaine : vocabulaire passé par la couche application |
| Tests unitaires de l'API | **531 / 531** (1 ignoré, antérieur) |
| **Tests d'intégration (PostgreSQL jetable)** | **219 / 219** (16 suites) ; 8 nouveaux : filtres pays/secteur/statut, tri (deux sens, absents en dernier), pagination qui garde tri et filtres, refus de `sort=passwordHash` et `sort=name;drop`, synthèse et son absence de fuite hors portée, droit de lecture |
| Tests de l'interface | **223 / 223** (15 nouveaux) : tri, paramètres envoyés (encodage), effectifs, colonnes et lecture d'un choix mémorisé abîmé |
| **Mutants** | **6 / 7 tués** : portée de la synthèse (2), casse du pays, absents en dernier, filtre de statut, filtre de secteur. **Survivant : second critère de tri par identifiant** (stabilité de la pagination en cas d'égalité) ; non testable de façon déterministe, conservé par prudence |
| **Navigateur réel (Edge + axe-core)** | **122 contrôles, 0 échec, 0 avertissement** : effectifs, tri croissant/décroissant et ordre réel des noms, filtre sans résultat et réinitialisation, filtre par pays (toutes les lignes concernées), menu « Colonnes », ajout de la colonne e-mail et **mémorisation après rechargement** ; résultats `docs/accessibilite/resultats/axe-2026-10-30-s41b.json`, captures `docs/accessibilite/s41b-captures/` |

## Réserves sur la recette
- Un premier passage de mes mutants n'était pas fiable (sortie mal lue, puis base de test occupée) ; la série finale est stricte (un passage sans résultat de test interrompt le script).
- Pas de passage au lecteur d'écran réel ; testé sous Node 26.7 seulement.
- **Responsable, valeur et dernière activité** ne sont pas livrés (D67, S4.3) ; le tri sur le statut suit l'ordre alphabétique des codes (D68).
- Les **changements de statut** d'une entreprise (manuels ou automatiques, CU-C-05) ne sont pas traités ici : décision encore à prendre avec S4.3.
- Le prototype et le wireframe 04 ne montrent pas encore ces filtres (D49).

## Dette et à confirmer
- **D66 à D69** (`docs/TECH-DEBT.md`) ; **D38** partiellement soldée.
- **D30 à confirmer** : tableau pour les entreprises, cartes pour les opportunités ; ou vue « Cartes » dès maintenant pour les entreprises.

## À valider
1. Les écrans (barre de statut avec effectifs, filtres, menu « Colonnes ») et la réponse sur l'affichage en cartes.
2. « Je valide S4.1b » → fusion avec commit de fusion et étiquette `s4-1b-validated`.
