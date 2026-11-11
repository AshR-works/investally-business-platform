# RH-2c — absences et congés (recette, mutants, fiches de test) : recette

*Branche `sprint/rh-2c-recette` · 2026-11-11 · décision D64, cadrage [CADRAGE-RH-COMPLETE](cadrages/CADRAGE-RH-COMPLETE.md), suite de [RH-2a](SPRINT-RH-2A-RECETTE.md) et [RH-2b](SPRINT-RH-2B-RECETTE.md) · **aucun changement de comportement** : ce lot éprouve ce qui est livré.*

## Ce qui est livré
| Demande | Réponse |
|---|---|
| **Mutants de l'interface** | `scripts/mutants/rh2b-conges-ecrans.py` : **109 fautes plausibles** dans la logique des écrans de congés (`lib/leave.ts`) et dans les entrées de menu (`lib/modules.ts`) : formats de date, durées, calendrier et demi-journées, validation de la demande, de l'ajustement, des règles, des types et des jours fériés, annulation, états, filtres, droits des onglets et du menu |
| **Tests ajoutés** | `test/leave.test.ts` passe de 20 à **48 tests** : un test par survivant, avec les **bornes** (500 caractères, 60 jours, 5 jours par mois, 0,5 et 365 jours de plafond, 10 000 d'ordre, 30 caractères de code) et les **messages exacts** ; un test d'accord entre les onglets (`LEAVE_PAGES`) et le menu (`MODULES`) : même chemin, même droit, même portée |
| **Fiches de test** | **Cinq fiches d'écran** (28 à 32 : Mes absences, Absences à valider, Calendrier d'équipe, Soldes de congé, Paramètres des congés) et la **fiche de session RH-2** (12 vérifications), au format de la charte de tests ; index `docs/tests/README.md` mis à jour (32 écrans, 37 sessions) |

## Preuves
| Contrôle | Résultat |
|---|---|
| Mutants de l'interface | **109 sur 109 tués**. Premier passage : 59 sur 110, **51 survivants**, tous rejoués et tués après ajout de tests ; un mutant (**A19**, remplissage à deux chiffres de la fin de mois) est **équivalent** — une fin de mois fait toujours au moins 28 jours, le remplissage est sans effet — et a été retiré |
| Tests de l'interface | `tsc` propre ; **750 tests réussis** (38 fichiers), dont 48 pour les congés |
| Contrôle des anomalies d'outillage | Une première passe a été **corrompue** par deux exécutions simultanées des mutants (résultats « motif introuvable ») ; elle a été **arrêtée, les sources restaurées depuis Git, et rejouée une seule fois** : seul le bilan de cette passe fait foi |

## Ce que ces mutants révèlent
Les 51 survivants du premier passage étaient presque tous des **bornes et des messages**, pas des erreurs de logique : un test qui vérifiait « un message existe » laissait passer un message faux, un test d'un cas valide laissait passer une limite décalée d'un cran. Les règles de menu et de portée (« les soldes ne sont réservés qu'à la portée Tous ») n'étaient testées que pour un profil sans droit de gestion : aucun test n'essayait quelqu'un qui gère en portée Propre.

## Ce qui n'est pas fait (à dire clairement)
- **Aucun audit d'accessibilité dans un navigateur (axe)** des cinq écrans : seul un contrôle visuel de RH-2b a eu lieu. Les cases d'accessibilité des fiches de test sont **à cocher** par la personne qui les rejoue. À planifier (le script `scripts/a11y-audit.mjs` n'a pas non plus de parcours pour les écrans de personnel).
- **Aucun test d'interface automatisé au niveau des composants** : l'interface n'a pas de bibliothèque de test de composants ; les pages, boîtes de dialogue et le tableau du calendrier ne sont couverts que par la logique de `lib/leave.ts`, les tests de l'API et le contrôle visuel. Les mutants ne portent donc **pas** sur les fichiers `.tsx`.
- **Mode sombre, 1280 et 1920 px, parcours au clavier** : toujours à contrôler (comme pour le Lot A et RH-2b).
- **Mutants de l'API** : déjà faits pour RH-2a (126 sur 126) ; le défaut du solde corrigé dans RH-2b n'y avait pas été détecté ; son mutant n'a pas été ajouté à `rh2a-conges.py` dans ce lot.

## Comment vérifier
1. Rejouer les mutants : `python scripts/mutants/rh2b-conges-ecrans.py` (environ 12 minutes ; `DRY=1` vérifie seulement les motifs). **Ne jamais lancer deux exécutions à la fois** : le script modifie les fichiers puis les restaure.
2. Rejouer les fiches `docs/tests/interfaces/28…32` et la fiche de session `docs/tests/sessions/rh-2.md` avec le jeu de démonstration (`node scripts/local-stack.mjs --demo`).
