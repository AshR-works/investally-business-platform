# S4.0 (suite) — modifier et exporter une fiche d'entreprise : recette

*Branche `sprint/s4-0c-modifier-exporter-fiche` · 2026-10-30 · demande de la direction produit ; DDR-0014 ; D26.*

## Ce qui est livré
| Demande | Réponse |
|---|---|
| **Bouton « Modifier »** | Sur la fiche, pour qui détient `bd.company.update` : la fenêtre de création, préremplie. Nom, secteur, pays, e-mail, téléphone, facilitateur, méthode, appartenance, commission. Jamais le propriétaire, le statut ni l'identifiant (400). Entreprise archivée : non modifiable |
| **Verrou optimiste** | Modification sur une version périmée : 409, rien n'est écrasé |
| **Commission** | Seul le gestionnaire (Responsable commercial, Super administrateur) la définit, la change ou la retire ; la modification d'un chargé de compte la **conserve** |
| **Export de la fiche** | Bouton « Exporter la fiche » pour qui voit l'entreprise ; document HTML imprimable (enregistrable en PDF par le navigateur) ; **chaque export est tracé** (session, adresse, appareil) avant la remise ; hors portée = « introuvable » sans trace |
| **Contenu du document** | Seulement ce que l'utilisateur voit : le Support n'a ni facilitateur ni commission |

## Preuves
| Contrôle | Résultat |
|---|---|
| Types (`tsc`), architecture (`pnpm arch`) | 0 erreur · aucune violation (166 modules) |
| Tests unitaires de l'API | **504 / 504** (1 ignoré, antérieur) ; 28 nouveaux (modifier : 18 ; export et document : 10) |
| **Tests d'intégration (PostgreSQL jetable)** | **196 / 196** (14 suites) ; 13 nouveaux (`company-edit-export`), dont portée, version, audit avant/après, persistance du retrait et du remplacement du lien |
| **IDOR** | `PUT /companies/:id` et `GET /companies/:id/export` classées « objet » et sondées : même réponse pour la fiche d'un collègue et un identifiant inexistant, aucune écriture, aucune trace d'export |
| Sécurité du document | Échappement testé (nom et commentaire piégés), aucun script ni lien ni ressource externe, politique de contenu `default-src 'none'`, `nosniff`, pas de cache |
| Tests de l'interface | **183 / 183** (22 nouveaux) : préremplissage, droits d'édition, corps de la requête (conservation de la commission, retrait, verrouillage), boutons, ouverture de la fenêtre avant l'attente |
| **Mutants** | **14 / 14 tués** (version non contrôlée, portée ignorée, commission perdue ou non protégée, retrait sans droit, export sans trace ou hors portée ou avec commission, échappement incomplet, archivée modifiable, facilitateur étranger accepté, doublon de nom, retrait et remplacement du lien non persistés) |
| Node 22 | Non rejoué pour ce lot (testé sous Node 26.7 ; les 183 tests d'intégration d'avant avaient passé sous Node 22) |

## Réserves sur la recette
- **Aucun passage dans le navigateur réel pour ce lot** (mémoire insuffisante, application locale de la direction produit sur les ports de test). L'ouverture de la fenêtre d'impression, la boîte « Enregistrer au format PDF » et la mise en page du document ne sont **pas vérifiées visuellement**.
- **L'impression dépend du navigateur** : un bloqueur de fenêtres contextuelles peut empêcher l'ouverture (un message l'explique). Le rendu du PDF n'est pas identique d'un navigateur à l'autre (D61).
- Le gabarit est **provisoire** : en-tête texte, pas de logo ni de mentions légales (en attente de la charte et des informations du DAF).
- **Modifier** : le sélecteur de facilitateurs liste ceux de la portée de l'utilisateur ; un facilitateur créé par un collègue hors portée n'est pas proposé.

## Dette et à confirmer
- **D58** réglée (provisoire) ; **D59** export de listes ; **D60** vues partagées ; **D61** PDF côté serveur.
- **À confirmer** : l'option C pour les exports de listes, le modèle des vues partagées, et que le DG et la DGA reçoivent le rôle Super administrateur (qui inclut l'administration) plutôt que Direction (qui voit et exporte tout).

## À valider
1. Les boutons et leur emplacement ; la conservation de la commission par un chargé de compte.
2. « Je valide S4.0c » → fusion avec commit de fusion et étiquette `s4-0c-validated` (après la fusion de `fix/retours-s4-0`, dont cette branche dépend).
