# Fiche de test — Apprenants

| | |
|---|---|
| **Route** | `/training/learners` |
| **Livrée par** | S5.2b, Lot B (apprenants sans entreprise) |
| **Accès** | Utilisateur avec `training.learner.read` (module « Apprenants » du hub). |
| **Droits** | **Lire** : chargé de compte (les apprenants de ses entreprises), Responsable commercial (son équipe), Responsable Investudy, Direction et Support (tous). La Finance ne lit pas les fiches d'apprenants. **Créer et modifier** : chargé de compte (ses entreprises), Responsable Investudy. **Supprimer** (logiquement) : Responsable Investudy seulement. |
| **Rôles de test** | sa, inv, dir, cc, sup |

*Fiche d'interface de la [charte de tests](../../CHARTE-DE-TESTS.md). À rejouer à chaque changement de l'écran. Cocher, dater, signer ; tout écart devient un défaut.*

## Préconditions
Pile locale avec le jeu de démonstration (12 apprenants répartis sur 5 entreprises) ; un compte chargé de compte, un compte Responsable Investudy.

## Scénarios
| N° | Scénario | Étapes | Résultat attendu | Constaté (✔ / ✘) | Date et initiales |
|---|---|---|---|---|---|
| 1 | **Liste et recherche** | Ouvrir « Apprenants » ; taper un nom dans la recherche. | Nombre d'apprenants annoncé ; chaque ligne : nom, entreprise, e-mail et téléphone ; état vide lisible ; le chargé de compte ne voit que ses entreprises. | ☐ | |
| 2 | **Créer : erreurs avant l'envoi** | « Nouvel apprenant », valider sans rien saisir. | Champs en surbrillance (entreprise, nom, prénom), messages annoncés, fenêtre ouverte. | ☐ | |
| 3 | **Créer un apprenant** | Choisir l'entreprise, saisir nom, prénom, e-mail et un téléphone commençant par +237. | Apprenant listé avec son entreprise ; un téléphone commençant par 0 est refusé avec le message de la règle commune. | ☐ | |
| 4 | **Lier à un contact** | Choisir un contact de l'entreprise dans « Contact de l'entreprise ». | Seuls les contacts de l'entreprise choisie sont proposés ; le lien est facultatif. | ☐ | |
| 5 | **Doublon probable** | Créer un apprenant de même nom (ou même e-mail) dans la même entreprise. | Refus avec un message ; bouton « Créer quand même » ; dans une autre entreprise, aucun doublon. | ☐ | |
| 6 | **Modifier** | Menu de la ligne : « Modifier ». | L'entreprise est affichée et ne change pas ; version contrôlée (modification concurrente refusée). | ☐ | |
| 7 | **Inscrire depuis la ligne** | Menu : « Inscrire à une session ». | La fenêtre d'inscription s'ouvre avec l'apprenant choisi (voir la fiche des inscriptions). | ☐ | |
| 8 | **Supprimer** | Responsable Investudy : menu « Supprimer l'apprenant », confirmer ; essayer sur un apprenant avec une inscription confirmée. | L'apprenant disparaît de la liste ; refus avec un message s'il a une inscription confirmée ; le chargé de compte n'a pas cette action. | ☐ | |
| 9 | **Portée** | Se connecter comme un autre chargé de compte. | Les apprenants d'une entreprise qui n'est pas la sienne n'apparaissent pas et leur adresse renvoie « introuvable ». | ☐ | |
| 10 | **Sans entreprise** | « Nouvel apprenant » ; cocher « Sans entreprise (étudiant ou particulier) ». | La liste « Entreprise » est désactivée, le choix « Nature » (Étudiant / Particulier) apparaît, le contact est désactivé ; valider sans nature ne bloque pas, sans entreprise ni case l'entreprise reste exigée. | ☐ | |
| 11 | **Créer un étudiant, un particulier** | Responsable Investudy : saisir nom, prénom, nature, valider. | L'apprenant apparaît avec la pastille « Étudiant » ou « Particulier » à la place de l'entreprise ; un même nom parmi les étudiants et particuliers est signalé (« Créer quand même »), mais pas contre un apprenant d'entreprise. | ☐ | |
| 12 | **Filtre par nature** | Utiliser « Tous / Entreprises / Étudiants / Particuliers ». | La liste et le compteur suivent le filtre ; la démonstration compte 2 étudiants et 1 particulier. | ☐ | |
| 13 | **Qui les voit** | Se connecter en chargé de compte, puis en Responsable commercial, puis en Support. | Ni le chargé de compte ni le Responsable commercial ne voient les étudiants ni les particuliers (leur adresse renvoie « introuvable ») ; le Support les lit, sans pouvoir les créer ; « Nouvel apprenant » avec « sans entreprise » est refusé au chargé de compte (« interdit »). | ☐ | |

## Accessibilité
- ☐ Clavier seul : Tab et Maj+Tab parcourent tous les contrôles dans un ordre logique ; le focus est toujours visible ; aucun piège de focus hors fenêtre modale.
- ☐ Un seul titre de niveau 1 ; pas de saut de niveau (h2 avant h3).
- ☐ Chaque champ a un libellé relié ; un champ non conforme est en surbrillance **et** accompagné d'un message écrit relié (`aria-describedby`), jamais la couleur seule ; le focus va au premier champ en erreur.
- ☐ Les messages d'état et d'erreur sont annoncés (`role=alert` ou `aria-live`).
- ☐ Fenêtres modales : le focus entre dans la fenêtre, Échap la ferme, le focus revient à l'élément d'origine, l'arrière-plan est inerte.
- ☐ Lisible à 200 % de zoom et à 375 px de large, sans défilement horizontal de la page.
- ☐ Le tableau a un titre (caption) ; chaque menu d'actions de ligne porte le nom de l'apprenant ; le nombre d'apprenants est annoncé (`aria-live`) ; les erreurs de saisie sont annoncées et la fenêtre reste ouverte.

## Tests automatisés qui couvrent cet écran
- API : `enrollment-use-cases.spec` (21 scénarios), `enrollments-http.integration` (10 scénarios), `idor-contract` (6 routes « objet » d'apprenants)
- Web : `s57-enrollments` (16 scénarios, dont la comparaison avec le domaine réel du serveur) ; audit navigateur : non rejoué

## Limites connues
- Pas de fiche détaillée par apprenant ni d'historique de ses formations (S5.3) ; durée de conservation des données non fixée (D11, D65) : suppression logique seulement.

## Écarts constatés
| Date | Scénario | Description | Défaut ouvert (D…) |
|---|---|---|---|
| | | | |
