# Fiche de test — Fiche d'une session

| | |
|---|---|
| **Route** | `/training/sessions/[id]` |
| **Livrée par** | S5.2b |
| **Accès** | Utilisateur avec `training.session.read` : depuis le titre du certificat dans la liste des sessions. |
| **Droits** | **Lire** : comme la liste des sessions (le formateur n'ouvre que ses sessions). **Inscrire** : chargé de compte et Responsable Investudy, sur une session ouverte et non complète. **Clôturer / rouvrir**, **saisir une présence** et **saisir une évaluation** : Responsable Investudy et Super administrateur ; **lire la feuille de présence** ou **d'évaluation** : les deux, et la Direction. |
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
| 7 | **Feuille de présence : qui y figure (S5.3a)** | Ouvrir une session ouverte avec des inscrits en attente, confirmés et annulés. | Seuls les inscrits **confirmés** ont une ligne ; une colonne par jour de cours entre le début et la fin de la session ; cases vides notées « · non saisi ». | ☐ | |
| 8 | **Saisir une présence** | Cliquer une case vide ; choisir « Présent », « En retard » ou « Absent » ; enregistrer. | Fenêtre avec les trois choix, aucun champ libre ; la case affiche le symbole **et** le nom du statut (jamais la couleur seule) après enregistrement. | ☐ | |
| 9 | **Corriger une présence** | Cliquer une case déjà saisie ; changer la valeur. | La valeur affichée change immédiatement ; aucune case « retirer » (la présence se corrige, elle ne se retire pas). | ☐ | |
| 10 | **Clôturer** | Bouton « Clôturer » (session ouverte) ; confirmer. | La session passe « Clôturée » ; le bouton devient « Rouvrir » ; message « les présences sont figées » sous le titre « Présences aux séances » ; les cases ne sont plus cliquables. | ☐ | |
| 11 | **Rouvrir sans puis avec motif** | Bouton « Rouvrir » ; valider sans motif, puis avec un motif. | Sans motif : refusé avant l'envoi (« motif de la réouverture obligatoire ») ; avec motif : la session redevient « Ouverte », les cases redeviennent cliquables. | ☐ | |
| 12 | **Session sans inscrit confirmé** | Ouvrir une session ouverte sans aucune confirmation. | Message « la feuille de présence apparaît une fois les premières inscriptions confirmées » à la place du tableau. | ☐ | |
| 13 | **Session planifiée** | Ouvrir une session planifiée. | Ni bouton « Clôturer », ni feuille de présence (pas encore d'inscrits confirmés possibles). | ☐ | |
| 14 | **Feuille d'évaluation (S5.3b)** | Ouvrir une session ouverte avec un inscrit confirmé. | Note (« non saisie » par défaut), taux de présence (%) et suggestion (« Aucune suggestion », « Attestation » ou « Certificat ») par ligne ; bouton « Saisir » puis « Corriger ». | ☐ | |
| 15 | **Saisir ou corriger une note** | Bouton « Saisir » ; indiquer une note sur 20 ; enregistrer. | Champ numérique seul (pas de commentaire libre) ; une note hors 0-20 est refusée avant l'envoi ; après enregistrement, le bouton devient « Corriger ». | ☐ | |
| 16 | **Évaluation figée à la clôture** | Clôturer la session. | Message « les évaluations sont figées » sous le titre « Évaluations » ; plus de bouton Saisir/Corriger ; redevient possible après réouverture. | ☐ | |

## Accessibilité
- ☐ Clavier seul : Tab et Maj+Tab parcourent tous les contrôles dans un ordre logique ; le focus est toujours visible ; aucun piège de focus hors fenêtre modale.
- ☐ Un seul titre de niveau 1 ; pas de saut de niveau (h2 avant h3).
- ☐ Chaque champ a un libellé relié ; un champ non conforme est en surbrillance **et** accompagné d'un message écrit relié (`aria-describedby`), jamais la couleur seule ; le focus va au premier champ en erreur.
- ☐ Les messages d'état et d'erreur sont annoncés (`role=alert` ou `aria-live`).
- ☐ Fenêtres modales : le focus entre dans la fenêtre, Échap la ferme, le focus revient à l'élément d'origine, l'arrière-plan est inerte.
- ☐ Lisible à 200 % de zoom et à 375 px de large, sans défilement horizontal de la page.
- ☐ La jauge est un élément `meter` nommé ; les informations sont dans une liste de définitions ; le bouton d'inscription expose son état désactivé.
- ☐ La feuille de présence : chaque case cliquable nomme l'apprenant, le jour et le statut actuel dans son `aria-label` ; une case non éditable (session clôturée) porte la même information en texte caché (`sr-only`), jamais la couleur seule.
- ☐ La feuille d'évaluation : la suggestion est un badge avec texte **et** teinte (jamais la couleur seule) ; le bouton Saisir/Corriger nomme l'apprenant visé dans un texte caché (`sr-only`).

## Tests automatisés qui couvrent cet écran
- API : `sessions-http.integration` (portée du formateur, clôture/réouverture, présences, évaluations et seuils : 16 scénarios), `enrollments-http.integration`, `evaluation.spec` (domaine), `evaluation-use-cases.spec` (cas d'usage)
- Web : `s57-enrollments` (contrôle des droits de la fiche) ; `s56-sessions` (`sessionActions`, `validateReopen`) ; audit navigateur : non rejoué

## Limites connues
- Pas de certificats ni d'attestations délivrés, ni de suggestion d'ambassadeur (lot c de S5.3) ; pas de calendrier (D150).
- Pas d'alerte avant l'oubli de clôturer ; la réouverture ne notifie personne.

## Écarts constatés
| Date | Scénario | Description | Défaut ouvert (D…) |
|---|---|---|---|
| | | | |
