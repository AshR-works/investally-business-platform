# Fiche de test — Mes absences

| | |
|---|---|
| **Route** | `/hr/leave` |
| **Livrée par** | RH-2b (recette et mutants : RH-2c) |
| **Accès** | Tout utilisateur qui détient `hr.leave.read` : menu Ressources humaines › Mes absences (et l'onglet « Mes absences » des écrans de congés). |
| **Droits** | **Lire ses demandes et son solde** : tout employé (portée Propre). **Demander** : tout employé dont le compte est lié à une fiche ; la RH peut aussi saisir **pour un autre** (validée d'emblée) et dans le passé. **Annuler** : l'employé (demande en attente, ou validée qui n'a pas commencé, avec motif) ; la RH aussi une absence en cours. |
| **Rôles de test** | cc, rh, chef, sa |

*Fiche d'interface de la [charte de tests](../../CHARTE-DE-TESTS.md). À rejouer à chaque changement de l'écran. Cocher, dater, signer ; tout écart devient un défaut.*

## Préconditions
Pile locale avec le jeu de démonstration (blocs « rh » et « conges »). Comptes : `compte1@demo…` (chargée de compte, une demande en attente), `compte2@demo…` (trois demandes), `rh@demo…`. Aucun jour férié n'est saisi au départ.

## Scénarios
| N° | Scénario | Étapes | Résultat attendu | Constaté (✔ / ✘) | Date et initiales |
|---|---|---|---|---|---|
| 1 | **Solde** | Ouvrir la page avec `compte1`. | Cinq cartes : Disponible, Acquis, Ajustements, Pris, En attente. Acquis 18 jours (1,5 par mois), En attente 5 jours, Disponible 13 jours (18 − 5). | ☐ | |
| 2 | **Historique et filtres** | Filtrer Toutes / En attente / Validées / Refusées / Annulées ; changer l'année. | Le compteur et le tableau suivent le filtre ; une année sans demande dit « Aucune demande en <année> ». | ☐ | |
| 3 | **Demande valide** | « Demander une absence » ; type Congé annuel, deux jours ouvrés dans le futur ; envoyer. | Message « La demande est enregistrée » ; la ligne apparaît « En attente » ; le solde « En attente » augmente de la durée. | ☐ | |
| 4 | **Champs obligatoires** | Envoyer le formulaire vide (type non choisi). | Le champ « Type d'absence » est en surbrillance avec son message écrit ; rien n'est envoyé. | ☐ | |
| 5 | **Passé et fin avant début** | Choisir une date passée, puis une fin antérieure au début. | Pour un employé : « Une demande dans le passé est réservée à la RH » ; « La date de fin ne peut pas précéder le début » ; la RH peut saisir dans le passé. | ☐ | |
| 6 | **Week-ends et jours fériés** | Demander du vendredi au lundi suivant. | Seuls les jours ouvrés sont décomptés (2 jours) ; une période réduite à un week-end est refusée par le serveur (« Aucun jour décompté »). | ☐ | |
| 7 | **Demi-journées** | Cocher « La première journée commence l'après-midi » et/ou « La dernière journée s'arrête à midi ». | La durée perd une demi-journée par case cochée ; la période est dite « (après-midi) » / « (matin) » ; si la RH interdit les demi-journées, les cases n'apparaissent pas. | ☐ | |
| 8 | **Chevauchement** | Redemander une période déjà couverte (même d'une demi-journée). | Refusé : « Une demande couvre déjà cette période » ; rien n'est créé. | ☐ | |
| 9 | **Solde insuffisant** | Demander plus de jours de congé annuel que le solde disponible. | Refusé : « Solde insuffisant : … » ; une maladie ou une permission n'est jamais refusée pour le solde et ne le consomme pas. | ☐ | |
| 10 | **Annuler** | Menu de ligne › Annuler la demande, sur une demande en attente, puis sur une validée. | En attente : annulée sans motif obligatoire, les jours reviennent au solde. Validée : le motif est obligatoire ; l'action est absente d'une demande refusée ou déjà annulée. | ☐ | |
| 11 | **Saisie par la RH** | Avec `rh`, « Demander une absence » ; choisir un autre employé. | Le menu « Employé » (Moi-même par défaut) liste les employés en poste ; la mention « validée d'emblée » s'affiche ; la demande est validée dès l'envoi. | ☐ | |
| 12 | **Compte sans fiche** | Avec un compte non lié à une fiche employé (par exemple le Super administrateur). | Message « Aucune fiche employé n'est liée à votre compte » ; pas d'erreur technique ; l'historique est vide. | ☐ | |

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
- API : `hr-leave-http.integration` (cycle complet, droits et portée, validations, demandes simultanées), `leave-use-cases.spec`, `leave-calendar.spec`, contrat IDOR (routes de demandes) ; Web : `leave.test` (dates, durées, validation de la demande, annulation, motifs, menu par profil), `lib/leave.ts` couvert par les mutants de RH-2c ; audit navigateur : voir la recette RH-2c

## Limites connues
- Une demande à cheval sur deux années est comptée sur l'année de début (D167) ; « aujourd'hui » se compte en UTC (D168) ; aucune notification au responsable (D169).
- Seul le mode clair est vérifié ; mode sombre, 1280 et 1920 px à contrôler.

## Écarts constatés
| Date | Scénario | Description | Défaut ouvert (D…) |
|---|---|---|---|
| | | | |
