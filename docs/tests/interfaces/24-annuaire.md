# Fiche de test — Annuaire du personnel

| | |
|---|---|
| **Route** | `/hr` |
| **Livrée par** | RH-1b |
| **Accès** | Tout utilisateur connecté (`hr.directory.read`) : menu Ressources humaines › Annuaire. |
| **Droits** | **Lire** : tous les rôles, en portée Tous. Aucune écriture. |
| **Rôles de test** | rh, dir, cc, sup, fisc |

*Fiche d'interface de la [charte de tests](../../CHARTE-DE-TESTS.md). À rejouer à chaque changement de l'écran. Cocher, dater, signer ; tout écart devient un défaut.*

## Préconditions
Pile locale réinitialisée avec le jeu de démonstration (bloc « rh » : 11 fiches fictives, dont une sortie). Comptes : `rh@demo…` (la RH), `direction@demo…`, `compte1@demo…`, `support@demo…`.

## Scénarios
| N° | Scénario | Étapes | Résultat attendu | Constaté (✔ / ✘) | Date et initiales |
|---|---|---|---|---|---|
| 1 | **Liste** | Ouvrir l'annuaire avec chaque rôle. | Les 10 personnes **en poste** (pas l'ancien employé sorti) : nom, poste, service, e-mail et téléphone **professionnels** seulement ; même liste pour tous les rôles. | ☐ | |
| 2 | **Aucune donnée sensible** | Regarder les colonnes et le code de la page. | Ni matricule, ni salaire, ni date de naissance, ni adresse personnelle, ni compte lié. | ☐ | |
| 3 | **Recherche** | Chercher « commercial », puis un nom, puis « zzz ». | Résultats par nom, poste, service ; « Personne ne correspond à cette recherche. » quand rien ne correspond ; le compteur annonce le total. | ☐ | |
| 4 | **Filtre par service** | Choisir « Investudy », puis « Tous ». | Seules les personnes du service ; la liste des services vient des personnes en poste. | ☐ | |
| 5 | **E-mail** | Cliquer sur un e-mail professionnel. | Ouvre le message (lien `mailto:`). | ☐ | |
| 6 | **Pagination** | Passer à la page 2 si la liste dépasse 20 personnes. | La page change, le compteur reste juste. | ☐ | |

## Accessibilité
- ☐ Clavier seul : Tab et Maj+Tab parcourent tous les contrôles dans un ordre logique ; le focus est toujours visible ; aucun piège de focus hors fenêtre modale.
- ☐ Un seul titre de niveau 1 ; pas de saut de niveau (h2 avant h3).
- ☐ Chaque champ a un libellé relié ; un champ non conforme est en surbrillance **et** accompagné d'un message écrit relié (`aria-describedby`), jamais la couleur seule ; le focus va au premier champ en erreur.
- ☐ Les messages d'état et d'erreur sont annoncés (`role=alert` ou `aria-live`).
- ☐ Fenêtres modales : le focus entre dans la fenêtre, Échap la ferme, le focus revient à l'élément d'origine, l'arrière-plan est inerte.
- ☐ Lisible à 200 % de zoom et à 375 px de large, sans défilement horizontal de la page.

## Tests automatisés qui couvrent cet écran
- API : `hr-employees-http.integration` (annuaire : actifs seulement, champs professionnels, taille de page bornée), `employee-use-cases.spec`
- Web : `n7-hr` (page en lecture seule, droit lu) ; audit navigateur : non rejoué

## Limites connues
- Pas d'export ni d'impression de l'annuaire.
- Les contacts affichés sont ceux saisis par la RH : aucune synchronisation avec les comptes.

## Écarts constatés
| Date | Scénario | Description | Défaut ouvert (D…) |
|---|---|---|---|
| | | | |
