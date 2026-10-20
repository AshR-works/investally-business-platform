# Registre des risques

Échelle : Probabilité / Impact = F (faible), M (moyen), É (élevé).

| # | Risque | P | I | Mitigation | Propriétaire |
|---|---|---|---|---|---|
| R1 | Périmètre trop large : 19 livrables, 8 domaines, risque de tunnel | É | É | Sprints courts, tranche verticale dès S1, livraison du Core avant Finance/RH/Fiscalité | Product / Tech Lead |
| R2 | Règles métier mal comprises (agrément, accord de principe, transitions) | É | É | Valider glossaire et agrégats avec les utilisateurs ; questions ouvertes en Phase 2 | Business Analyst |
| R3 | Dégradation du monolithe (imports croisés entre modules) | M | É | Tests d'architecture bloquants en CI (S1) | Tech Lead |
| R4 | Coût de mapping Domain ↔ Prisma freine l'équipe | M | M | Gabarits de module, mappers générés/testés ; read models sans mapping | Tech Lead |
| R5 | Croissance d'`AuditLog` et données sensibles dans old/new value | M | É | Partitionnement, masquage de champs, rétention validée par juridique/RSSI | RSSI |
| R6 | Compromission de compte (accès à données financières et RH) | M | É | MFA obligatoire pour rôles sensibles, rate limiting, verrouillage progressif, sessions révocables | RSSI |
| R7 | Règles fiscales (Cameroun, H) mal comprises, échéances erronées | M | É | Valider avec le Responsable Fiscalité avant le sprint Fiscalité ; calendrier configurable | Fiscalité |
| R8 | Perte de données | F | É | Sauvegardes chiffrées, test de restauration trimestriel, RPO/RTO définis (S1) | DevOps |
| R9 | Dépendance à un seul développeur / connaissance non partagée | M | M | ADR, docs/, revues de code, conventions | Tech Lead |
| R10 | Migration .NET plus coûteuse que prévu | F | M | Domain pur testé indépendamment ; pas de types Prisma dans Domain/Application ; contrats d'API OpenAPI | Architecte |
| R11 | Conformité protection des données personnelles (apprenants, employés) | M | É | Cartographie des données personnelles, minimisation, droit d'accès/effacement via soft delete + anonymisation | RSSI / Juridique |
| R12 | Hypothèses de charge ou de périmètre fausses | M | M | Déclencheurs chiffrés pour revoir les décisions (voir Phase 3) | Architecte |
| R13 | Compromission du compte SuperAdmin (accès complet, décision produit ADR-0006) | M | É | MFA obligatoire, step-up, au moins 2 comptes nominatifs, session 12 h, audit et alerte Direction, revue trimestrielle | RSSI |
| R14 | Utilisateur bloqué (téléphone perdu) avec MFA obligatoire pour tous | M | M | Codes de secours, procédure de réinitialisation par un SuperAdmin avec step-up, au moins 2 SuperAdmin | Support |
| R15 | Envoi d'e-mails Microsoft 365 indisponible (API retirée/changée, compte technique absent) | M | M | Port `EmailSender` remplaçable, adaptateur journal en test, valider tôt avec l'administrateur M365 | Tech Lead |
