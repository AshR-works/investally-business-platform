# DDR-0020 — Agenda : rendez-vous et visites

| | |
|---|---|
| **Statut** | Acceptée (réalisée dans l'application) ; prototype à mettre à jour |
| **Date** | 2026-11-04 |
| **Version du design** | 0.4.1 (le prototype n'est pas encore à jour : version 0.5.0 à décider) |
| **Lié à** | Lot S4.2d ; wireframes 17 et 18 ; cas d'usage CU-C-30 à CU-C-33 ; flux C3 ; décisions D16, D35, D60 |

## Contexte
Un chargé de compte rencontre les DAF et les décideurs des entreprises, et reçoit certaines d'entre elles chez Investally. Sans agenda partagé avec le dossier de l'entreprise, ces rendez-vous vivent dans des carnets et des téléphones. Ce lot ajoute **l'agenda** : planifier un rendez-vous ou une visite, le consulter par jour, semaine ou mois, le reporter, le tenir (avec son compte rendu) ou l'annuler (avec son motif). Les règles laissées « à trancher » (conflit d'horaire, rappel, qui voit l'agenda de qui) sont appliquées par défaut, à confirmer (D35).

## Décisions
1. **Où** : une page « Agenda » (le module existait « à venir » sur le hub) ; trois vues **Jour**, **Semaine** (lundi au dimanche, par défaut) et **Mois** (grille de semaines entières), navigation précédent / aujourd'hui / suivant, filtre par type. L'action « Planifier un rendez-vous » est aussi dans le menu d'une offre en cours et sur la fiche de l'entreprise : l'entreprise (et l'offre) arrivent préremplies.
2. **Trois types** : rendez-vous avec le **DAF**, avec le **décideur**, **visite** chez Investally. Une visite relève du droit « visite », les deux autres du droit « rendez-vous ».
3. **Champs** : entreprise (obligatoire, non modifiable), contact (facultatif, **de la même entreprise**, sinon refus), offre liée (facultative, **de la même entreprise**), date et heure de début, durée (60 minutes proposées, de 15 minutes à 8 heures), lieu ou lien de visioconférence, note.
4. **Jamais dans le passé** : l'heure de début d'un nouveau rendez-vous, comme celle d'un report, doit être à venir.
5. **Conflit d'horaire : un avertissement, jamais un blocage.** Si l'organisateur a déjà un rendez-vous **à venir** qui chevauche le créneau (deux rendez-vous bout à bout ne se chevauchent pas), la réponse porte la liste des conflits et l'écran l'affiche après l'enregistrement. Un rendez-vous annulé ou tenu ne gêne plus. Seul l'agenda de l'organisateur est examiné (pas de salle, pas de participants multiples).
6. **Report** : nouvelle heure (à venir et différente) **et motif obligatoire** ; le rendez-vous reste « à venir », son nombre de reports et son dernier motif sont gardés. Le changement d'heure ne passe pas par la modification.
7. **Tenu** : **compte rendu obligatoire**, et seulement **une fois l'heure de début venue**. Un rendez-vous à venir dont l'heure est passée est signalé « **Compte rendu attendu** » (calculé à la lecture, jamais stocké).
8. **Annulé** : **motif obligatoire**, possible à tout moment. Tenu et annulé sont **définitifs**.
9. **Qui voit quoi (D60)** : la visibilité d'un rendez-vous suit celle de **son entreprise** (comme les offres et les relances) : le chargé de compte voit les siens, le Responsable commercial ceux de son équipe, la Direction tout, en lecture seule. Les visites ne sont listées que pour qui a le droit de lire les visites. Un rendez-vous hors portée est **introuvable**, identique à un rendez-vous inexistant. Le conflit d'horaire ne regarde que l'agenda de l'organisateur.
10. **Fenêtre d'agenda** : début inclus, fin exclue, **63 jours au plus** (de quoi couvrir un mois en grille de six semaines) ; l'écran calcule la fenêtre en minuit **local** du navigateur.
11. **Entreprise archivée** : plus de planification, de modification, de report, de tenue ni d'annulation ; les rendez-vous restent lisibles.
12. **Pas de rappel envoyé** : le signal « Compte rendu attendu » et la vue du jour sont les seuls rappels, tant que l'envoi d'e-mails n'existe pas (D85).

## Mesures de rigueur
- La base garantit : durée de 15 à 480 minutes, un rendez-vous à venir n'est pas clos, un rendez-vous clos a sa date **et** son compte rendu ou motif ensemble, version positive, compteur de reports positif, contact et offre existants ; vérifié par des écritures directes refusées.
- Les règles (heure à venir, report, tenue, chevauchement, droits par type, portée, conflits) sont couvertes par des tests unitaires et d'intégration ; des fautes injectées sont toutes détectées (voir la recette).
- Les mêmes règles de saisie sont comparées entre l'interface et le **domaine réel** du serveur.
- Le contrat anti-IDOR est étendu aux sept nouvelles routes ; le rendez-vous d'un collègue n'est ni lisible, ni modifiable, ni reportable, ni tenable, ni annulable (même réponse que pour un objet inexistant).

## Conséquences
- Réversible : une migration (une table), un module, trois composants et une page.
- **Dette** : D85 à D92 (`docs/TECH-DEBT.md`).
