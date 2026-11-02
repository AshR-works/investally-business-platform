# Fiche de test — Ambassadeurs

| | |
|---|---|
| **Route** | `/ambassadors` |
| **Livrée par** | S4.4b |
| **Accès** | Utilisateur avec `bd.ambassador.read`. |
| **Droits** | Lire : chargé de compte (les siens), Responsable commercial et Direction (tous) ; créer : chargé de compte, Responsable commercial ; **modifier : Responsable commercial** (son équipe). |
| **Rôles de test** | cc, rc, dir |

*Fiche d'interface de la [charte de tests](../../CHARTE-DE-TESTS.md). À rejouer à chaque changement de l'écran. Cocher, dater, signer ; tout écart devient un défaut.*

## Préconditions
Un chargé de compte et son Responsable commercial ; une entreprise du chargé de compte ; un second chargé de compte d'une autre équipe.

## Scénarios
| N° | Scénario | Étapes | Résultat attendu | Constaté (✔ / ✘) | Date et initiales |
|---|---|---|---|---|---|
| 1 | **Création toujours manuelle** | Ouvrir la page. | Le texte rappelle que créer un ambassadeur est une décision manuelle ; aucun ambassadeur n'apparaît sans action. | ☐ | |
| 2 | **Créer un ambassadeur client** | Chargé de compte : « Nouvel ambassadeur » ; nom, prénom, origine « Client », entreprise, e-mail ; enregistrer. | Ambassadeur listé avec « Client », son entreprise et « Depuis » au format mois/année ; vous en êtes le responsable. | ☐ | |
| 3 | **Créer un apprenant sans entreprise** | Origine « Apprenant » ; ne pas choisir d'entreprise. | Création acceptée ; entreprise affichée « — ». | ☐ | |
| 4 | **Champs non conformes** | Enregistrer sans nom, sans prénom, client sans entreprise ; saisir un e-mail ou une date invalide. | Champs en surbrillance avec liste des corrections annoncée ; focus sur le premier ; date future refusée. | ☐ | |
| 5 | **E-mail déjà pris** | Créer un second ambassadeur avec le même e-mail (casse différente). | Alerte du serveur annoncée, fenêtre toujours ouverte ; aucune création. | ☐ | |
| 6 | **Entreprise d'un collègue** | Essayer de rattacher un client à l'entreprise d'un collègue (adresse directe, ou liste). | Refusé (« introuvable ») ; la liste ne propose que les entreprises de votre périmètre. | ☐ | |
| 7 | **Rechercher et filtrer** | Rechercher un nom ou un e-mail ; filtrer par origine. | Résultats exacts, triés par nom. | ☐ | |
| 8 | **Modifier (Responsable commercial)** | Menu de la ligne, « Modifier » ; changer le téléphone, la note ; enregistrer. | Mise à jour ; l'origine est affichée « non modifiable » ; un client ne peut pas perdre son entreprise ; version périmée = conflit. | ☐ | |
| 9 | **Chargé de compte : pas de modification** | Se connecter en chargé de compte. | Aucun menu « Modifier » (droit réservé au Responsable commercial) ; l'accès direct est refusé. | ☐ | |
| 10 | **Portée** | Chargé de compte, collègue d'une autre équipe, Responsable commercial, Direction. | Chargé de compte : les siens ; collègue : aucun ambassadeur d'autrui ; Responsable commercial et Direction : tous. | ☐ | |
| 11 | **Direction : lecture seule** | Se connecter en Direction. | Liste visible ; ni « Nouvel ambassadeur » ni « Modifier ». | ☐ | |
| 12 | **Sans accès** | Se connecter avec un rôle sans droit de lecture (Support). | Message « Votre profil n'a pas accès aux ambassadeurs ». | ☐ | |

## Accessibilité
- ☐ Clavier seul : Tab et Maj+Tab parcourent tous les contrôles dans un ordre logique ; le focus est toujours visible ; aucun piège de focus hors fenêtre modale.
- ☐ Un seul titre de niveau 1 ; pas de saut de niveau (h2 avant h3).
- ☐ Chaque champ a un libellé relié ; un champ non conforme est en surbrillance **et** accompagné d'un message écrit relié (`aria-describedby`), jamais la couleur seule ; le focus va au premier champ en erreur.
- ☐ Les messages d'état et d'erreur sont annoncés (`role=alert` ou `aria-live`).
- ☐ Fenêtres modales : le focus entre dans la fenêtre, Échap la ferme, le focus revient à l'élément d'origine, l'arrière-plan est inerte.
- ☐ Lisible à 200 % de zoom et à 375 px de large, sans défilement horizontal de la page.
- ☐ Le tableau a un titre (caption) ; le menu d'actions de ligne porte le nom de l'ambassadeur ; le nombre de résultats est annoncé (`aria-live`).

## Tests automatisés qui couvrent cet écran
- API : `ambassadors-http.integration`, `ambassador.spec`, `ambassador-use-cases.spec`, `idor-contract.integration` (lecture et modification)
- Web : `s53.test.ts` (saisie, cohérence avec le domaine du serveur, module du hub)
- Mutants : S4.4b (17)
- Audit navigateur : liste vide, champs non conformes, liste, e-mail déjà pris (0 violation)

## Limites connues
- Pas de suggestion « après certification » (attend Investudy, D118) ; pas de fin d'ambassade ni de suppression (D119) ; le chargé de compte ne modifie pas ses ambassadeurs (D120) ; pas de panneau sur la fiche entreprise (D122).

## Écarts constatés
| Date | Scénario | Description | Défaut ouvert (D…) |
|---|---|---|---|
| | | | |
