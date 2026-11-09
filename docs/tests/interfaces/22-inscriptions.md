# Fiche de test — Inscriptions

| | |
|---|---|
| **Route** | `/training/enrollments` |
| **Livrée par** | S5.2b |
| **Accès** | Utilisateur avec `training.enrollment.read` (module « Inscriptions » du hub). |
| **Droits** | **Lire** : chargé de compte (les inscriptions de ses entreprises), Responsable commercial (son équipe), Responsable Investudy, Direction, Support et Finance (toutes). **Inscrire** : chargé de compte (ses apprenants) et Responsable Investudy. **Confirmer, annuler, replacer** : Responsable Investudy. |
| **Rôles de test** | sa, inv, dir, cc, sup |

*Fiche d'interface de la [charte de tests](../../CHARTE-DE-TESTS.md). À rejouer à chaque changement de l'écran. Cocher, dater, signer ; tout écart devient un défaut.*

## Préconditions
Pile locale avec le jeu de démonstration (15 inscriptions : confirmées, en attente, annulée, replacée, à replacer) ; un compte chargé de compte et un compte Responsable Investudy.

## Scénarios
| N° | Scénario | Étapes | Résultat attendu | Constaté (✔ / ✘) | Date et initiales |
|---|---|---|---|---|---|
| 1 | **File de confirmation** | Ouvrir « Inscriptions ». | Par défaut, les inscriptions **en attente de confirmation** ; filtres Toutes, En attente, Confirmées, À replacer, Annulées ; chaque ligne : apprenant et entreprise, session (lien vers sa fiche) et dates, agrément et montant compté, état. | ☐ | |
| 2 | **Inscrire un apprenant** | Depuis un apprenant ou une session : choisir l'apprenant, la session ouverte, l'agrément. | Les agréments de l'entreprise sont proposés avec ce qu'ils couvrent ; un agrément qui ne peut pas couvrir est marqué « indisponible » avec la raison ; un seul agrément possible est choisi d'office ; une session complète n'est pas proposée. | ☐ | |
| 3 | **Agrément demandé ou expiré** | Choisir un agrément seulement demandé, expiré ou dont la validité finit avant la session. | Refus avec la raison (« seulement demandé : la promesse n'est pas signée », « expire le … avant le début »). | ☐ | |
| 4 | **Plafond de l'agrément** | Inscrire plus d'apprenants que de places de l'agrément, ou plus que sa somme ne couvre. | Refus : « n'a plus de place (n utilisées sur n) » ou « montant restant … ne couvre pas le prix du certificat » ; un certificat sans prix est refusé sous un agrément en somme. | ☐ | |
| 5 | **Session complète, doublon, recouvrement** | Inscrire sur une session pleine ; inscrire deux fois le même apprenant ; l'inscrire à deux sessions qui se recouvrent. | Refus avec un message ; fenêtre ouverte ; rien n'est créé. | ☐ | |
| 6 | **Confirmer** | Responsable Investudy : menu « Confirmer » sur une inscription en attente. | L'inscription passe « Confirmée » ; l'action disparaît ; le chargé de compte n'a pas cette action. | ☐ | |
| 7 | **Annuler** | Menu « Annuler l'inscription », sans motif puis avec motif. | Motif obligatoire ; l'inscription passe « Annulée » avec son motif ; la place et l'agrément sont libérés (une nouvelle inscription est possible). | ☐ | |
| 8 | **Replacer** | Menu « Replacer sur une autre session » sur une inscription (en attente, confirmée ou à replacer). | Choix d'une autre session ouverte et d'un agrément ; la nouvelle inscription est « En attente », l'ancienne « Annulée » ; si le contrôle échoue, rien ne change. | ☐ | |
| 9 | **Session annulée** | Annuler une session qui a des inscrits. | Leurs inscriptions passent « À replacer » (aucune n'est supprimée) et se replacent depuis cet écran. | ☐ | |
| 10 | **Portée** | Se connecter comme un autre chargé de compte. | Aucune inscription d'une entreprise qui n'est pas la sienne ; leur adresse renvoie « introuvable ». | ☐ | |

## Accessibilité
- ☐ Clavier seul : Tab et Maj+Tab parcourent tous les contrôles dans un ordre logique ; le focus est toujours visible ; aucun piège de focus hors fenêtre modale.
- ☐ Un seul titre de niveau 1 ; pas de saut de niveau (h2 avant h3).
- ☐ Chaque champ a un libellé relié ; un champ non conforme est en surbrillance **et** accompagné d'un message écrit relié (`aria-describedby`), jamais la couleur seule ; le focus va au premier champ en erreur.
- ☐ Les messages d'état et d'erreur sont annoncés (`role=alert` ou `aria-live`).
- ☐ Fenêtres modales : le focus entre dans la fenêtre, Échap la ferme, le focus revient à l'élément d'origine, l'arrière-plan est inerte.
- ☐ Lisible à 200 % de zoom et à 375 px de large, sans défilement horizontal de la page.
- ☐ Le tableau a un titre (caption) ; chaque menu d'actions de ligne porte le nom de l'apprenant ; les filtres d'état forment un groupe de boutons à bascule nommé ; le nombre d'inscriptions est annoncé (`aria-live`) ; la raison d'un agrément indisponible est annoncée ; les erreurs de saisie sont annoncées et la fenêtre reste ouverte.

## Tests automatisés qui couvrent cet écran
- API : `enrollment-use-cases.spec` (21 scénarios), `approval-cover` / `enrollment.spec` (13 scénarios), `enrollments-http.integration` (10 scénarios dont les inscriptions simultanées), `idor-contract` (classe « objet »)
- Web : `s57-enrollments` (16 scénarios) ; audit navigateur : non rejoué

## Limites connues
- Pas de notification (V8, D156) ; pas d'alerte quand une session annulée laisse des inscrits à replacer (D157) ; un agrément qui expire après la confirmation n'est pas signalé (D158) ; paiement non affiché (la Finance n'existe pas encore).

## Écarts constatés
| Date | Scénario | Description | Défaut ouvert (D…) |
|---|---|---|---|
| | | | |
