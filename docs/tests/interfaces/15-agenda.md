# Fiche de test — Agenda (rendez-vous et visites)

| | |
|---|---|
| **Route** | `/agenda` |
| **Livrée par** | S4.2d, S4.3c |
| **Accès** | Utilisateur avec `bd.appointment.read` (visites : `bd.visit.read`). |
| **Droits** | Chargé de compte (Propre), Responsable commercial (Équipe), Direction (lecture). |
| **Rôles de test** | cc, rc, dir |

*Fiche d'interface de la [charte de tests](../../CHARTE-DE-TESTS.md). À rejouer à chaque changement de l'écran. Cocher, dater, signer ; tout écart devient un défaut.*

## Préconditions
Une entreprise avec un contact, une offre et une opportunité ouverte.

## Scénarios
| N° | Scénario | Étapes | Résultat attendu | Constaté (✔ / ✘) | Date et initiales |
|---|---|---|---|---|---|
| 1 | **Vues** | Passer de Jour à Semaine à Mois ; naviguer précédent / aujourd'hui / suivant. | Semaine du lundi au dimanche par défaut ; mois en grille de semaines entières. | ☐ | |
| 2 | **Planifier** | Nouveau rendez-vous : type, entreprise, contact, offre, opportunité, date, heure, durée, lieu. | Proposé : demain 9 h, 60 minutes, type DAF ; jamais dans le passé. | ☐ | |
| 3 | **Opportunité liée** | Choisir l'opportunité d'un rendez-vous décideur. | Seules les opportunités ouvertes de l'entreprise sont proposées ; le lien est rappelé dans la fiche. | ☐ | |
| 4 | **Conflit d'horaire** | Planifier deux rendez-vous qui se chevauchent. | Avertissement (jamais un blocage) citant le rendez-vous en conflit ; bout à bout = pas de conflit. | ☐ | |
| 5 | **Reporter** | Reporter avec une nouvelle heure et un motif. | Motif obligatoire ; le rendez-vous reste « À venir » ; report compté. | ☐ | |
| 6 | **Tenir** | Marquer tenu avant puis après l'heure. | Refusé avant l'heure ; après : compte rendu obligatoire ; « Compte rendu attendu » signalé. | ☐ | |
| 7 | **Annuler** | Annuler avec un motif. | Définitif ; motif obligatoire. | ☐ | |
| 8 | **Visite** | Planifier une visite chez Investally. | Exige le droit « visite ». | ☐ | |
| 9 | **Filtre par type** | Filtrer DAF / décideur / visite. | Résultats exacts. | ☐ | |
| 10 | **Portée** | Se connecter avec un collègue. | Aucun rendez-vous d'une entreprise hors portée. | ☐ | |

## Accessibilité
- ☐ Clavier seul : Tab et Maj+Tab parcourent tous les contrôles dans un ordre logique ; le focus est toujours visible ; aucun piège de focus hors fenêtre modale.
- ☐ Un seul titre de niveau 1 ; pas de saut de niveau (h2 avant h3).
- ☐ Chaque champ a un libellé relié ; un champ non conforme est en surbrillance **et** accompagné d'un message écrit relié (`aria-describedby`), jamais la couleur seule ; le focus va au premier champ en erreur.
- ☐ Les messages d'état et d'erreur sont annoncés (`role=alert` ou `aria-live`).
- ☐ Fenêtres modales : le focus entre dans la fenêtre, Échap la ferme, le focus revient à l'élément d'origine, l'arrière-plan est inerte.
- ☐ Lisible à 200 % de zoom et à 375 px de large, sans défilement horizontal de la page.
- ☐ La vue mois est un tableau de semaines entières (jours nommés pour les lecteurs d'écran).

## Tests automatisés qui couvrent cet écran
- API : `appointments-http.integration`, `idor-contract.integration`
- Web : `s48.test.ts`, `s51.test.ts`
- Mutants : S4.2d, S4.3c

## Limites connues
- Aucun rappel envoyé ; pas de synchronisation Outlook (D88) ; heures dans le fuseau du navigateur (D87) ; vue mois lourde pour l'audit navigateur.

## Écarts constatés
| Date | Scénario | Description | Défaut ouvert (D…) |
|---|---|---|---|
| | | | |
