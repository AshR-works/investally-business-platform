# Fiche de test — Exports d'administration

| | |
|---|---|
| **Route** | `/admin/exports` |
| **Livrée par** | Lot C |
| **Accès** | Utilisateur qui détient `iam.export.read` **en portée Tous** : le **Super administrateur** seul. Menu Administration › Exports. |
| **Droits** | **Exporter** : Super administrateur seulement, avec un second facteur récent (code redemandé au clic) ; tout autre rôle : l'entrée n'existe pas et l'API répond 403. |
| **Rôles de test** | sa, dir, rh, inv, cc |

*Fiche d'interface de la [charte de tests](../../CHARTE-DE-TESTS.md). À rejouer à chaque changement de l'écran. Cocher, dater, signer ; tout écart devient un défaut.*

## Préconditions
Pile locale avec le jeu de démonstration (11 comptes, plusieurs sessions). Compte Super administrateur avec son second facteur ; un second compte (par exemple `direction@demo…`) pour le refus.

## Scénarios
| N° | Scénario | Étapes | Résultat attendu | Constaté (✔ / ✘) | Date et initiales |
|---|---|---|---|---|---|
| 1 | **Accès** | Se connecter en Super administrateur ; ouvrir Administration › Exports. | Trois cartes : Utilisateurs, Droits, Sessions, chacune avec sa description et ses colonnes ; un encadré « À savoir avant d'exporter » (données personnelles, aucun secret, Excel, volume). | ☐ | |
| 2 | **Refus aux autres** | Se connecter avec un autre rôle (Direction, RH, Responsable Investudy, chargé de compte). | Aucune entrée « Exports » dans le menu ; l'adresse `/admin/exports` dit « réservés au Super administrateur » ; l'API répond 403. | ☐ | |
| 3 | **Second facteur** | Attendre 10 minutes (ou ouvrir une nouvelle session), cliquer « Télécharger (CSV) ». | Une fenêtre redemande le code du second facteur ; après saisie, le téléchargement continue ; code erroné : message, rien n'est téléchargé. | ☐ | |
| 4 | **Utilisateurs** | « Télécharger (CSV) » sur Utilisateurs ; ouvrir le fichier dans Excel. | Nom `investally-utilisateurs-AAAA-MM-JJ_HHhMM.csv` ; accents lisibles ; une ligne par compte avec rôles (codes et libellés), responsable, second facteur, dernière connexion ; **aucune colonne de mot de passe, de secret ou de jeton**. | ☐ | |
| 5 | **Droits** | Télécharger « Droits ». | Une ligne par rôle et permission, avec le module, la ressource, l'action et la portée (Propre, Équipe, Tous) ; `iam.export.read` n'apparaît que pour SUPER_ADMIN. | ☐ | |
| 6 | **Sessions et période** | Choisir 7 jours puis 365 jours, télécharger « Sessions ». | Les connexions de la période : adresse IP, appareil, niveau de risque, état ou motif de fin (Active, Déconnexion, Révoquée : motif, Expirée) ; la période 7 jours contient moins de lignes que 365. | ☐ | |
| 7 | **Formule neutralisée** | Créer un compte dont le nom commence par `=` (par exemple `=1+1`), exporter les utilisateurs, ouvrir dans Excel. | La cellule affiche le texte tel quel (apostrophe en tête), **sans calcul**. | ☐ | |
| 8 | **Trace dans l'audit** | Après un export, consulter le journal d'audit. | Une ligne par export : auteur, session, adresse, nature (utilisateurs, droits, sessions), nombre de lignes, nom du fichier, période ; **le contenu du fichier n'y figure pas**. | ☐ | |
| 9 | **Message de succès** | Après un téléchargement. | « Le fichier … est enregistré. Cet export est tracé dans l'audit. » | ☐ | |
| 10 | **Bouton occupé** | Cliquer deux fois vite. | Les boutons sont désactivés pendant l'export (« Export en cours… ») : un seul téléchargement part. | ☐ | |

## Accessibilité
- ☐ Clavier seul : Tab et Maj+Tab parcourent les boutons et la liste « Période » dans un ordre logique ; focus toujours visible.
- ☐ Un seul titre de niveau 1 ; les trois cartes ont chacune un titre de niveau 2.
- ☐ Le message de succès est annoncé (`role=status`), une erreur aussi (`role=alert`).
- ☐ La fenêtre du second facteur : le focus entre dans la fenêtre, Échap la ferme.
- ☐ Lisible à 200 % de zoom et à 375 px de large (les cartes passent en colonne), sans défilement horizontal de la page.
- ☐ Le bouton occupé le dit en toutes lettres (« Export en cours… »), pas seulement par un changement de couleur.

## Tests automatisés qui couvrent cet écran
- API : `admin-exports-http.integration` (trois exports, en-têtes sûrs, aucun secret, formule neutralisée, compte supprimé exclu, période, refus de tout autre rôle, step-up, trace), `admin-exports.spec` et `csv.spec`, matrice de droits `rbac-http`, contrat anti-IDOR (classe « admin »)
- Web : `lot-c-exports` (types et en-têtes d'accord avec le serveur, périodes, adresse, nom de fichier, menu réservé au Super administrateur) ; mutants de Lot C ; audit navigateur : non rejoué

## Limites connues
- CSV seulement ; pas d'export des tentatives de connexion échouées ni du journal d'audit (D178).
- Le fichier contient des adresses IP et des appareils : durée de conservation et base légale à fixer (D177).
- Export refusé au-delà de 10 000 utilisateurs ou 50 000 sessions : réduire la période.

## Écarts constatés
| Date | Scénario | Description | Défaut ouvert (D…) |
|---|---|---|---|
| | | | |
