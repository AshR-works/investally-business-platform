# Rapports journaliers du développement

*Objectif : pouvoir retracer, des années plus tard, **ce qui** a été développé, **quand**, **par qui**, **pourquoi** et **dans quelle version**. La source de vérité est l'historique Git ; les rapports le rendent lisible pour des développeurs, des architectes et des décideurs.*

## 1. En bref

| Je veux… | Commande |
|---|---|
| Clôturer la journée (rapport + HTML + PDF + changelog + tableaux de bord) | `pnpm report:close` |
| Créer ou rafraîchir le rapport du jour (Markdown seulement) | `pnpm report new` |
| Produire le HTML (et le PDF) d'un jour | `pnpm report build --date 2026-10-22 --pdf` |
| Reconstituer des jours passés depuis Git | `pnpm report backfill --from 2026-10-20 --to 2026-10-22` |
| Contrôler tous les rapports | `pnpm report check` |
| Tester le système lui-même | `pnpm test:scripts` |

**Le HTML est le format de référence** (toujours produit, lisible partout, imprimable en PDF). Le PDF est un plus : il est produit avec Edge ou Chrome sans fenêtre quand l'un des deux est installé, sinon seul le HTML est généré, sans erreur.

## 2. Arborescence

```
docs/daily-reports/
├── README.md                      ce guide
├── templates/
│   ├── daily-report-template.md   le gabarit (SOURCE de la structure de tous les rapports)
│   ├── daily-report-template.html gabarit rendu (aperçu de la mise en page)
│   └── daily-report-template.pdf  gabarit rendu en PDF
├── 2026/
│   ├── 01-Janvier … 12-Décembre   un dossier par mois (créés automatiquement chaque année)
│   │   └── 2026-10-22.md / .html / .pdf
├── changelog/
│   ├── CHANGELOG.md  .html        Ajouts, Modifications, Corrections, Sécurité, par jour
│   └── RELEASES.md   .html        étiquettes Git : sessions validées, versions du design
└── dashboards/
    ├── weekly-summary.md          dernière synthèse hebdomadaire   (archives : weekly/AAAA-Www.md)
    ├── monthly-summary.md         dernière synthèse mensuelle      (archives : monthly/AAAA-MM.md)
    └── project-health.md          santé du projet
scripts/daily-report.mjs           le générateur (aucune dépendance)
scripts/daily-report.test.mjs      ses tests
```

## 3. Conventions de nommage

