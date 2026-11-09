# Fiche de test — Fiche d'un employé

| | |
|---|---|
| **Route** | `/hr/employees/[id]` |
| **Livrée par** | RH-1b |
| **Accès** | Depuis le nom d'un employé dans la liste du personnel, ou depuis l'encadré des écarts. |
| **Droits** | **Lire** : `hr.employee.read` selon la portée (RH, Direction, Super administrateur : toutes ; Responsable commercial : son équipe ; les autres : leur propre fiche liée à leur compte). Hors portée : « introuvable ». **La consultation est enregistrée dans l'audit.** |
| **Rôles de test** | rh, dir, chef, cc, sup |

*Fiche d'interface de la [charte de tests](../../CHARTE-DE-TESTS.md). À rejouer à chaque changement de l'écran. Cocher, dater, signer ; tout écart devient un défaut.*

## Préconditions
Pile locale réinitialisée avec le jeu de démonstration (bloc « rh » : 11 fiches fictives, dont une sortie). Comptes : `rh@demo…` (la RH), `direction@demo…`, `compte1@demo…`, `support@demo…`.

## Scénarios
| N° | Scénario | Étapes | Résultat attendu | Constaté (✔ / ✘) | Date et initiales |
|---|---|---|---|---|---|
| 1 | **Résumé** | Ouvrir une fiche depuis la liste. | État, matricule, poste, service, responsable, compte d'accès, e-mail et téléphone professionnels, dates d'entrée (et de sortie, motif pour un sorti). | ☐ | |
| 2 | **Aucune donnée sensible** | Lire toute la fiche. | Ni salaire, ni naissance, ni adresse personnelle, ni pièce d'identité. | ☐ | |
| 3 | **Responsable** | Cliquer le nom du responsable (RH et Direction). | Ouvre sa fiche ; les autres rôles voient le nom sans lien. | ☐ | |
| 4 | **Hors portée** | Comme chargé de compte, ouvrir l'adresse de la fiche d'un collègue ; puis une adresse inventée. | Même message « introuvable » dans les deux cas. | ☐ | |
| 5 | **Sa propre fiche** | Comme chargé de compte lié à une fiche, ouvrir sa fiche par son adresse. | Elle s'ouvre (portée « propre »). | ☐ | |
| 6 | **Trace d'audit** | Ouvrir une fiche, puis consulter l'audit (Super administrateur). | Une entrée « lecture » pour chaque ouverture, avec la session de l'utilisateur. | ☐ | |

## Accessibilité
- ☐ Clavier seul : Tab et Maj+Tab parcourent tous les contrôles dans un ordre logique ; le focus est toujours visible ; aucun piège de focus hors fenêtre modale.
- ☐ Un seul titre de niveau 1 ; pas de saut de niveau (h2 avant h3).
- ☐ Chaque champ a un libellé relié ; un champ non conforme est en surbrillance **et** accompagné d'un message écrit relié (`aria-describedby`), jamais la couleur seule ; le focus va au premier champ en erreur.
- ☐ Les messages d'état et d'erreur sont annoncés (`role=alert` ou `aria-live`).
- ☐ Fenêtres modales : le focus entre dans la fenêtre, Échap la ferme, le focus revient à l'élément d'origine, l'arrière-plan est inerte.
- ☐ Lisible à 200 % de zoom et à 375 px de large, sans défilement horizontal de la page.

## Tests automatisés qui couvrent cet écran
- API : `hr-employees-http.integration` (portée, 404 identique, audit VIEW), contrat IDOR
- Web : `n7-hr` (coque commune, aucune donnée sensible) ; audit navigateur : non rejoué

## Limites connues
- La fiche est en lecture : les modifications se font depuis la liste.
- Pas de lien vers le compte d'accès lui-même.

## Écarts constatés
| Date | Scénario | Description | Défaut ouvert (D…) |
|---|---|---|---|
| | | | |
