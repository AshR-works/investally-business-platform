-- Vérifications d'intégrité de la base Investally (LECTURE SEULE).
--
-- Chaque vérification est une requête qui ne renvoie AUCUNE ligne quand tout va bien ; une ligne renvoyée est une anomalie. Elles complètent les règles que la base
-- garantit déjà (CHECK, index uniques, clés étrangères) par ce qu'elle ne peut pas garantir seule : les références entre contextes (par identifiant, sans clé
-- étrangère), les cumuls (places, agréments) et la cohérence entre tables.
--
-- Lancer :   node scripts/db-docs/run-verifications.mjs        (avec DATABASE_URL ; affiche réussite ou échec de chaque vérification)
--       ou : psql "$DATABASE_URL" -f docs/base-de-donnees/verifications.sql   (les résultats s'affichent un à un ; tout résultat non vide est une anomalie)
--
-- Chaque bloc commence par `-- @check <nom> : <ce qui est vérifié>`. Aucune requête ne modifie la base.

-- @check apprenants_entreprise_inconnue : un apprenant d'entreprise désigne une entreprise qui n'existe pas
SELECT l.id, l.company_id FROM training.learners l
WHERE l.company_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM bd.companies c WHERE c.id = l.company_id);

-- @check apprenants_contact_inconnu : un apprenant désigne un contact qui n'existe pas, ou d'une autre entreprise
SELECT l.id, l.contact_id FROM training.learners l
WHERE l.contact_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM bd.contacts k WHERE k.id = l.contact_id AND k.company_id = l.company_id);

-- @check inscriptions_entreprise_differente : l'entreprise recopiée sur une inscription n'est pas celle de l'apprenant
SELECT e.id, e.company_id AS inscription, l.company_id AS apprenant FROM training.enrollments e
JOIN training.learners l ON l.id = e.learner_id
WHERE e.company_id IS DISTINCT FROM l.company_id;

-- @check inscriptions_agrement_inconnu : une inscription désigne un agrément inexistant ou d'une autre entreprise
SELECT e.id, e.approval_id FROM training.enrollments e
WHERE e.approval_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM bd.approvals a WHERE a.id = e.approval_id AND a.company_id = e.company_id);

-- @check inscriptions_payeur_sans_entreprise : un étudiant ou un particulier a une inscription sous agrément, ou un apprenant d'entreprise un payeur (Lot B)
SELECT e.id FROM training.enrollments e JOIN training.learners l ON l.id = e.learner_id
WHERE (l.kind = 'COMPANY' AND e.payer_kind IS NOT NULL) OR (l.kind <> 'COMPANY' AND e.approval_id IS NOT NULL);

-- @check sessions_places_depassees : plus d'inscriptions en attente ou confirmées que la capacité de la session
SELECT s.id, s.capacity, count(*) AS inscrits FROM training.sessions s
JOIN training.enrollments e ON e.session_id = s.id AND e.status IN ('PENDING', 'CONFIRMED')
GROUP BY s.id, s.capacity HAVING count(*) > s.capacity;

-- @check inscriptions_doublon_vivant : un apprenant inscrit deux fois (non annulée) à la même session
SELECT e.session_id, e.learner_id, count(*) FROM training.enrollments e
WHERE e.status <> 'CANCELLED' GROUP BY e.session_id, e.learner_id HAVING count(*) > 1;

-- @check agrements_consommation_depassee : un agrément a plus d'inscriptions (places) ou de montant consommé (somme) que sa couverture
SELECT a.id, a.places, a.amount, count(*) AS inscriptions, coalesce(sum(e.charged_amount), 0) AS montant_consomme
FROM bd.approvals a JOIN training.enrollments e ON e.approval_id = a.id AND e.status IN ('PENDING', 'CONFIRMED')
GROUP BY a.id, a.places, a.amount
HAVING (a.places IS NOT NULL AND count(*) > a.places) OR (a.amount IS NOT NULL AND coalesce(sum(e.charged_amount), 0) > a.amount);

-- @check agrements_recus_sans_date : un agrément reçu ou honoré sans date de réception
SELECT a.id, a.status FROM bd.approvals a WHERE a.status IN ('RECEIVED', 'HONORED') AND a.received_on IS NULL;

