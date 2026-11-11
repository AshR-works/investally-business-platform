# Fiche de test — Lot C — exports d'administration

| | |
|---|---|
| **Session** | `lot-c` |
| **Recette de référence** | [`SPRINT-LOT-C-RECETTE.md`](../../SPRINT-LOT-C-RECETTE.md) |
| **Étiquette** | `lot-c-validated` |
| **Contexte** | Décision D66, [ADR-0012](../../adr/0012-exports-d-administration-pour-les-audits.md) |
| **Écrans concernés** | [Exports d'administration](../interfaces/33-exports-d-administration.md) |

*Fiche de session de la [charte de tests](../../CHARTE-DE-TESTS.md), **dérivée de la recette** du lot : en cas de doute, la recette fait foi.*

## Avant de commencer
- Réinitialiser la pile (`node scripts/local-stack.mjs reset`, puis `--demo --rebuild`) ; comptes de démonstration (mots de passe dans le fichier local, jamais dans le dépôt).
- Rôles utiles : Super administrateur, Direction, RH, Responsable Investudy, chargé de compte.

## Vérifications à rejouer
| N° | Vérification | Résultat attendu (d'après la recette) | Constaté (✔ / ✘) | Date et initiales |
|---|---|---|---|---|
| 1 | Super administrateur seulement | Seul le Super administrateur a la permission `iam.export.read` ; tout autre rôle : 403 sur les trois routes, aucune entrée de menu | ☐ | |
| 2 | Second facteur récent | Sans second facteur vérifié : `MFA_REQUIRED` ; vérifié il y a plus de 10 minutes : `MFA_STEP_UP_REQUIRED` ; l'interface redemande le code | ☐ | |
| 3 | Trace avant remise | Chaque export écrit une ligne d'audit (auteur, session, adresse, nature, lignes, fichier, période) ; si la trace échoue, rien n'est remis ; un export refusé ne laisse pas de trace d'export | ☐ | |
| 4 | Aucun secret | Ni hachage de mot de passe, ni secret du second facteur, ni code de secours, ni jeton dans aucun fichier | ☐ | |
| 5 | Formules neutralisées | Un texte qui commence par `=`, `+`, `-`, `@`, tabulation ou retour chariot reçoit une apostrophe en tête | ☐ | |
| 6 | Contenu des trois exports | Utilisateurs (rôles, responsable, second facteur, connexion), droits (une ligne par rôle et permission, portée en français), sessions (adresse, appareil, risque, état ou motif de fin) | ☐ | |
| 7 | Période et volume | Sessions de 1 à 365 jours (90 par défaut) ; période hors bornes : 400 ; au-delà de 10 000 utilisateurs ou 50 000 sessions : refus, jamais de troncature | ☐ | |
| 8 | Comptes supprimés | Un compte supprimé logiquement n'est pas exporté | ☐ | |
| 9 | En-têtes de réponse | `text/csv`, téléchargement forcé, `no-store`, `nosniff`, `default-src 'none'`, marque d'ordre des octets, nom daté sans deux-points | ☐ | |
| 10 | Limites assumées | Données personnelles dans les sessions (D177) ; CSV seul, ni tentatives échouées ni audit (D178) | ☐ | |

## Écarts constatés
| Date | Vérification | Description | Défaut ouvert (D…) |
|---|---|---|---|
| | | | |