| Élément | Règle | Exemple |
|---|---|---|
| Rapport | `AAAA-MM-JJ` + extension, dans `AAAA/MM-Mois/` | `2026/10-Octobre/2026-10-09.md` |
| Mois | numéro à 2 chiffres, tiret, nom français avec accents | `08-Août`, `12-Décembre` |
| Trois formats | même nom, extensions `.md`, `.html`, `.pdf` | `2026-10-09.md/.html/.pdf` |
| Semaine | ISO 8601, `AAAA-Www` | `weekly/2026-W43.md` |
| Mois (synthèse) | `AAAA-MM` | `monthly/2026-10.md` |
| Date | fuseau du projet **Africa/Douala (UTC+1)**, jamais UTC | un commit à 23 h 30 UTC appartient au jour suivant |
| Statut | `draft` (brouillon) ou `final` (relu) | en-tête `status:` |
| Origine | `direct` (rédigé au fil de l'eau) ou `reconstitué depuis Git` | en-tête `origin:` |

## 4. Contenu d'un rapport

Chaque rapport suit le gabarit `templates/daily-report-template.md` : informations générales (date, auteur, sprint, version, branche Git), résumé exécutif, indicateurs, réalisations, travaux UX/UI, backend, frontend, correctifs, décisions techniques, commits Git (hash, titre, description), fichiers modifiés (nouveaux, modifiés, supprimés), risques et points bloquants, actions du lendemain, changelog du jour.

Deux sortes de blocs, repérés par des commentaires HTML invisibles :

- **`<!-- auto:nom -->`** : calculés depuis Git (commits, fichiers, étiquettes, modules, écrans, décisions datées). **Régénérés à chaque exécution : ne pas les modifier.**
- **`<!-- manual:nom -->`** : écrits par l'auteur (résumé, compléments, risques, actions). **Jamais écrasés**, même si le rapport est rafraîchi plusieurs fois.

Les champs `sprint`, `version` et `branch` de l'en-tête viennent de Git : la dernière étiquette atteinte ce jour-là, la version du design et celle de l'application à la fin de la journée, la branche portant le plus de commits.

## 5. Règles de génération

1. **Un rapport par jour calendaire** (fuseau du projet), créé ou rafraîchi par `report new` / `report close`. Un jour sans commit peut avoir un rapport (réunion, décision, recette) : le résumé automatique le dit.
2. **Idempotent** : relancer la commande le même jour met à jour les blocs automatiques, laisse les blocs manuels intacts.
3. **Reconstitution** : `backfill` crée les jours passés à partir de l'historique, marqués `origin: reconstitué depuis Git` et `status: draft`.
4. **Brouillon puis final** : un rapport est `draft` tant qu'il contient `_À compléter._` ou le résumé « brouillon automatique ». `report close --final` le passe en `final` ; `report check` refuse un `final` incomplet.
5. **Branche d'un commit** : la plus proche branche `sprint/*`, `design/*` ou `main` qui le contient ; une fusion appartient à `main`. C'est une approximation (documentée), pas une preuve.
6. **Changelog** : `Sécurité` > `Corrections` > `Ajouts` > `Modifications`, déduit du message du commit (mots-clés) puis corrigé à la main dans le bloc « Compléments » du rapport ; `CHANGELOG.md` est **entièrement régénéré** à partir des rapports (ne jamais l'éditer à la main : corriger le rapport du jour).
7. **Étiquettes** : `RELEASES.md` liste toutes les étiquettes Git. Une étiquette `…-validated` n'est posée qu'après l'accord explicite de la direction produit.
8. **Produits dérivés** : le HTML et le PDF sont toujours reconstruits depuis le Markdown ; on ne les édite pas.
9. **Pas de nouveau modèle sans version** : tout changement de structure du gabarit s'accompagne d'une incrémentation de `template:` (en-tête) et d'une ligne dans cette section.

## 6. Règles de confidentialité (le dépôt est public)

- **Aucun secret** (clé, jeton, mot de passe, URL privée), **aucune adresse e-mail**, **aucun chemin local personnel**.
- **Aucun détail exploitable d'une faille non corrigée** : écrire « faiblesse connue D47, voir TECH-DEBT » et non le mode opératoire.
- Les noms d'auteur sont ceux de Git ; les adresses ne sont jamais reprises. `report check` signale toute adresse e-mail trouvée.
- Les contenus des messages de commit sont affichés tels quels après échappement : aucun script ne peut s'exécuter dans les pages HTML.

## 7. Pérennité (plusieurs années)

- Les dossiers de l'année suivante se créent seuls. Aucun fichier n'est jamais renommé : le chemin d'un rapport est stable et peut être cité dans un ticket ou un ADR.
- **Volume mesuré** (3 jours de reconstitution, journées très chargées de 23 à 29 commits) : Markdown et HTML de 100 à 300 Ko par jour, PDF de **0,5 à 0,75 Mo** (15 à 19 pages). Une journée ordinaire sera nettement plus légère, mais prévoyez **de l'ordre de 50 à 100 Mo par an** si l'on versionne les PDF. Recommandation : versionner Markdown et HTML (texte, bien compressé par Git), et dès la deuxième année conserver les PDF hors Git (pièces jointes de versions GitHub) ou activer Git LFS pour `docs/daily-reports/**/*.pdf`.
- Le Markdown reste lisible sans outil. Le gabarit est versionné (`template:`), ce qui permet de faire évoluer la structure sans casser les anciens rapports : le générateur ne relit que les blocs `manual:` des anciens fichiers.
- Les tableaux de bord et le changelog se reconstruisent à tout moment depuis les rapports et Git : en cas de perte, `backfill` puis `changelog` puis `summary` retrouvent l'essentiel.

## 8. Automatisation future

| Étape | Recommandation | Effort |
|---|---|---|
| **Maintenant** | `pnpm report:close` en fin de journée ; `pnpm report check` et `pnpm test:scripts` déjà exécutés par la CI | fait |
| **Rappel** | Hook Git `pre-push` (ou tâche planifiée Windows à 18 h) qui lance `pnpm report new` et affiche les sections à compléter | ½ jour |
| **Génération nocturne** | Workflow GitHub Actions planifié (cron) : lance `report close`, puis ouvre une **demande de fusion** (la branche `main` est protégée) avec `gh pr create`. Permissions du workflow : `contents: write`, `pull-requests: write` ; autoriser Actions à créer des demandes de fusion dans les réglages | 1 jour |
| **PDF en CI** | Installer Chromium sur le runner et définir `PDF_NO_SANDBOX=1` (conteneur) ; publier les PDF en pièces jointes plutôt qu'en les versionnant | ½ jour |
| **Aide à la rédaction** | Pré-remplir les blocs manuels (résumé, risques) avec l'assistant à partir des commits, **relus par l'auteur avant `final`** | 1 jour |
| **Indicateurs** | Ajouter aux tableaux de bord l'état de la CI (`gh run list`), le nombre de tests (lu dans les recettes) et le délai de revue des demandes de fusion | 1 jour |
| **Publication** | Générer un site statique (GitHub Pages) à partir des HTML pour que la direction consulte sans cloner le dépôt | ½ jour |

## 9. Limites connues

- La numérotation des pages du PDF repose sur le CSS d'impression (`@page`) d'Edge/Chrome récents ; le rendu n'a pas pu être contrôlé visuellement par l'outil qui a écrit ce système. Le HTML est le format de référence.
- Les listes imbriquées sont limitées à deux niveaux dans le rendu HTML.
- Le classement du changelog est une heuristique sur le message du commit ; il se corrige dans le rapport.
- L'attribution d'un commit à une branche est approximative (règle 5).
