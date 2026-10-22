# Écart entre le mockup et l'application réelle

**Date** : 2026-10-21 · **Pourquoi ce document** : l'application ne ressemblait pas au mockup ; ce tableau dit, écran par écran, **ce qui est reproduit, ce qui manque et pourquoi**. Mis à jour après la session H1b (composants de données) et l'arbitrage D21 (Pays et « Créée le » ajoutés).

**Principe** : un élément du mockup n'apparaît dans l'application que s'il a une **donnée réelle** derrière lui. Aucune donnée fictive ne sort du prototype.

## Les structures de données prévues par le design (et leur état)
| Structure du mockup | État | Où |
|---|---|---|
| En-tête de page : fil d'Ariane, domaine, titre, description, actions | ✅ réalisée | Entreprises, Utilisateurs |
| Tableau : en-têtes, cellule « entité » à initiales, badges de statut | ✅ réalisée | Entreprises, Utilisateurs, sessions de Mon compte |
| Sélection persistante (case, clic sur la ligne, fond teinté + barre de 4 px, case d'en-tête indéterminée) — EXD-02 | ✅ réalisée | Entreprises, Utilisateurs |
| Barre « n sélectionnées · Tout désélectionner » | ✅ réalisée (sans actions groupées, voir ci-dessous) | Entreprises, Utilisateurs |
| Barre d'outils : filtres rapides, recherche à saisie différée | ✅ réalisée | Utilisateurs (filtres par statut) ; recherche partout |
| Pagination « 1–20 sur 48 » | ✅ réalisée | Entreprises, Utilisateurs |
| Menu d'actions d'une ligne « ⋯ » (clavier, fermeture à Échap) | ✅ réalisée | Utilisateurs |
| Fenêtre de création | ✅ réalisée | Nouvelle entreprise, Inviter |
| Cartes d'opportunités (6 par ligne), bandeau d'étapes, vue « Par étape » | ⏳ non réalisée | S4.3 (la logique de sélection est prête : `lib/selection.ts`) |
| Indicateurs (KPI), carte « héros », graphiques | ⏳ non réalisée | S6 (aucune source de données) |

## Écran par écran
| Écran du mockup | Ce qui est reproduit | Ce qui manque | Pourquoi | Session |
|---|---|---|---|---|
| **Vue d'ensemble (hub)** | Recherche globale, tuiles des modules disponibles, modules « À venir » | Indicateurs, rendez-vous du jour, tâches | Aucune source de données | S4 à S6 |
| **Entreprises** | En-tête, tableau (entreprise, secteur, **pays**, statut, **créée le**), recherche, sélection persistante, pagination, création en fenêtre | Colonnes **Responsable, Valeur estimée, Dernière activité** ; ville dans la cellule ; onglets « Les miennes / À relancer » avec compteurs ; boutons **Filtres, Colonnes, Exporter, Réassigner** | L'API ne fournit pas ces données (nom, secteur, pays, statut et date de création sont affichés) ; pas de route d'export ni de réassignation ; pas de filtre serveur autre que la recherche | S4.1 (arbitrage D21 : lot « tableaux »), S4.2, S4.3 |
| **Utilisateurs** (pas de maquette dédiée, même gabarit) | Tableau complet : utilisateur, rôles, statut, MFA, dernière connexion, menu d'actions, filtres par statut, recherche, pagination | Compteurs par statut dans les filtres ; actions groupées | Compteurs : requêtes supplémentaires non prévues ; actions groupées : pas de routes | à décider |
| **Mon compte** | Page « Sessions et connexions » : sessions actives avec risque, révocation confirmée, « tous mes autres appareils », historique des connexions sur 90 jours | Mise en page des autres blocs de Mon compte (profil, mot de passe, codes de secours) au nouveau style | Contrôles de formulaire encore « legacy » (D32) | S4 |
| **Écrans d'accès** (connexion, MFA, invitation, mot de passe) | **Gabarit du mockup (H2a)** : carte d'accueil, indicateur d'étape, notices, règles en direct, introduction du MFA, compte à rebours, **code en six cases** | Codes de secours restants (A03) ; sessions actives et historique (S01 à S03) | L'API ne fournit pas le nombre restant ; H2b | H2b |
| **Fiche entreprise** | Identité (statut, secteur, pays, date) et panneau Documents | Contacts, offres, rendez-vous, historique, opportunités | Modules non livrés | S4.1 à S4.3 |
| **Opportunités** | — | Tout l'écran | Le module n'existe pas | S4.3 |
| **Agenda** | — | Tout l'écran | Le module n'existe pas | S4.2b |
| **Formation** | — | Tout l'écran | Le module n'existe pas | S5 |
| **Centre de confiance (Sécurité)** | — | Score, graphique, tableau des événements | Lecture du journal d'audit non exposée | S6.2 |
| **Page « Composants »** | — | Page de référence des composants | Non demandée en H1 ; les composants sont en place et testés | à décider |

## Ce que vous pouvez faire
- Constater le résultat : captures dans `docs/accessibilite/h1-captures/` (fichiers `entreprises-selection`, `utilisateurs`, `utilisateurs-menu`, `hub-clair`).
- Choisir ce qui comble l'écart restant le plus vite : **ajouter à l'API** les champs et filtres manquants (responsable, dernière activité, compteurs) sans attendre S4 — c'est une décision qui touche le périmètre de S4.1, à arbitrer avec la méthode.
