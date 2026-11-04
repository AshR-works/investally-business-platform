# Fiche de test — Fiche d'une entreprise

| | |
|---|---|
| **Route** | `/companies/[id]` |
| **Livrée par** | S3.6, S4.0, S4.0c, S4.1a, S4.2a–d, S4.3a–c, S4.4a, S4.4a-bis |
| **Accès** | Utilisateur avec `bd.company.read` sur cette entreprise (hors portée : « introuvable »). |
| **Droits** | Voir chaque panneau : contacts, offres, opportunités, agréments, rendez-vous, documents. |
| **Rôles de test** | cc, rc, dir |

*Fiche d'interface de la [charte de tests](../../CHARTE-DE-TESTS.md). À rejouer à chaque changement de l'écran. Cocher, dater, signer ; tout écart devient un défaut.*

## Préconditions
Une entreprise avec un contact, une offre, une opportunité à l'accord de principe ; le compte du propriétaire et celui d'un collègue.

## Scénarios
| N° | Scénario | Étapes | Résultat attendu | Constaté (✔ / ✘) | Date et initiales |
|---|---|---|---|---|---|
| 1 | **Hors portée** | Ouvrir la fiche d'une entreprise d'un collègue (adresse directe). | « Entreprise introuvable » — même réponse qu'un identifiant inexistant. | ☐ | |
| 2 | **Identité et responsable** | Lire la fiche. | Statut, secteur, pays, e-mail, téléphone, date de création, **responsable** nommé. | ☐ | |
| 3 | **Modifier** | Cliquer « Modifier », changer un champ, enregistrer (puis refaire avec une version périmée). | Mise à jour ; conflit annoncé si quelqu'un a modifié entre-temps ; le propriétaire et le statut ne changent pas ici. | ☐ | |
| 4 | **Statut** | Cliquer « Marquer comme contactée », puis « Qualifier » (avec puis sans contact). | Un cran à la fois ; « Qualifiée » refusée sans contact ; retour d'un cran possible ; « Cliente » et « Archivée » jamais proposées. | ☐ | |
| 5 | **Changer de responsable** | Responsable commercial : « Changer de responsable », choisir, confirmer (code de vérification redemandé si le dernier a plus de 10 minutes). | Liste limitée à l'équipe ; case de confirmation obligatoire ; second facteur récent exigé (D41) ; l'ancien responsable perd la vue. | ☐ | |
| 6 | **Exporter la fiche** | Cliquer « Exporter la fiche ». | Document imprimable ne contenant que ce que vous voyez ; export tracé. | ☐ | |
| 7 | **Mise en relation** | Observer le panneau facilitateur / commission. | Facilitateur visible selon les droits ; commission visible du Responsable commercial et du chargé de compte. | ☐ | |
| 8 | **Contacts** | Créer, modifier un contact ; créer un doublon. | Doublon probable signalé avec la fiche existante proposée. | ☐ | |
| 9 | **Offres et décharge** | Créer une offre, la déposer, enregistrer la décharge avec un fichier. | Voir la fiche de l'écran Offres. | ☐ | |
| 10 | **Opportunités** | Lire le panneau. | Étape, montant, état, dérogation ; lecture seule ; lien vers le pipeline. | ☐ | |
| 11 | **Agrément** | Enregistrer un agrément (opportunité à l'accord de principe, montant, document signé). | Agrément « Reçu » listé ; l'entreprise devient « Cliente » ; expirer / annuler avec motif (Responsable commercial) ; honorer : Finance. | ☐ | |
| 12 | **Agrément demandé et payeur** | Enregistrer un agrément en cochant « La promesse n'est pas encore signée », avec un payeur tiers (nom et type) ; puis « Déclarer reçu » ; puis, avec un compte Finance, « Honorer ». | Agrément « Demandé » sans date ni fichier, payeur affiché ; l'entreprise devient « Cliente » à la réception ; seule la Finance honore (le Responsable commercial annule ou expire) ; nom sans type refusé. | ☐ | |
| 13 | **Rendez-vous** | Lire le panneau ; planifier depuis le bouton. | Rendez-vous des 60 derniers et 60 prochains jours ; planification préremplie. | ☐ | |
| 14 | **Documents** | Ajouter, télécharger, versionner, archiver un document. | Formats et tailles contrôlés ; fichier trompeur refusé ; visible dans la portée seulement. | ☐ | |
| 15 | **Entreprise archivée** | Ouvrir une entreprise archivée. | Lecture seule : plus de création ni de modification. | ☐ | |

## Accessibilité
- ☐ Clavier seul : Tab et Maj+Tab parcourent tous les contrôles dans un ordre logique ; le focus est toujours visible ; aucun piège de focus hors fenêtre modale.
- ☐ Un seul titre de niveau 1 ; pas de saut de niveau (h2 avant h3).
- ☐ Chaque champ a un libellé relié ; un champ non conforme est en surbrillance **et** accompagné d'un message écrit relié (`aria-describedby`), jamais la couleur seule ; le focus va au premier champ en erreur.
- ☐ Les messages d'état et d'erreur sont annoncés (`role=alert` ou `aria-live`).
- ☐ Fenêtres modales : le focus entre dans la fenêtre, Échap la ferme, le focus revient à l'élément d'origine, l'arrière-plan est inerte.
- ☐ Lisible à 200 % de zoom et à 375 px de large, sans défilement horizontal de la page.
- ☐ Chaque panneau a un titre de niveau 2 ; les menus d'actions des lignes ont un nom accessible (« Actions pour… »).

## Tests automatisés qui couvrent cet écran
- API : `company-edit-export.integration`, `company-lifecycle-http.integration`, `contacts-http.integration`, `offers-http.integration`, `receipts-http.integration`, `approvals-http.integration`, `documents.integration`, `idor-contract.integration`
- Web : `s50.test.ts`, `s51.test.ts`, `s52.test.ts`, `s43.test.ts`
- Audit navigateur : fiche 360°, statut, responsable, agrément (axe, 0 violation)

## Limites connues
- Fiche 360° en lecture sans chronologie (D103) ; pas de page « Agréments » transverse (D116).

## Écarts constatés
| Date | Scénario | Description | Défaut ouvert (D…) |
|---|---|---|---|
| | | | |
