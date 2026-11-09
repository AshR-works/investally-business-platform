# Fiche de test — Organigramme

| | |
|---|---|
| **Route** | `/hr/org-chart` |
| **Livrée par** | RH-1b |
| **Accès** | Tout utilisateur connecté (`hr.directory.read`) : menu Ressources humaines › Organigramme. |
| **Droits** | **Lire** : tous les rôles. Aucune écriture ; **ne change aucun droit d'accès**. |
| **Rôles de test** | rh, dir, cc, sup |

*Fiche d'interface de la [charte de tests](../../CHARTE-DE-TESTS.md). À rejouer à chaque changement de l'écran. Cocher, dater, signer ; tout écart devient un défaut.*

## Préconditions
Pile locale réinitialisée avec le jeu de démonstration (bloc « rh » : 11 fiches fictives, dont une sortie). Comptes : `rh@demo…` (la RH), `direction@demo…`, `compte1@demo…`, `support@demo…`.

## Scénarios
| N° | Scénario | Étapes | Résultat attendu | Constaté (✔ / ✘) | Date et initiales |
|---|---|---|---|---|---|
| 1 | **Arbre** | Ouvrir l'organigramme. | Le directeur général en racine ; ses collaborateurs directs dessous ; chaque nœud donne nom, poste, service et le nombre de collaborateurs. | ☐ | |
| 2 | **Replier et déplier** | Replier puis déplier un responsable, au clavier (Entrée ou Espace sur le résumé). | Les collaborateurs apparaissent et disparaissent ; les deux premiers niveaux sont ouverts au départ. | ☐ | |
| 3 | **Personnes en poste seulement** | Chercher l'ancien chargé de compte sorti. | Il n'apparaît pas ; personne n'est « perdu » (un responsable sorti ferait de la personne une racine). | ☐ | |
| 4 | **Total** | Lire le compteur. | Le nombre de personnes de l'arbre est égal à celui de l'annuaire. | ☐ | |
| 5 | **Indépendance des droits** | Comparer avec Administration › Utilisateurs. | L'organigramme RH peut différer de la hiérarchie des comptes (la Finance dans la démo) : c'est voulu, le signalement est sur la page Personnel. | ☐ | |

## Accessibilité
- ☐ Clavier seul : Tab et Maj+Tab parcourent tous les contrôles dans un ordre logique ; le focus est toujours visible ; aucun piège de focus hors fenêtre modale.
- ☐ Un seul titre de niveau 1 ; pas de saut de niveau (h2 avant h3).
- ☐ Chaque champ a un libellé relié ; un champ non conforme est en surbrillance **et** accompagné d'un message écrit relié (`aria-describedby`), jamais la couleur seule ; le focus va au premier champ en erreur.
- ☐ Les messages d'état et d'erreur sont annoncés (`role=alert` ou `aria-live`).
- ☐ Fenêtres modales : le focus entre dans la fenêtre, Échap la ferme, le focus revient à l'élément d'origine, l'arrière-plan est inerte.
- ☐ Lisible à 200 % de zoom et à 375 px de large, sans défilement horizontal de la page.
- ☐ L'arbre est une liste nommée « Organigramme du personnel » ; chaque nœud repliable est un `details` natif au clavier.

## Tests automatisés qui couvrent cet écran
- Web : `n7-hr` (arbre : tri, racines orphelines, boucle sans perte, compteur ; page en lecture seule)
- Audit navigateur : non rejoué

## Limites connues
- Pas de vue graphique en cases : arbre de listes imbriquées.
- Pas de filtre par service.

## Écarts constatés
| Date | Scénario | Description | Défaut ouvert (D…) |
|---|---|---|---|
| | | | |
