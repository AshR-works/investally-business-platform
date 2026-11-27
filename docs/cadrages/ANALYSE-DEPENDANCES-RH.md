# Analyse — dépendances du module RH avant la séparation

*2026-11-27 · Suite de D81 et de la dette D191. Lecture du code (imports, schéma, droits, interface, données de démonstration). **Aucun fichier de code modifié**, aucune suppression essayée : les conclusions restent à prouver par une compilation et les tests lors de l'exécution.*

## 1. Question
Que casse-t-on si la plateforme RH ne reprend pas les **contrats**, les **parcours** d'intégration et de départ, et les **présences** ?

## 2. Conclusion
**Les écrans conservés (annuaire, organigramme, fiches, absences) ne dépendent pas des trois fonctions retirées**, d'après les imports. La dépendance est à sens unique : ce qui est retiré s'appuie sur ce qui est gardé. Les points à traiter sont les raccords : déclaration du module, menu, droits, données de démonstration et tests.

## 3. Sens des dépendances
| Élément | Constat |
|---|---|
| Fiches et absences (serveur) | Aucune référence aux contrats, parcours ou présences hors de `hr.module.ts` |
| Contrats, parcours, présences (serveur) | S'appuient sur les employés |
| Présences | Lisent aussi les **absences** (calendrier et demandes) |
| Interface conservée | Aucun import des écrans ou bibliothèques retirés (une mention en commentaire dans `page-tabs.tsx`) |
| Interface retirée | Aucun import des bibliothèques `hr` et `leave` détecté par la recherche |
| Autres modules | Hors du module RH, seuls `app.module.ts` et le chargement des données de démonstration l'importent |
| RH vers les autres | **`iam`** (comptes, droits) et **`audit`**, utilisés partout : à fournir par le socle commun |

## 4. Base de données
`Contract`, `Journey` et `PresenceDeclaration` référencent `Employee` ; l'inverse n'est pas requis. Les tables peuvent rester dans le schéma `hr`, vides, ou être créées plus tard. Retirer des modèles demanderait une migration : **à éviter** au premier temps.

## 5. Raccords à traiter
| Fichier | À faire |
|---|---|
| `api/src/modules/hr/hr.module.ts` | Contrôleurs, cas d'usage et dépôts des trois fonctions |
| `web/lib/modules.ts` | Cinq entrées : Présences, Contrats, Contrats à échéance, Parcours, Modèles de parcours |
| `web/lib/roles.ts`, `api/src/modules/iam/domain/roles.ts` | Droits `hr.contract.*`, `hr.journey.*`, `hr.presence.*` attribués à de nombreux rôles |
| `api/src/cli/seed/run-seed.ts`, `seed-plan.ts` | Le chargement de démonstration **utilise** les trois fonctions : il ne compilerait plus après leur retrait |
| `api/test/support/idor-registry.ts`, `idor-contract.integration.spec.ts` | Routes et sondes des trois fonctions |
| Tests `hr-contracts`, `hr-journeys`, `hr-presences`, doublures en mémoire | À retirer ou à conserver avec le code |
| Collection Postman, documentation, fiches de test d'écran | À mettre à jour |

## 6. Trois manières de « ne pas reprendre »
| Manière | Effort | Reprise future |
|---|---|---|
| **1. Masquer** : retirer du menu et des droits, garder le code | Faible | Immédiate |
| **2. Désactiver** : en plus, ne pas déclarer les contrôleurs | Moyen | Simple |
| **3. Extraire** : ne pas copier le code dans la nouvelle plateforme | Élevé | Coûteuse ; l'écart grandit avec le temps |

**Recommandation : commencer par 1 ou 2.** Le besoin de la RH n'est pas confirmé (D191) ; extraire avant sa réponse serait difficile à défaire. Avec 1, les routes restent actives côté serveur : seuls les droits les protègent, d'où l'intérêt de 2 pour une mise en production. **Décision à prendre** après la réponse de la RH et du DG.

## 7. Limites
- Analyse par recherche de texte et d'imports ; les liens indirects (libellés, événements d'audit, exports) ne sont pas garantis.
- Non examinés : les écritures croisées dans le journal d'audit, la collection Postman en détail, la documentation de conception.
