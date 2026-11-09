# Fiche de test — Fiche d'une session

| | |
|---|---|
| **Route** | `/training/sessions/[id]` |
| **Livrée par** | S5.2b |
| **Accès** | Utilisateur avec `training.session.read` : depuis le titre du certificat dans la liste des sessions. |
| **Droits** | **Lire** : comme la liste des sessions (le formateur n'ouvre que ses sessions). **Inscrire** : chargé de compte et Responsable Investudy, sur une session ouverte et non complète. |
| **Rôles de test** | sa, inv, dir, cc, sup |

*Fiche d'interface de la [charte de tests](../../CHARTE-DE-TESTS.md). À rejouer à chaque changement de l'écran. Cocher, dater, signer ; tout écart devient un défaut.*

## Préconditions
Pile locale avec le jeu de démonstration ; ouvrir la session « en cours » ou la session ouverte.

## Scénarios
| N° | Scénario | Étapes | Résultat attendu | Constaté (✔ / ✘) | Date et initiales |
|---|---|---|---|---|---|
| 1 | **Résumé** | Ouvrir une session depuis la liste. | Certificat, programme, dates et volume horaire, salle et type, formateur, état et phase ; les modules du certificat pour qui peut lire le catalogue. | ☐ | |
| 2 | **Jauge de places** | Regarder la ligne « Places ». | Jauge et « n / capacité » ; « session complète » quand c'est le cas. | ☐ | |
| 3 | **Inscrire un apprenant** | Bouton « Inscrire un apprenant ». | Visible seulement sur une session ouverte ; désactivé si la session est complète ; la fenêtre ouvre la session choisie. | ☐ | |
| 4 | **Liste des inscrits** | Parcourir le tableau « Inscrits ». | Les inscriptions de la session avec leur état ; les actions suivent l'état et les droits ; la jauge se met à jour après chaque action. | ☐ | |
| 5 | **Session planifiée ou annulée** | Ouvrir une session planifiée, puis une annulée. | Planifiée : message « pas encore ouverte aux inscriptions » ; annulée : message « inscriptions à replacer » et son motif. | ☐ | |
| 6 | **Formateur** | Se connecter comme formateur lié à un compte. | Il ouvre ses sessions ; la fiche d'une session d'un autre renvoie « introuvable ». | ☐ | |

## Accessibilité
- ☐ Clavier seul : Tab et Maj+Tab parcourent tous les contrôles dans un ordre logique ; le focus est toujours visible ; aucun piège de focus hors fenêtre modale.
- ☐ Un seul titre de niveau 1 ; pas de saut de niveau (h2 avant h3).
- ☐ Chaque champ a un libellé relié ; un champ non conforme est en surbrillance **et** accompagné d'un message écrit relié (`aria-describedby`), jamais la couleur seule ; le focus va au premier champ en erreur.
- ☐ Les messages d'état et d'erreur sont annoncés (`role=alert` ou `aria-live`).
- ☐ Fenêtres modales : le focus entre dans la fenêtre, Échap la ferme, le focus revient à l'élément d'origine, l'arrière-plan est inerte.
- ☐ Lisible à 200 % de zoom et à 375 px de large, sans défilement horizontal de la page.
- ☐ La jauge est un élément `meter` nommé ; les informations sont dans une liste de définitions ; le bouton d'inscription expose son état désactivé.

## Tests automatisés qui couvrent cet écran
- API : `sessions-http.integration` (portée du formateur), `enrollments-http.integration`
- Web : `s57-enrollments` (contrôle des droits de la fiche) ; audit navigateur : non rejoué

## Limites connues
- Pas de présences ni d'évaluations (S5.3) ; pas de calendrier (D150).

## Écarts constatés
| Date | Scénario | Description | Défaut ouvert (D…) |
|---|---|---|---|
| | | | |