-- @check sessions_cycle_incoherent : une session dont la fin précède le début
SELECT s.id, s.start_date, s.end_date FROM training.sessions s WHERE s.end_date < s.start_date;

-- @check contacts_entreprise_inconnue : un contact désigne une entreprise qui n'existe pas
SELECT k.id, k.company_id FROM bd.contacts k WHERE NOT EXISTS (SELECT 1 FROM bd.companies c WHERE c.id = k.company_id);

-- @check entreprises_responsable_inconnu : une entreprise a un responsable qui n'est pas un compte
SELECT c.id, c.owner_user_id FROM bd.companies c
WHERE c.owner_user_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM iam.users u WHERE u.id = c.owner_user_id);

-- @check employes_responsable_sorti : un employé en poste dont le responsable est sorti du personnel
SELECT e.id, e.manager_employee_id FROM hr.employees e JOIN hr.employees m ON m.id = e.manager_employee_id
WHERE e.status = 'ACTIVE' AND m.status = 'ARCHIVED';

-- @check employes_compte_inconnu : une fiche employé liée à un compte qui n'existe pas
SELECT e.id, e.user_id FROM hr.employees e
WHERE e.user_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM iam.users u WHERE u.id = e.user_id);

-- @check employes_compte_lie_deux_fois : un compte lié à deux fiches employé
SELECT e.user_id, count(*) FROM hr.employees e WHERE e.user_id IS NOT NULL GROUP BY e.user_id HAVING count(*) > 1;

-- @check conges_chevauchement : deux absences actives (en attente ou validées) du même employé se chevauchent, hors demi-journées contiguës
SELECT a.id AS demande_a, b.id AS demande_b, a.employee_id FROM hr.leave_requests a
JOIN hr.leave_requests b ON b.employee_id = a.employee_id AND a.id < b.id
WHERE a.status IN ('PENDING', 'APPROVED') AND b.status IN ('PENDING', 'APPROVED')
  AND a.start_date <= b.end_date AND b.start_date <= a.end_date
  AND NOT (a.end_date = b.start_date AND a.end_half AND b.start_half)
  AND NOT (b.end_date = a.start_date AND b.end_half AND a.start_half);

-- @check conges_employe_inconnu : une absence d'un employé qui n'existe pas
SELECT r.id, r.employee_id FROM hr.leave_requests r WHERE NOT EXISTS (SELECT 1 FROM hr.employees e WHERE e.id = r.employee_id);

-- @check conges_solde_negatif : un employé dont les jours validés ou en attente de congé annuel dépassent ce que la règle autorise
SELECT r.employee_id, r.leave_year, sum(r.days) AS jours FROM hr.leave_requests r
JOIN hr.leave_types t ON t.id = r.leave_type_id AND t.deducts_balance
CROSS JOIN hr.leave_settings s
WHERE r.status IN ('PENDING', 'APPROVED') AND NOT s.allow_negative_balance
GROUP BY r.employee_id, r.leave_year, s.accrual_days_per_month
HAVING sum(r.days) > 12 * s.accrual_days_per_month + coalesce((SELECT sum(a.days) FROM hr.leave_adjustments a WHERE a.employee_id = r.employee_id AND a.year = r.leave_year), 0);

-- @check comptes_actifs_sans_role : un compte actif sans aucun rôle
SELECT u.id, u.email FROM iam.users u
WHERE u.status = 'ACTIVE' AND u.deleted_at IS NULL AND NOT EXISTS (SELECT 1 FROM iam.user_roles r WHERE r.user_id = u.id);

-- @check comptes_responsable_inconnu : un compte dont le responsable (hiérarchie) n'existe pas
SELECT u.id, u.manager_id FROM iam.users u
WHERE u.manager_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM iam.users m WHERE m.id = u.manager_id);

-- @check comptes_mfa_sans_secret : un compte dont le second facteur est actif mais sans secret enregistré
SELECT u.id, u.email FROM iam.users u WHERE u.mfa_enabled AND u.mfa_secret_enc IS NULL;

-- @check audit_sans_auteur_ni_session : une trace d'audit sans auteur ni session, hors événements système (connexion, tentative)
SELECT a.id, a.module, a.action FROM audit.audit_logs a
WHERE a.user_id IS NULL AND a.session_id IS NULL AND a.module NOT IN ('iam', 'system');
