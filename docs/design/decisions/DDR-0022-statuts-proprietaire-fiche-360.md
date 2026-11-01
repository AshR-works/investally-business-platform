# DDR-0022 — Entreprises : statuts manuels, changement de responsable, fiche 360°

| | |
|---|---|
| **Statut** | Acceptée (réalisée dans l'application) ; prototype à mettre à jour |
| **Date** | 2026-11-06 |
| **Version du design** | 0.4.1 (le prototype n'est pas encore à jour : version 0.5.0 à décider) |
| **Lié à** | Lot S4.3b ; cas d'usage CU-C-05 ; flux C5 ; décisions D17, D28, D37 |

## Contexte
Une entreprise naît « Cible » et reste « Cible » : rien ne permettait de dire qu'elle a été contactée ou qualifiée, ni de confier un portefeuille à un autre commercial quand quelqu'un part ou change d'équipe. La fiche de l'entreprise, elle, ne montrait ni ses opportunités ni ses rendez-vous. Ce lot ajoute les deux gestes manquants et complète la fiche. Les règles laissées « à trancher » (transitions, critères de « Qualifiée », retour en arrière, droit de réattribution) sont tranchées par défaut ; elles sont **à confirmer** (D37).

## Décisions
1. **Statut à la main, un cran à la fois** : Cible → Contactée → Qualifiée, et retour d'un cran (Qualifiée → Contactée → Cible). Pas de saut d'étape, pas de changement vers le même statut.
2. **« Cliente » et « Archivée » ne se posent jamais à la main** : « Cliente » viendra de l'agrément (S4.4, flux C5), « Archivée » de l'archivage (CU-C-06, Responsable commercial). Une entreprise archivée ou cliente n'a plus d'action de statut.
3. **« Qualifiée » exige au moins un contact** (non supprimé) : on ne qualifie pas une entreprise dont personne n'est joignable.
4. **Droit** : le changement de statut suit le droit de **modification** (`bd.company.update`), donc la même portée (Propre pour le chargé de compte, Équipe pour le Responsable commercial). Pas de droit dédié, pas de motif demandé.
5. **Changer de responsable (D17)** : droit **dédié** `bd.company.reassign` (Responsable commercial, portée Équipe ; administrateur). Le destinataire doit être un **utilisateur actif au rôle commercial** (chargé de compte, Responsable commercial, administrateur) **dans la portée de l'appelant** : un Responsable commercial ne confie qu'à son équipe. La fenêtre liste ces personnes (nom seulement, jamais d'e-mail) et exige une **confirmation explicite**.
6. **Ce qui suit l'entreprise** : sa portée de visibilité, donc ses contacts, offres, opportunités et rendez-vous. L'ancien responsable perd la vue immédiatement ; le nouveau la gagne. Le changement est tracé (ancien et nouveau responsable, session).
7. **Responsable visible** : la fiche et le tableau des entreprises nomment le responsable ; la colonne « Responsable » est affichée par défaut (masquable, comme les autres).
8. **Fiche 360°, en lecture** : la fiche de l'entreprise montre aussi ses **opportunités** (étape, montant, état, dérogation) et ses **rendez-vous** (60 derniers et 60 prochains jours). Les actions restent dans les modules concernés, qui contrôlent les droits.
9. **Répartition du lot** : la colonne « Valeur » du tableau et le lien entre un rendez-vous et une opportunité (D93) sont **reportés** à S4.3c (voir D104).

## Mesures de rigueur
- Les règles (transitions, contact exigé, même propriétaire, entreprise archivée) sont couvertes par des tests unitaires du domaine et des cas d'usage, et par des tests d'intégration de bout en bout (HTTP + PostgreSQL), dont la portée, les droits, l'audit et l'effet sur la visibilité.
- Le contrat anti-IDOR est étendu aux deux nouvelles routes « objet » ; la liste des destinataires ne révèle que la portée de l'appelant, sans e-mail.
- Les transitions de l'interface sont comparées au **domaine réel** du serveur.

## Conséquences
- Réversible : aucune migration (les colonnes statut et propriétaire existaient), deux routes, un port d'annuaire, deux fenêtres et deux panneaux.
- **Dette** : D100 à D105 (`docs/TECH-DEBT.md`).
