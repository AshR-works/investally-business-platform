# Spécifications frontend — Next.js, TypeScript, Tailwind CSS

**Objet** : traduire le design system ([01-DESIGN-SYSTEM.md](01-DESIGN-SYSTEM.md)) en code pour `apps/crm-web`, sans toucher aux règles de sécurité existantes.
**Statut** : spécification **à valider** ; rien n'est encore appliqué à l'application.

---

## 1. Principes d'intégration
1. **Les jetons sont des variables CSS** (`tokens.css`) : une seule source, lisible par Tailwind, par le CSS classique et par les tests.
2. **Tailwind CSS v4, configuration par le CSS** (`@theme`) : les classes utilitaires (`bg-surface`, `text-ink-2`, `rounded-card`…) pointent vers les variables ; le thème sombre est un changement de **valeurs de variables**, pas de classes dupliquées.
3. **Composants sans logique de sécurité** : ils affichent ; l'API décide (aucune régression de `@Protected`, du step-up, de l'audit).
4. **Aucune ressource externe** : polices et icônes **hébergées** dans l'application (politique CSP `default-src 'self'`).
5. **Pas de nouvelle dépendance sans justification** : Tailwind et ses plugins sont les seules additions prévues pour l'habillage.

## 2. Jetons Tailwind (v4)
Fichier [tailwind-theme.css](tailwind-theme.css) : à importer après `tokens.css`.

```css
@import 'tailwindcss';
@import './tokens.css';

@theme inline {
  --font-sans: var(--font-ui);
  --font-display: var(--font-display);

  --color-bg: var(--bg);
  --color-surface: var(--surface);
  --color-surface-2: var(--surface-2);
  --color-sidebar: var(--sidebar);
  --color-line: var(--line);
  --color-ink: var(--ink);
  --color-ink-2: var(--ink-2);
  --color-muted: var(--muted);
  --color-brand: var(--brand);
  --color-brand-strong: var(--brand-strong);
  --color-brand-ink: var(--brand-ink);
  --color-hero: var(--hero);
  --color-ok: var(--ok);     --color-ok-bg: var(--ok-bg);
  --color-warn: var(--warn); --color-warn-bg: var(--warn-bg);
  --color-bad: var(--bad);   --color-bad-bg: var(--bad-bg);
  --color-info: var(--info); --color-info-bg: var(--info-bg);

  --radius-control: 10px;
  --radius-card: 22px;
  --shadow-card: var(--shadow-1);
}
```
Exemples d'usage : `bg-surface text-ink border border-line rounded-card`, `bg-brand text-brand-ink`, `text-ok bg-ok-bg`.

## 3. Structure des fichiers proposée
```
apps/crm-web/
├── app/
│   ├── globals.css                 import de Tailwind et des jetons
│   ├── (auth)/                     connexion, MFA, mot de passe oublié, invitation (gabarit « auth »)
│   └── (app)/                      pages connectées (gabarit « coque »)
├── components/
│   ├── ui/                         composants de base : Button, Field, Badge, Avatar, Tabs, Table, Modal, Toast, OtpInput
│   ├── layout/                     AppShell, Sidebar, Topbar, PageHeader, Hero, KpiCard
│   └── business/                   StatusBadge, OpportunityCard, CompanyRow, AuditRow, SessionCard, Funnel,
│                                   WeekGrid, MonthGrid, MiniCalendar, EventBlock, AgendaFilters, EventDialog
├── lib/
│   ├── design/status.ts            correspondance statut métier → variante de badge (une seule source)
│   └── …                           (existant : api, auth-context, permissions)
└── public/
    ├── brand/                      logos SVG (Investally, Investudy)
    └── fonts/                      Inter, Montserrat (woff2, licence OFL)
```

## 4. Contrats des composants (extraits)
```ts
// components/ui/Badge.tsx
type BadgeTone = 'neutral' | 'info' | 'warn' | 'ok' | 'bad';
export function Badge({ tone = 'neutral', children }: { tone?: BadgeTone; children: ReactNode }) { /* point + texte */ }

// lib/design/status.ts : UNE table, utilisée partout
export const OPPORTUNITY_STATUS: Record<OpportunityStage, { label: string; tone: BadgeTone }> = { /* … */ };

// components/layout/Hero.tsx
export function Hero(props: { label: string; value: string; trend?: { text: string; positive: boolean };
                              series: number[]; aside?: { label: string; value: string; hint?: string } }) {}

// components/business/WeekGrid.tsx : jours × heures ; les événements sont positionnés par calcul (début, durée)
type AgendaEvent = { id: string; type: 'rdv' | 'relance' | 'formation' | 'echeance' | 'interne'; title: string;
                     start: Date; end: Date; companyId?: string; location?: string };
// lib/design/agenda.ts : table type → teinte (une seule source) ; conversion en pixels (1 h = 56 px) ; chevauchements en colonnes

// components/ui/Table.tsx : lignes sélectionnables, tri, colonnes masquables, états vide / chargement / erreur
```
**Règles de code** : un composant = un fichier, une phrase de commentaire sur son rôle (comme le reste du dépôt), aucune couleur écrite en dur, aucun `dangerouslySetInnerHTML`.

