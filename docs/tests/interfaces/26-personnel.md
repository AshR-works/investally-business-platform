# Fiche de test — Personnel

| | |
|---|---|
| **Route** | `/hr/employees` |
| **Livrée par** | RH-1b |
| **Accès** | Utilisateur qui détient `hr.employee.read` **en portée Tous** (RH, Direction, Super administrateur) : menu Ressources humaines › Personnel. |
| **Droits** | **Lire** : RH, Direction, Super administrateur (tout le personnel). **Créer, modifier, enregistrer une sortie, réintégrer** : RH et Super administrateur seulement. Le Responsable commercial et le chargé de compte n'ont pas l'entrée de menu ; leur propre fiche reste lisible par son adresse. |
| **Rôles de test** | rh, dir, chef, cc, sa |

*Fiche d'interface de la [charte de tests](../../CHARTE-DE-TESTS.md). À rejouer à chaque changement de l'écran. Cocher, dater, signer ; tout écart devient un défaut.*

## Préconditions
Pile locale réinitialisée avec le jeu de démonstration (bloc « rh » : 11 fiches fictives, dont une sortie). Comptes : `rh@demo…` (la RH), `direction@demo…`, `compte1@demo…`, `support@demo…`.

## Scénarios
| N° | Scénario | Étapes | Résultat attendu | Constaté (✔ / ✘) | Date et initiales |
|---|---|---|---|---|---|
| 1 | **Liste et filtres** | Ouvrir la page ; filtrer En poste / Sortis / Tous, par service, chercher un nom. | 10 en poste au départ ; « Sortis » montre l'ancien chargé de compte avec sa date ; compteur et pagination justes. | ☐ | |
| 2 | **Droits d'action** | Comparer RH et Direction. | La RH voit « Nouvel employé » et le menu de ligne ; la Direction lit sans aucune action. | ☐ | |
| 3 | **Nouvel employé** | « Nouvel employé » ; valider vide, puis saisir une fiche complète. | Champs en surbrillance avec messages (nom, prénom, poste, service, date d'entrée) ; la fiche apparaît dans la liste, l'annuaire et l'organigramme. | ☐ | |
| 4 | **Responsable et compte** | Choisir un responsable et un compte dans la fenêtre. | Le responsable se choisit parmi les personnes en poste ; les comptes déjà liés ne sont pas proposés ; un compte inconnu ou déjà lié est refusé par le serveur avec un message. | ☐ | |
| 5 | **Unicité** | Créer deux fiches avec le même matricule, puis avec le même e-mail professionnel. | Message de conflit lisible (« déjà attribué à … ») ; rien n'est créé. | ☐ | |
| 6 | **Boucle de hiérarchie** | Donner à un responsable pour responsable l'un de ses collaborateurs. | Refusé : « boucle dans la hiérarchie ». | ☐ | |
| 7 | **Modifier** | Menu de ligne › Modifier ; changer le poste ; ouvrir la même fiche dans un second onglet et enregistrer les deux. | Le premier enregistrement passe ; le second reçoit « modifié par un autre utilisateur ». | ☐ | |
| 8 | **Enregistrer une sortie** | Menu de ligne › Enregistrer une sortie ; date avant l'entrée, puis date valide et motif. | La date avant l'entrée est refusée ; la personne passe dans « Sortis », disparaît de l'annuaire et de l'organigramme ; sa fiche est gelée. | ☐ | |
| 9 | **Responsable avec collaborateurs** | Enregistrer la sortie d'un responsable qui a des collaborateurs en poste. | Refusé avec le nombre de collaborateurs à réaffecter. | ☐ | |
| 10 | **Réintégrer** | Menu de ligne d'un sorti › Réintégrer. | La personne revient en poste, sans date ni motif de sortie ; rien n'a été supprimé à aucun moment. | ☐ | |
| 11 | **Écarts avec les comptes** | Regarder l'encadré en haut de page (RH et Direction). | La démo signale la Finance (responsable RH : la DGA ; compte sans responsable) ; le texte dit que la hiérarchie des comptes n'est jamais modifiée ; aucun bouton de correction. | ☐ | |

## Accessibilité
- ☐ Clavier seul : Tab et Maj+Tab parcourent tous les contrôles dans un ordre logique ; le focus est toujours visible ; aucun piège de focus hors fenêtre modale.
- ☐ Un seul titre de niveau 1 ; pas de saut de niveau (h2 avant h3).
- ☐ Chaque champ a un libellé relié ; un champ non conforme est en surbrillance **et** accompagné d'un message écrit relié (`aria-describedby`), jamais la couleur seule ; le focus va au premier champ en erreur.
- ☐ Les messages d'état et d'erreur sont annoncés (`role=alert` ou `aria-live`).
- ☐ Fenêtres modales : le focus entre dans la fenêtre, Échap la ferme, le focus revient à l'élément d'origine, l'arrière-plan est inerte.
- ☐ Lisible à 200 % de zoom et à 375 px de large, sans défilement horizontal de la page.
- ☐ La fenêtre de saisie rappelle qu'aucune donnée sensible n'est enregistrée.
- ☐ Le menu de ligne a un nom accessible « Actions pour <nom> ».

## Tests automatisés qui couvrent cet écran
- API : `hr-employees-http.integration` (cycle, refus, droits et portée, archivage, écarts, règles de la base, verrou optimiste, audit), `employee-use-cases.spec`, `employee.spec`, contrat IDOR (4 routes)
- Web : `n7-hr` (saisie comparée au domaine réel du serveur, actions selon l'état et les droits, aucune suppression) ; audit navigateur : non rejoué

## Limites connues
- Pas d'export du personnel, pas d'historique des postes.
- Un compte déjà lié à une fiche archivée n'est plus proposé (l'unicité vaut pour tous).

## Écarts constatés
| Date | Scénario | Description | Défaut ouvert (D…) |
|---|---|---|---|
| | | | |
