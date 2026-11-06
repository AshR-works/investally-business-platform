# Fiche de test — Catalogue de formation

| | |
|---|---|
| **Route** | `/training` |
| **Livrée par** | S5.1 |
| **Accès** | Utilisateur avec `training.program.read` (le module « Formation » du hub). Chaque rubrique n'apparaît que si le profil peut la lire. |
| **Droits** | Lire : programmes et rythmes (chargé de compte, Responsable commercial, Direction, Formateur…), certificats et modules (`training.training.read`), salles, formateurs. **Écrire : Responsable Investudy et Super administrateur** (création, modification, archivage et réactivation). Les rythmes sont en lecture seule. |
| **Rôles de test** | sa, inv, dir, cc, sup |

*Fiche d'interface de la [charte de tests](../../CHARTE-DE-TESTS.md). À rejouer à chaque changement de l'écran. Cocher, dater, signer ; tout écart devient un défaut.*

## Préconditions
Pile locale avec le jeu de démonstration (programme « Certificats Marchés financiers », 7 modules, 5 certificats, 2 salles, 5 formateurs, 2 rythmes) ; un compte Responsable Investudy, un compte Direction, un chargé de compte, un compte Support.

## Scénarios
| N° | Scénario | Étapes | Résultat attendu | Constaté (✔ / ✘) | Date et initiales |
|---|---|---|---|---|---|
| 1 | **Six rubriques selon les droits** | Ouvrir « Formation » avec chaque rôle. | Super administrateur et Responsable Investudy : Programmes, Certificats, Modules, Salles, Formateurs, Rythmes ; chargé de compte : Programmes et Rythmes seulement ; Support : message « Votre profil n'a pas accès au catalogue ». | ☐ | |
| 2 | **Liste, recherche, filtre d'état** | Chaque rubrique : taper un mot, filtrer « Actifs », « Archivés », « Tous ». | Résultats annoncés (« n résultats ») ; état vide lisible ; actifs affichés par défaut ; pagination par 20. | ☐ | |
| 3 | **Créer un programme** | « Nouveau programme » : valider sans nom, puis avec un nom. | Sans nom : champ en surbrillance, message annoncé, fenêtre ouverte. Avec nom : programme listé « Actif ». Un nom déjà pris (même casse différente) est refusé (conflit). | ☐ | |
| 4 | **Créer un module** | « Nouveau module » ; cocher « Pratique sur poste de travail » pour un module de trading. | Colonne « Nature » : « Pratique sur poste » ou « Magistral » ; titre unique (sans casse). | ☐ | |
| 5 | **Créer un certificat avec ses modules** | « Nouveau certificat » : programme, titre, prix complet, prix par module, devise ; ajouter des modules, les monter, les descendre, en retirer un. | Les modules suivent l'ordre choisi ; le premier ne monte pas, le dernier ne descend pas ; la liste affiche « 750 000 FCFA ou 125 000 FCFA par module » et le nombre de modules ; un module archivé ne se propose pas à l'ajout. | ☐ | |
| 6 | **Tarifs** | Saisir un prix nul, négatif, à trois décimales, une devise sans prix. | Refus avec message précis ; XAF par défaut ; devise sur trois lettres. | ☐ | |
| 7 | **Créer une salle avec postes** | « Nouvelle salle » : 14 postes apprenants, 1 hors service, 1 poste formateur. | « Places utiles : 13 » annoncé en direct ; liste : « 13 places utiles (14 postes, 1 hors service) », type « Avec postes de travail ». | ☐ | |
| 8 | **Créer une salle de cours** | Type « Salle de cours », 16 places, 0 poste formateur, équipement « Écran 65 pouces ». | Libellés « Places apprenants » et « Dont places hors service » ; liste : « 16 places utiles », type « Salle de cours ». | ☐ | |
| 9 | **Créer un formateur externe** | « Nouveau formateur » avec un numéro commençant par 0, puis un numéro valide. | Le 0 initial est refusé avec le message de la règle commune ; le numéro valide est enregistré sans espace ; type « Externe ». | ☐ | |
| 10 | **Archiver et réactiver** | Menu de la ligne : « Archiver le module » (ou « Désactiver la salle »), confirmer ; filtre « Archivés » ; réactiver. | Confirmation non destructive (réversible) ; l'élément quitte la liste des actifs ; un élément archivé ne se modifie plus ; réactiver le rend modifiable. Un certificat ne se réactive pas si son programme est archivé. | ☐ | |
| 11 | **Rythmes** | Rubrique « Rythmes ». | Deux rythmes : jour (1 semaine, 9h–12h et 13h–17h, 35 h, ouvert) et soir (2 semaines, 18h–21h, 30 h, en préparation) ; aucun bouton de création. | ☐ | |
| 12 | **Modification et conflit de version** | Ouvrir un élément dans deux onglets, modifier dans l'un, puis dans l'autre. | Le second enregistrement est refusé : « modifié par un autre utilisateur » (aucun écrasement silencieux). | ☐ | |
| 13 | **Droits de lecture seule** | Direction ou chargé de compte : ouvrir une rubrique lisible. | Aucun bouton « Nouveau… » ni menu d'actions de ligne. | ☐ | |

## Accessibilité
- ☐ Clavier seul : Tab et Maj+Tab parcourent tous les contrôles dans un ordre logique ; le focus est toujours visible ; aucun piège de focus hors fenêtre modale.
- ☐ Un seul titre de niveau 1 ; pas de saut de niveau (h2 avant h3).
- ☐ Chaque champ a un libellé relié ; un champ non conforme est en surbrillance **et** accompagné d'un message écrit relié (`aria-describedby`), jamais la couleur seule ; le focus va au premier champ en erreur.
- ☐ Les messages d'état et d'erreur sont annoncés (`role=alert` ou `aria-live`).
- ☐ Fenêtres modales : le focus entre dans la fenêtre, Échap la ferme, le focus revient à l'élément d'origine, l'arrière-plan est inerte.
- ☐ Lisible à 200 % de zoom et à 375 px de large, sans défilement horizontal de la page.
- ☐ Le tableau a un titre (caption) ; chaque menu d'actions de ligne porte le nom de l'élément ; les filtres (rubrique, état) sont des boutons à bascule dans un groupe nommé ; le nombre de résultats est annoncé (`aria-live`) ; les boutons « Monter », « Descendre » et « Retirer » portent le nom du module ; les erreurs de saisie sont annoncées et la fenêtre reste ouverte.

## Tests automatisés qui couvrent cet écran
- API : `catalogue-use-cases.spec` (26 scénarios), `catalogue-http.integration` (7 scénarios), `idor-contract` (classe « référentiel »)
- Web : `s55-catalogue` (17 scénarios, dont la comparaison avec le domaine réel du serveur) ; audit navigateur : `scripts/a11y-audit.mjs` (parcours complet du catalogue)

## Limites connues
- Pas de fiche détaillée par élément (décision D-FORM-3) ; pas de suppression (archivage seulement, D-FORM-1) ; rythmes non administrables (D-FORM-2, D147) ; le compte d'un formateur n'est pas proposé dans l'interface (D142) ; pas d'export ni de tri personnalisé (D145) ; pas de sessions (S5.2).

## Écarts constatés
| Date | Scénario | Description | Défaut ouvert (D…) |
|---|---|---|---|
| | | | |