## 5. Mise en page
| Point de rupture | Comportement |
|---|---|
| ≥ 1 100 px | Barre latérale fixe 280 px, 4 cartes KPI par ligne |
| 900–1 100 px | 2 cartes KPI par ligne, héros sur une colonne |
| < 900 px | Barre latérale en **tiroir** (bouton menu, `aria-expanded`), tableau à défilement horizontal |
| < 560 px | KPI en colonne, recherche masquée (icône) |

## 6. Polices
- Fichiers **variables** woff2 (latin) : `inter-latin-wght-normal.woff2`, `montserrat-latin-wght-normal.woff2`, servis depuis `/fonts` ; `font-display: swap`.
- Installation proposée : paquets `@fontsource-variable/inter` et `@fontsource-variable/montserrat` (licence OFL-1.1), importés par Next.js (aucun appel réseau à l'exécution).
- Licences conservées dans `public/fonts/` (déjà copiées dans le prototype).

## 7. Icônes et logos
- **Icônes** : jeu à traits 1,6 px sur grille 24 (le prototype en contient 24, tracées à la main) ; en production, un seul jeu libre de droits (par exemple Lucide, licence ISC), importé en SVG individuels.
- **Logos** : les trois PNG fournis (Investally rectangle et carré, Investudy rectangle), recadrés, sous `public/brand/`. Emplacements : **rectangle Investally** dans la barre latérale ; **carré Investally** sur les écrans d'accès (connexion, MFA, mot de passe oublié) ; **rectangle Investudy** uniquement dans les écrans de formation (en-tête de page et carte d'accès rapide). Thème sombre : filtre monochrome blanc, en attendant une variante claire officielle ; remplacer par des SVG dès qu'ils existent.

## 8. Sécurité et conformité de l'habillage
| Sujet | Règle |
|---|---|
| CSP | Aucune ressource externe ; styles et polices locaux. `style-src 'unsafe-inline'` reste nécessaire (dette D20) |
| Contenu dynamique | Texte seulement ; aucune injection de HTML |
| Données dans l'interface | Les montants et noms viennent de l'API ; aucune donnée de démonstration ne sort du prototype |
| Droits | Les menus et boutons restent conditionnés par `/auth/me/profile` **et** re-contrôlés par le serveur |
| Journal | Aucun changement : l'audit n'est pas touché par l'habillage |

## 9. Tests prévus
| Type | Contenu |
|---|---|
| Unitaires | Table des statuts, formateurs de montants (XAF), libellés |
| Composants | Rendu, clavier, états (Vitest + Testing Library) |
| Accessibilité | Contrastes vérifiés par script à chaque changement de jeton ; axe-core sur les pages |
| Visuels | Captures de référence des 8 écrans, clair et sombre (comparaison à chaque modification) |
| Parcours réels | Rejeu dans un navigateur réel après habillage (comme S3.4) |

## 10. Découpage proposé
| Sprint | Livrable | Preuve |
|---|---|---|
| **H1 — Fondations** | Tailwind, jetons, polices hébergées, logos, coque (barre latérale, barre supérieure), thème clair/sombre | page de référence + captures |
| **H2 — Écrans d'accès** | Connexion, MFA (QR, codes), mot de passe oublié, réinitialisation, invitation | parcours réels rejoués |
| **H3 — Écrans connectés** | Entreprises, Utilisateurs, Mon compte, fenêtres | parcours réels rejoués |
| **Agenda (avec S4.2–S4.3)** | Module `agenda` côté API (événements, rappels, droits Propre/Équipe/Tous, audit) + écrans semaine, mois et jour, liste d'accessibilité, création liée à une entreprise ou à une opportunité | recette dédiée ; synchronisation Outlook ensuite |
| **S4+** | Les écrans métier naissent directement dans ce système | recettes de chaque sprint |

## 11. Risques
| Risque | Réponse |
|---|---|
| Tailwind v4 / Next.js 16 très récents | Versions épinglées ; essai isolé avant migration |
| Logo reconstitué ≠ officiel | Remplacer par les SVG officiels avant toute mise en ligne |
| Régression de comportement pendant l'habillage | **Aucune logique modifiée** ; tests existants (24) + parcours réels rejoués |
| Agenda : chevauchements, fuseaux horaires, événements récurrents | Stockage en **UTC** (règle déjà adoptée), affichage Africa/Douala ; chevauchements en colonnes ; récurrence **hors première version** |
| Dérive visuelle au fil des sprints | Composants uniques, table des statuts unique, vérification de contraste automatisée |
