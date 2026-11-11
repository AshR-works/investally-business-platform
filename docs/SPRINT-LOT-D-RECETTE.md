# Lot D — finitions d'interface (retours du test manuel, correctifs) : recette

*Branche `feat/lot-d-finitions-interface` · 2026-11-11 · retours de la Direction produit (« Attaques ces correctifs »), catégories **Défauts** et **Choix de design**. Les **fonctionnalités nouvelles** (contacts sur la fiche, recherche dans l'agenda, agréments et relances, gestion de l'agenda, sessions dans l'agenda, organigramme fonctionnel) sont **hors de ce lot** : elles attendent des décisions (arbitrage de l'agenda, sens de « fonctionnel »).*

## Ce qui est livré
| Retour | Réponse | Vérifié dans le navigateur |
|---|---|---|
| **Catalogue : « Nouveau certificat »**, libellé trop long | Le libellé « Ajouter un module » passe **au-dessus** de la liste, qui prend toute la largeur (le libellé n'était pas trop long : la liste en largeur automatique débordait et faisait apparaître une barre de défilement horizontale) | Oui : aucun débordement, liste à la largeur du formulaire |
| **Bouton « Télécharger »** écrasé (texte à la verticale) | Pictogramme de téléchargement **nommé** (« Télécharger <fichier> ») avec info-bulle, dans la liste des documents et dans l'historique des versions ; le bouton ne replie jamais son contenu | Oui : carré de 35 px à côté du menu « … » |
| **Changement de responsable : confirmation du code** | La fenêtre de confirmation (partagée par toutes les actions sensibles) reprend la fenêtre commune : en-tête, croix, marges ; saisie du code **comme à la connexion** (six cases) ou code de secours ; échec : le code est vidé et l'erreur affichée | Oui, de bout en bout : code saisi, l'action reprend sans ressaisie, le responsable change |
| **Bouton de statut** (« Revenir à … ») | Déplacé dans une rangée **alignée à droite** de la carte, sur le même bord que « Nouveau contact » ou « Enregistrer un agrément » | Oui |
| **En-tête de la fiche entreprise** | Déjà corrigé dans le lot A (titre et description sur toute la largeur, boutons dessous) ; la capture du test montrait une **version plus ancienne** de l'interface | Oui |
| **Fenêtres de consultation** : boutons sur une même ligne ; plus de « Fermer » ; « Modifier » en pictogramme avant la croix | Opportunité et rendez-vous : crayon nommé avant la croix, **les autres actions sur une seule ligne**, fenêtre un peu plus large ; « Fermer » retiré des cinq fenêtres qui le gardaient (opportunité, rendez-vous, documents d'offre, décharge, chargement de session) | Oui (opportunité et rendez-vous ; le crayon ouvre la modification) |

## Preuves
| Contrôle | Résultat |
|---|---|
| Types | `tsc` propre |
| Tests de l'interface | **783 réussis** (15 nouveaux dans `lot-d-finitions.test`) |
| Contrôle visuel | Pile jetable avec données de démonstration (compte Super administrateur, second facteur activé pour l'occasion) ; **pile supprimée** ensuite |

## À savoir
- **Non vérifié** : mode sombre, 1280 px, clavier, lecteur d'écran (les pictogrammes portent un nom accessible et une info-bulle, mais aucun passage au lecteur d'écran n'a eu lieu) ; fenêtre « Justificatif du versement » des commissions (même panneau de documents, non ouvert) ; décharge et documents d'offre (« Fermer » retiré, non ouverts).
- **Catalogue de captures** (`docs/design/screens/app/`) et journal de design : à mettre à jour ; ces fichiers sont dans l'extraction principale, modifiés par une autre session, ils n'ont pas été touchés ici.
- **Constat pour la suite** : la liste des contacts propose « Modifier » et **« Supprimer »** (pas « Archiver ») ; l'agenda a déjà la fiche d'un rendez-vous avec modifier, reporter, annuler (pas de suppression, voulu).
