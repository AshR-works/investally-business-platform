# DDR-0014 — Modifier une fiche d'entreprise ; exporter une fiche (qui voit exporte, chaque export est tracé)

| | |
|---|---|
| **Statut** | Acceptée (réalisée dans l'application) ; prototype à mettre à jour |
| **Date** | 2026-10-30 |
| **Version du design** | 0.4.1 (le prototype n'est pas encore à jour : version 0.5.0 à décider) |
| **Lié à** | Demande de la direction produit du 2026-10-30 ; règle d'export énoncée le 2026-10-29 ; décision D26 |

## Contexte
La fiche d'entreprise n'avait ni bouton « Modifier » ni export. La direction produit a posé la règle : **qui peut voir une vue peut en exporter les données, dans sa portée, et chaque export est tracé** ; le DG et la DGA (accès Super administrateur) exportent sur toutes les vues ; le chargé de compte sur son interface dédiée ; les vues partagées (rapports des employés, agendas) suivent une règle d'audience, à traiter avec leurs écrans.

## Décisions
1. **Bouton « Modifier »** sur la fiche, pour qui détient `bd.company.update` ; il rouvre la fenêtre de création, préremplie. Modifiables : nom, secteur, pays, e-mail, téléphone, mise en relation (facilitateur, méthode, appartenance, commission). **Jamais** le propriétaire, le statut ni l'identifiant (refusés par la validation). Une entreprise archivée ne se modifie plus.
2. **Verrou optimiste** : la fiche porte son numéro de version ; une modification faite sur une version périmée est refusée (409) au lieu d'écraser le travail d'un autre.
3. **Commission** : seul le détenteur de `bd.commission.manage` la définit, la change ou la retire (ainsi que le lien qui la porte). Une modification faite par quelqu'un d'autre (chargé de compte) **conserve** la commission existante : une clé absente veut dire « inchangé », jamais « effacé ». Si le facilitateur de la fiche n'est pas visible avec les droits de l'utilisateur, la mise en relation est verrouillée (note à l'écran).
4. **Audit** : la modification trace l'ancienne et la nouvelle valeur (commission comprise, lisible des seuls détenteurs de `audit.log.read`).
5. **Bouton « Exporter la fiche »** pour qui peut voir l'entreprise (règle : lecture = export, dans la portée). Hors portée : « introuvable », sans trace. Le document **ne contient que ce que l'utilisateur voit** (facilitateur et commission selon ses droits). Chaque export écrit une trace (EXPORT, session, adresse, appareil) **avant** la remise du document ; la trace décrit ce qui a été remis, sans recopier les données.
6. **Format provisoire** : document HTML autonome et mis en page (gabarit aux couleurs de l'application), ouvert dans une nouvelle fenêtre pour impression ou enregistrement en PDF par le navigateur. Aucune dépendance ajoutée. Le gabarit sera remplacé par celui de la charte des documents sans toucher aux droits, à l'audit ni aux données.
7. **Sécurité du document** : tout texte saisi est échappé ; le document n'a ni script, ni ressource externe, ni lien ; il est servi avec une politique de contenu restrictive (`default-src 'none'`), `nosniff` et sans mise en cache.

## Ce qui n'est pas décidé ici
- **Export d'une liste entière** (option C de l'arbitrage : lecture = export, avec confirmation récente de la double authentification) : non réalisé (D59).
- **Vues partagées** (audience plutôt que portée) : à traiter avec l'agenda et les rapports (D60).
- **PDF produit par le serveur** : demande d'ajouter une bibliothèque, à décider (D61).

## Conséquences
- Réversible : une route, un cas d'usage, un gabarit, une fenêtre réutilisée. Aucune migration, aucune permission nouvelle.
- **Dette** : D58 à D61 (`docs/TECH-DEBT.md`) ; prototype à mettre à jour (D49).
