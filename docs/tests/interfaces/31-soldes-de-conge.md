# Fiche de test — Soldes de congé

| | |
|---|---|
| **Route** | `/hr/leave/balances` |
| **Livrée par** | RH-2b (recette et mutants : RH-2c) |
| **Accès** | Utilisateur qui détient `hr.leave.manage` **en portée Tous** (RH, Super administrateur) : menu Ressources humaines › Soldes de congé. |
| **Droits** | **Voir les soldes de tout le personnel et les ajuster** : RH et Super administrateur seulement. La Direction lit les soldes (API) mais n'a pas cet écran de gestion ; un employé voit le sien dans « Mes absences ». |
| **Rôles de test** | rh, sa, dir, cc |

*Fiche d'interface de la [charte de tests](../../CHARTE-DE-TESTS.md). À rejouer à chaque changement de l'écran. Cocher, dater, signer ; tout écart devient un défaut.*

## Préconditions
Jeu de démonstration (blocs « rh » et « conges »). Compte `rh@demo…`.

## Scénarios
| N° | Scénario | Étapes | Résultat attendu | Constaté (✔ / ✘) | Date et initiales |
|---|---|---|---|---|---|
| 1 | **Liste** | Ouvrir la page. | Les dix employés en poste avec Disponible, Acquis, Ajustements, Pris, En attente ; l'ancien employé sorti n'y figure pas. | ☐ | |
| 2 | **Cohérence avec la démonstration** | Regarder Karim Biya et Inès Abena. | Karim : Pris 4 jours (son seul congé annuel validé) — la maladie et la permission **ne décomptent pas** ; Inès : En attente 5 jours. Disponible = Acquis + Ajustements − Pris − En attente. | ☐ | |
| 3 | **Année** | Changer l'année. | Les soldes sont recalculés pour l'année choisie ; l'acquisition suit les mois de service de l'année. | ☐ | |
| 4 | **Recherche** | Chercher un nom. | La liste et le compteur se limitent aux correspondances. | ☐ | |
| 5 | **Ajustement valide** | Menu de ligne › Ajuster le solde ; saisir 2 (ou -1,5) et un motif. | Message « L'ajustement est enregistré » ; la colonne « Ajustements » et « Disponible » changent ; l'ajustement apparaît dans « Déjà enregistrés ». | ☐ | |
| 6 | **Ajustement refusé** | Saisir 0, puis 61, puis 1,3, puis un motif vide. | Chaque cas est refusé avec son message (non nul, 60 jours au plus, par demi-journée, motif obligatoire). | ☐ | |
| 7 | **Ajout seul** | Chercher à modifier ou supprimer un ajustement passé. | Impossible : on ajoute un autre ajustement pour corriger ; l'historique garde tout. | ☐ | |
| 8 | **Droit insuffisant** | Avec `compte1`, ouvrir l'adresse de la page. | Message « Les soldes de tout le personnel sont réservés à la RH » ; l'entrée n'est pas dans le menu. | ☐ | |
| 9 | **Audit** | Après un ajustement, consulter le journal d'audit. | Une ligne avec l'auteur, l'employé, l'année, les jours et le motif. | ☐ | |

## Accessibilité
- ☐ Clavier seul : Tab et Maj+Tab parcourent tous les contrôles dans un ordre logique ; le focus est toujours visible ; aucun piège de focus hors fenêtre modale.
- ☐ Un seul titre de niveau 1 ; pas de saut de niveau (h2 avant h3).
- ☐ Chaque champ a un libellé relié ; un champ non conforme est en surbrillance **et** accompagné d'un message écrit relié (`aria-describedby`), jamais la couleur seule.
- ☐ Les messages d'état et d'erreur sont annoncés (`role=alert` ou `role=status`).
- ☐ Fenêtres modales : le focus entre dans la fenêtre, Échap la ferme, le focus revient à l'élément d'origine, l'arrière-plan est inerte.
- ☐ Lisible à 200 % de zoom et à 375 px de large, sans défilement horizontal de la page (le calendrier défile dans son cadre).
- ☐ La barre d'onglets « Absences et congés » annonce l'écran courant (`aria-current=page`).
- ☐ Aucune information n'est portée par la couleur seule : l'état d'une demande est écrit, une demi-journée est dite par un symbole **et** par du texte.

## Tests automatisés qui couvrent cet écran
- API : `hr-leave-http.integration` (ajustements, droits), `leave-use-cases.spec` (solde, seul le congé annuel décompte, ajout seul), `seed-demo.integration` (soldes de la démonstration) ; Web : `leave.test` (validation de l'ajustement, conversion de la virgule), mutants de RH-2c

## Limites connues
- Une requête de solde par employé de la page, 20 au plus (D174).
- Aucun report automatique d'une année sur l'autre : la RH ajuste (D172).

## Écarts constatés
| Date | Scénario | Description | Défaut ouvert (D…) |
|---|---|---|---|
| | | | |
