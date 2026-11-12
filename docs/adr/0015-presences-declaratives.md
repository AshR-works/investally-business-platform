# ADR-0015 — Présences déclaratives du personnel

| | |
|---|---|
| **Statut** | Accepté (2026-11-12, décision D69 de la Direction produit : « Lançons RH-4 », puis **option B** — présences déclaratives ; valeurs de départ « à confirmer »). |
| **Contexte** | Le cadrage RH (CADRAGE-RH-COMPLETE) classait RH-4 « Présences » comme **non recommandé** : un pointage (heures, retards) est de la **surveillance des salariés**, sensibilité élevée, avis juridique et besoin réel à confirmer. La Direction produit a décidé de lancer RH-4 avec un périmètre **réduit à une déclaration**, sans pointage. |
| **Lié à** | ADR-0009 (RH sans donnée sensible), ADR-0013 (contrats), D57, D58, D64, D69 ; DEC-006 (avis juridique) |

## Options considérées
1. **Statu quo** : pas de présence dans le CRM. Le calendrier des absences (RH-2) dit qui est absent, pas qui est sur site ou en télétravail.
2. **Présences en session de formation** (feuille de présence des apprenants et du formateur) : un besoin réel, mais c'est le module Formation (dette D142), pas la RH du personnel.
3. **Présences déclaratives (retenue)** : l'employé dit, pour un jour, s'il est sur site, en télétravail ou en déplacement.
4. **Pointage complet** (entrée et sortie horodatées, retards, heures) : valeur maximale, risque juridique élevé (surveillance, durée de conservation) ; exige l'avis juridique. Écartée.

## Décision
- **Une valeur parmi trois par employé et par jour** : *Sur site*, *Télétravail*, *Déplacement* (`hr.presence_declarations`, au plus une ligne par employé et par jour, **garanti par la base**). **Aucune heure, aucun lieu, aucun retard, aucun texte libre.** Le modèle est incapable de stocker de la surveillance : pas de colonne pour cela.
- **Qui saisit** : l'employé pour lui-même (droit `hr.presence.declare` en portée Propre) ; la RH et le Super administrateur pour n'importe qui (portée Tous), la saisie étant marquée « par un autre ». Un employé ne peut pas déclarer pour un collègue, ni pour un subordonné : l'employé visé est alors « introuvable » (même réponse qu'un employé inexistant, comme pour les absences).
- **Fenêtre de saisie** : l'employé corrige jusqu'à **7 jours en arrière** et planifie jusqu'à **30 jours en avant** ; la RH a **90 jours** de part et d'autre. Jamais avant l'entrée ni après le départ de l'employé ; jamais pour un employé archivé. Valeurs « à confirmer ».
- **Cohérence avec les absences (RH-2)** : une absence **validée** couvrant la **journée entière** interdit la déclaration ; une demi-journée d'absence laisse déclarer l'autre moitié ; une demande en attente ne bloque pas.
- **Idempotent** : redéclarer le même mode ne change rien et n'écrit rien dans le journal d'audit ; changer le mode écrit l'avant et l'après ; retirer une déclaration écrit l'ancienne valeur.
- **Lecture** (`hr.presence.read`) : la RH, la Direction et le Super administrateur voient **tout le personnel en poste** (filtrable par service) ; les autres voient **leur ligne et celles de leurs subordonnés directs** de l'organigramme (D58), comme pour la validation des absences. Un collègue sans lien hiérarchique ne voit rien de plus que sa ligne. Le tableau (une période de 93 jours au plus) joint les **jours d'absence validée** pour qu'on distingue « absent » de « non déclaré ».
- **Routes** : `GET /hr/presences?from&to[&department]` (tableau), `PUT /hr/presences/:day[?employeeId]` (déclarer ou changer, idempotent), `DELETE /hr/presences/:day[?employeeId]`. Sans `employeeId`, c'est l'employé du compte connecté ; un compte sans fiche reçoit un message clair (« demandez à la RH de la relier »).
- **Aucun verrou optimiste** : une seule valeur par jour, sans règle qui dépende d'une lecture préalable ; la dernière saisie gagne, et le journal d'audit garde l'historique. Deux saisies simultanées du même jour par deux personnes différentes se résolvent par l'unicité de la base (conflit 409 pour la seconde).

## Conséquences
- **Aucune extension vers le pointage sans nouvelle décision** : ajouter une heure, un lieu, un retard ou un rapport de présence changerait la nature de la donnée (surveillance) ; il faudrait l'avis juridique (DEC-006) et une nouvelle décision. La structure de la table ne le permet pas aujourd'hui, volontairement.
- **Nouvelles permissions** `hr.presence.read` et `hr.presence.declare` (catalogue, matrice, documentation des droits régénérée).
- **Dettes** D185 à D189 (voir [TECH-DEBT](../TECH-DEBT.md)) : pas de validation par le responsable, fenêtres et valeurs de départ à confirmer, week-ends et jours fériés non contrôlés, conservation non définie, lecture limitée aux subordonnés directs.
- **Réversibilité** : forte. La table est isolée dans le contexte `hr`, sans clé vers un autre contexte ; la supprimer ne touche à rien d'autre.
