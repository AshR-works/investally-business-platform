# DDR-0019 — Relances des offres

| | |
|---|---|
| **Statut** | Acceptée (réalisée dans l'application) ; prototype à mettre à jour |
| **Date** | 2026-11-03 |
| **Version du design** | 0.4.1 (le prototype n'est pas encore à jour : version 0.5.0 à décider) |
| **Lié à** | Lot S4.2c ; wireframes 13 et 16 ; cas d'usage CU-C-22 ; flux C2 ; décision D34 |

## Contexte
Une offre déposée attend la réponse du client. Sans rappel, elle s'oublie. Ce lot permet de **planifier des relances**, de les retrouver dans une liste « À faire » triée par échéance, de les terminer avec leur résultat, et de ne plus en avoir quand l'offre a reçu une réponse. Les valeurs proposées (délai de 7 jours, trois relances au plus) étaient « à trancher » : elles sont appliquées par défaut, à confirmer (D34).

## Décisions
1. **Où** : une page « Relances » (nouveau module de la navigation) ; l'action « Relances » du menu d'une offre y mène, déjà filtrée sur l'offre ; une colonne « Prochaine relance » dans la liste des offres et le panneau de la fiche entreprise.
2. **Champs** : offre (obligatoire, non modifiable), échéance, canal (Appel, E-mail, WhatsApp, Rencontre, Autre), note facultative. L'échéance est proposée à **sept jours**.
3. **Seulement sur une offre en cours** : déposée ou décharge reçue. Plus de relance sur un brouillon, ni après la réponse du client ou le retrait de l'offre.
4. **Au plus trois relances par offre** (à faire ou terminées ; une relance annulée libère une place).
5. **Échéance** : jamais dans le passé à la planification. Une relance dont l'échéance est dépassée est signalée « **En retard** » (calculé à la lecture, jamais stocké) ; elle peut rester telle quelle à la modification, mais une nouvelle échéance ne peut pas être passée.
6. **Terminer** : le **résultat est obligatoire** (ce qui s'est dit ou décidé). **Annuler** : le **motif est obligatoire**. Terminée et annulée sont **définitives** ; l'historique reste visible dans les filtres « Terminées » et « Annulées ».
7. **Avec l'offre** : quand l'offre est **acceptée, refusée ou retirée**, ses relances encore à faire sont **annulées automatiquement**, avec un motif écrit et une trace d'audit par relance, dans la même transaction.
8. **Droits** : lire, planifier, modifier, terminer : chargé de compte (Propre), Responsable commercial (Équipe) ; lecture seule pour la Direction ; terminer exige le droit « terminer », annuler le droit de modifier ; hors portée, « introuvable ».
9. **Entreprise archivée** : plus de planification, de modification ni de clôture ; les relances restent lisibles.
10. **Planification non automatique** : le cas d'usage évoquait une planification automatique après le dépôt ; elle n'est **pas** retenue pour ne pas créer de données que l'utilisateur n'a pas demandées. Le délai de sept jours est proposé dans le formulaire (D80, à confirmer).

## Mesures de rigueur
- La base garantit : une relance à faire n'est pas close, une relance close a sa date et son texte (résultat ou motif) **ensemble**, version positive ; vérifié par des écritures directes refusées.
- La limite de trois, le retard, l'annulation automatique et la portée sont couverts par des tests unitaires et d'intégration ; 15 fautes injectées sont toutes détectées.
- Les mêmes règles de saisie sont comparées entre l'interface et le **domaine réel** du serveur.
- Le contrat anti-IDOR est étendu aux six nouvelles routes ; la relance d'un collègue n'est ni lisible, ni modifiable, ni terminable, ni annulable (même réponse que pour un objet inexistant).

## Conséquences
- Réversible : une migration (une table), un module, trois composants et une page.
- **Dette** : D80 à D84 (`docs/TECH-DEBT.md`).
