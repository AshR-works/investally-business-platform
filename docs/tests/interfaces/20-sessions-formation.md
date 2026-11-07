# Fiche de test — Sessions de formation

| | |
|---|---|
| **Route** | `/training/sessions` |
| **Livrée par** | S5.2a |
| **Accès** | Utilisateur avec `training.session.read` (module « Sessions de formation » du hub, et lien depuis le catalogue). |
| **Droits** | **Lire** : Direction, Responsable commercial, chargé de compte, Support, Finance (toutes les sessions), **formateur : seulement les siennes** (formateur lié à son compte). **Écrire** (planifier, modifier, ouvrir, reporter, annuler) : Responsable Investudy et Super administrateur. RH et Fiscalité : aucun accès. |
| **Rôles de test** | sa, inv, dir, cc, sup |

*Fiche d'interface de la [charte de tests](../../CHARTE-DE-TESTS.md). À rejouer à chaque changement de l'écran. Cocher, dater, signer ; tout écart devient un défaut.*

## Préconditions
Pile locale avec le jeu de démonstration (7 sessions de démonstration : deux terminées, une en cours, une ouverte, une planifiée, une reportée, une annulée) ; un compte Responsable Investudy, un compte Direction, un formateur lié à un compte.

## Scénarios
| N° | Scénario | Étapes | Résultat attendu | Constaté (✔ / ✘) | Date et initiales |
|---|---|---|---|---|---|
| 1 | **Liste et filtres** | Ouvrir « Sessions de formation » ; filtrer par état, salle, formateur et période. | Nombre de sessions annoncé ; chaque ligne montre certificat et rythme, dates, salle, formateur, capacité (« 13 places sur 13 utiles »), état et phase ; état vide lisible ; période à l'envers refusée avec un message. | ☐ | |
| 2 | **Planifier : erreurs avant l'envoi** | Valider « Nouvelle session » sans rien saisir. | Champs en surbrillance, messages annoncés, fenêtre ouverte, premier champ fautif pris en focus. | ☐ | |
| 3 | **Date de début** | Saisir un samedi, une date passée, une date correcte. | Samedi : « jour de cours (du lundi au vendredi) » ; passé refusé ; date correcte : le dernier jour de cours s'affiche en direct (une semaine : le vendredi). | ☐ | |
| 4 | **Capacité plafonnée** | Choisir la salle de marchés (14 postes dont 1 en panne) et saisir 14. | Refusé : la capacité dépasse les places utiles de la salle (13) ; 13 accepté. | ☐ | |
| 5 | **Module pratique, salle avec postes** | Choisir un certificat à module pratique et une salle de cours. | Refusé : « module pratique : choisissez une salle avec postes de travail » ; un certificat théorique est accepté en salle de cours. | ☐ | |
| 6 | **Rythme du soir** | Ouvrir la liste des rythmes de la fenêtre. | Seul le rythme du jour est proposé (le soir est en préparation). | ☐ | |
| 7 | **Chevauchement** | Planifier une seconde session dans la même salle ou avec le même formateur sur des dates qui se recouvrent. | Refus avec un message qui nomme la salle (« est déjà prise ») ou le formateur (« est déjà pris ») et la session en conflit ; fenêtre ouverte ; une session annulée libère ses dates. | ☐ | |
| 8 | **Ouvrir aux inscriptions** | Menu de la ligne : « Ouvrir aux inscriptions », confirmer. | La session passe « Ouverte aux inscriptions » ; l'action n'est plus proposée. | ☐ | |
| 9 | **Modifier** | Menu : « Modifier » ; changer la capacité, le formateur, la salle. | Mêmes plafonds qu'à la planification ; une session commencée : salle et formateur grisés, seule la capacité change. | ☐ | |
| 10 | **Reporter** | Menu : « Reporter » ; saisir une nouvelle date de début, sans motif puis avec motif. | Sans motif : refusé avant l'envoi ; avec motif : nouvelle date, fin recalculée, état conservé, inscrits conservés ; pas de report après le début. | ☐ | |
| 11 | **Annuler** | Menu : « Annuler la session » ; sans motif puis avec motif. | Motif obligatoire ; la session reste listée « Annulée » avec son motif et n'offre plus aucune action ; le filtre « Annulées » la montre. | ☐ | |
| 12 | **Portée du formateur** | Se connecter comme formateur lié à un compte. | Il ne voit que les sessions dont le formateur est lui ; il n'a aucun bouton d'écriture. | ☐ | |
| 13 | **Droits de lecture seule** | Direction ou chargé de compte. | Aucun bouton « Nouvelle session » ni menu d'actions de ligne. | ☐ | |
| 14 | **Modification concurrente** | Ouvrir une session dans deux onglets, la modifier dans l'un, puis dans l'autre. | Le second enregistrement est refusé : « modifiée par un autre utilisateur » (aucun écrasement silencieux). | ☐ | |

## Accessibilité
- ☐ Clavier seul : Tab et Maj+Tab parcourent tous les contrôles dans un ordre logique ; le focus est toujours visible ; aucun piège de focus hors fenêtre modale.
- ☐ Un seul titre de niveau 1 ; pas de saut de niveau (h2 avant h3).
- ☐ Chaque champ a un libellé relié ; un champ non conforme est en surbrillance **et** accompagné d'un message écrit relié (`aria-describedby`), jamais la couleur seule ; le focus va au premier champ en erreur.
- ☐ Les messages d'état et d'erreur sont annoncés (`role=alert` ou `aria-live`).
- ☐ Fenêtres modales : le focus entre dans la fenêtre, Échap la ferme, le focus revient à l'élément d'origine, l'arrière-plan est inerte.
- ☐ Lisible à 200 % de zoom et à 375 px de large, sans défilement horizontal de la page.
- ☐ Le tableau a un titre (caption) ; chaque menu d'actions de ligne porte le nom de la session ; les filtres d'état forment un groupe de boutons à bascule nommé ; le nombre de sessions est annoncé (`aria-live`) ; la date de fin calculée est annoncée en direct ; les erreurs de saisie sont annoncées et la fenêtre reste ouverte.

## Tests automatisés qui couvrent cet écran
- API : `training-session.spec` (15 scénarios), `session-use-cases.spec` (18 scénarios), `sessions-http.integration` (9 scénarios dont la concurrence et la portée du formateur), `idor-contract` (classe « lecture-formateur »)
- Web : `s56-sessions` (19 scénarios, dont la comparaison avec le domaine réel du serveur) ; audit navigateur : parcours écrit dans `scripts/a11y-audit.mjs`, non rejoué

## Limites connues
- Pas de vue calendrier (D150) ; pas d'inscriptions ni de contrôle sur le nombre d'inscrits (S5.2b, D151) ; pas de signalement quand une panne réduit les places utiles (D152) ; « aujourd'hui » compté en UTC et jours fériés ignorés (D153, D147).

## Écarts constatés
| Date | Scénario | Description | Défaut ouvert (D…) |
|---|---|---|---|
| | | | |
