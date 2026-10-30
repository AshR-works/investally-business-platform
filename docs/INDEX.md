# Documentation Investally : index

*Point d'entrée de toute la documentation. Chaque document existe en Markdown (source, versionné) et en page HTML (lecture, impression PDF). Régénération : `python scripts/md-to-html.py`.*

## Pour démarrer
| Document | Contenu |
|---|---|
| [Guide d'exécution locale](GUIDE-EXECUTION-LOCALE.md) | Lancer l'application sur votre poste, comptes de démonstration, scénarios |
| [Stratégie d'exécution](EXECUTION-LOCALE.md) | Options comparées, environnements, feuille de route |
| [Vision](VISION.md) | Produit, périmètre, priorités |
| [État d'avancement](livrables/05-ETAT-D-AVANCEMENT.md) | Où en est le projet |
| [Suivi des sessions](livrables/04-SUIVI-DES-SESSIONS.md) | Sessions livrées et validées |

## Décider
| Document | Contenu |
|---|---|
| [Méthode d'arbitrage](METHODE-D-ARBITRAGE.md) | Comment les décisions structurantes sont présentées |
| [Cas d'usage des flux transverses](CAS-D-USAGE-FLUX-TRANSVERSES.md) | 7 flux, 29 cas d'usage, schémas par acteur ([workflows](workflows/index.html)) ; propositions à valider |
| [Cas d'usage du module commercial](CAS-D-USAGE-MODULE-COMMERCIAL.md) | 5 flux (C1 à C5), 24 cas d'usage, droits actuels, points à trancher ; propositions à valider |
| [Questions et décisions](QUESTIONS-ET-DECISIONS.md) | Registre des questions ouvertes et des décisions prises |
| [Dette technique](TECH-DEBT.md) | Dettes connues et leur échéance |
| [Risques](RISKS.md) | Registre des risques |
| [Cadrages](cadrages/README.md) | Cadrages de session et arbitrages |

## Architecture et sécurité
| Document | Contenu |
|---|---|
| [Architecture](ARCHITECTURE.md) | Monolithe modulaire, couches, règles de dépendance |
| [Modèle de données](DATA-MODEL.md) | Schémas et tables |
| [Sécurité](SECURITY.md) | Authentification, MFA, sessions, documents |
| [Droits (RBAC)](RBAC.md) | Rôles, permissions, portées |
| [Fiabilité](RELIABILITY.md) | Sauvegardes, reprise, audit |
| [Stratégie de tests](TESTING.md) | Pyramide de tests, règles d'architecture |
| [Plan conception, code, architecture](DESIGN-CODE-ARCHITECTURE-PLAN.md) | Plan de référence |

## Décisions d'architecture (ADR)
| Document | Sujet |
|---|---|
| [ADR-0001](adr/0001-modular-monolith.md) | Monolithe modulaire |
| [ADR-0002](adr/0002-prisma-in-infrastructure-only.md) | Prisma confiné à l'infrastructure |
| [ADR-0003](adr/0003-domain-model-separate-from-persistence.md) | Domaine distinct de la persistance |
| [ADR-0004](adr/0004-audit-strategy.md) | Stratégie d'audit |
| [ADR-0005](adr/0005-crm-erp-separation.md) | CRM séparé de l'ERP |
| [ADR-0006](adr/0006-access-and-security-decisions.md) | Décisions d'accès et de sécurité |
| [ADR-0007](adr/0007-stocks-module-autonome-heberge.md) | Module Stocks |
| [ADR-0008](adr/0008-stockage-des-documents-derriere-un-port.md) | Stockage des documents |

## Recettes par session
| Document | Session |
|---|---|
| [Sprint 1](SPRINT-1-RECETTE.md) | Tranche verticale entreprises |
| [Sprint 2](SPRINT-2-RECETTE.md) | Socle identité, documents, audit |
| [S3.1](SPRINT-3.1-RECETTE.md), [S3.2](SPRINT-3.2-RECETTE.md), [S3.3](SPRINT-3.3-RECETTE.md), [S3.4](SPRINT-3.4-RECETTE.md), [S3.5](SPRINT-3.5-RECETTE.md) | Authentification, MFA, invitations, sessions, réinitialisation |
| [S3.6](SPRINT-S3-6-RECETTE.md) | Documents |
| [A11Y-1](SPRINT-A11Y-1-RECETTE.md) | Accessibilité |
| [H1](SPRINT-H1-RECETTE.md), [H2a](SPRINT-H2A-RECETTE.md), [H2b](SPRINT-H2B-RECETTE.md) | Habillage, authentification et sessions |

## Design et livrables
| Document | Contenu |
|---|---|
| [Design : mode d'emploi](design/README.md) | Design system, spécifications, prototype, exigences |
| [Récapitulatif des réalisations](livrables/01-RECAPITULATIF-REALISATIONS.md) | Ce qui est livré |
| [Guide du code](livrables/02-GUIDE-DU-CODE.md) | Organisation du code |
| [Index des fonctions](livrables/03-INDEX-DES-FONCTIONS.md) | Fonctions et responsabilités |
| [Protocole lecteur d'écran](accessibilite/PROTOCOLE-LECTEUR-D-ECRAN.md) | Test d'accessibilité avec un lecteur d'écran |
