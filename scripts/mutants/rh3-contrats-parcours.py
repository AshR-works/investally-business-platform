from pathlib import Path
# Racine du dépôt : ce script se trouve dans scripts/mutants/.
REPO = Path(__file__).resolve().parents[2]
import subprocess, os, sys
api = str(REPO / 'apps' / 'crm-api')
web = str(REPO / 'apps' / 'crm-web')
hr = os.path.join(api, 'src', 'modules', 'hr')
con = os.path.join(hr, 'domain', 'contract.ts')
jou = os.path.join(hr, 'domain', 'journey.ts')
cuc = os.path.join(hr, 'application', 'contract-use-cases.ts')
juc = os.path.join(hr, 'application', 'journey-use-cases.ts')
jvw = os.path.join(hr, 'application', 'journey-view.ts')
cctl = os.path.join(hr, 'presentation', 'contracts.controller.ts')
jctl = os.path.join(hr, 'presentation', 'journeys.controller.ts')
crepo = os.path.join(hr, 'infrastructure', 'prisma-contract.repositories.ts')
jrepo = os.path.join(hr, 'infrastructure', 'prisma-journey.repositories.ts')
mig3a = os.path.join(api, 'prisma', 'migrations', '20261119000000_rh_3a_contracts', 'migration.sql')
mig3b = os.path.join(api, 'prisma', 'migrations', '20261120000000_rh_3b_journeys', 'migration.sql')
roles = os.path.join(api, 'src', 'modules', 'iam', 'domain', 'roles.ts')
lc = os.path.join(web, 'lib', 'contracts.ts')
lj = os.path.join(web, 'lib', 'journeys.ts')
lm = os.path.join(web, 'lib', 'modules.ts')
pc = os.path.join(web, 'app', '(app)', 'hr', 'contracts', 'page.tsx')
pj = os.path.join(web, 'app', '(app)', 'hr', 'journeys', 'page.tsx')
pjd = os.path.join(web, 'app', '(app)', 'hr', 'journeys', '[id]', 'page.tsx')
CON_DB = 'db:hr-contracts-http'
JOU_DB = 'db:hr-journeys-http'
M = [
 # --- Domaine des contrats
 ('K1 un code d’un seul caractère est accepté', con, "const CODE = /^[A-Z][A-Z0-9_]{1,29}$/;", "const CODE = /^[A-Z][A-Z0-9_]{0,29}$/;", 'unit'),
 ('K2 un libellé de 101 caractères est accepté', con, "if (value.length > 100) throw", "if (value.length > 101) throw", 'unit'),
 ('K3 un ordre de 10 001 est accepté', con, "value > 10_000", "value > 10_001", 'unit'),
 ('K4 un contrat à durée déterminée peut ne pas avoir de fin', con, "if (fixedTerm && end === null) throw", "if (false && end === null) throw", 'unit'),
 ('K5 un contrat à durée indéterminée peut avoir une fin', con, "if (!fixedTerm && end !== null) throw", "if (false && end !== null) throw", 'unit'),
 ('K6 une fin le jour du début est refusée', con, "if (end !== null && end < start) throw", "if (end !== null && end <= start) throw", 'unit'),
 ('K7 une fin d’essai le jour du début est refusée', con, "if (probationEnd < start) throw", "if (probationEnd <= start) throw", 'unit'),
 ('K8 une fin d’essai le jour de la fin est refusée', con, "if (end !== null && probationEnd > end) throw", "if (end !== null && probationEnd >= end) throw", 'unit'),
 ('K9 un contrat terminé peut être ajusté', con, "if (this.props.status !== 'ACTIVE') throw new DomainError('CONFLICT', 'Un contrat terminé ne se modifie plus');", "if (false) throw new DomainError('CONFLICT', 'Un contrat terminé ne se modifie plus');", 'unit'),
 ('K10 un contrat terminé peut l’être encore', con, "if (this.props.status !== 'ACTIVE') throw new DomainError('CONFLICT', 'Le contrat est déjà terminé');", "if (false) throw new DomainError('CONFLICT', 'Le contrat est déjà terminé');", 'unit'),
 ('K11 le motif de fin n’est plus contrôlé', con, "if (!END_REASONS.includes(input.reason as ContractEndReason)) throw", "if (false) throw", 'unit'),
 ('K12 une fin effective le jour du début est refusée', con, "if (endedOn < this.props.start) throw", "if (endedOn <= this.props.start) throw", 'unit'),
 ('K13 une fin effective le jour de la fin prévue est refusée', con, "if (this.props.end !== null && endedOn > this.props.end) throw", "if (this.props.end !== null && endedOn >= this.props.end) throw", 'unit'),
 ('K14 la fin effective ne prime plus sur la fin prévue', con, "return this.props.endedOn ?? this.props.end;", "return this.props.end ?? this.props.endedOn;", 'unit'),
 ('K15 le début d’un contrat peut changer', con, "{ start: this.props.start, end: changes.end === undefined", "{ start: changes.end ?? this.props.start, end: changes.end === undefined", 'unit'),
 # --- Cas d'usage des contrats
 ('U1 un responsable voit les contrats de son équipe', cuc, "if (read === Scope.All) return true;", "if (read !== null) return true;", 'unit'),
 ('U2 un employé voit le contrat de tout employé qui a un compte', cuc, "return read !== null && employee.userId !== null && employee.userId === access.actorId;", "return read !== null && employee.userId !== null;", 'unit'),
 ('U3 la portée Équipe suffit pour gérer les contrats', cuc, "scopeOf(access, 'hr.contract.manage') === Scope.All", "scopeOf(access, 'hr.contract.manage') !== null", 'unit'),
 ('U4 le droit de gérer n’est plus vérifié', cuc, "if (!canManage(access)) throw", "if (false) throw", 'unit'),
 ('U5 les types désactivés sont visibles de tous', cuc, "query.includeInactive === true && canManage(query.access)", "query.includeInactive === true", 'unit'),
 ('U6 les types se lisent sans droit', cuc, "if (scopeOf(query.access, 'hr.contract.read') === null) throw new DomainError('FORBIDDEN', \"Vous n'avez pas le droit de lire les types de contrat\");", "if (false) throw new DomainError('FORBIDDEN', \"Vous n'avez pas le droit de lire les types de contrat\");", 'unit'),
 ('U7 un code de type déjà pris est accepté', cuc, "if (await this.types.findTypeByCode(type.code)) throw", "if (false) throw", 'unit'),
 ('U8 une version périmée d’un type est acceptée', cuc, "if (type.version !== command.version) throw", "if (false) throw", 'unit'),
 ('U9 un employé archivé reçoit un contrat', cuc, "if (employee.isArchived) throw", "if (false) throw", 'unit'),
 ('U10 un type désactivé est accepté pour un contrat', cuc, "if (!type || !type.active) throw", "if (!type) throw", 'unit'),
 ('U11 un contrat peut commencer avant l’entrée', cuc, "if (contract.start < employee.hiredOn) throw", "if (false) throw", 'unit'),
 ('U12 la fiche de l’employé n’est plus verrouillée à la création', cuc, "await this.contracts.lockEmployee(employee.id);", "", 'unit'),
 ('U13 un second contrat en cours est accepté', cuc, "if (existing.some((c) => c.isActive)) throw", "if (false) throw", 'unit'),
 ('U14 un contrat qui commence le dernier jour d’un contrat terminé est accepté', cuc, "contract.start <= c.lastDay &&", "contract.start < c.lastDay &&", 'unit'),
 ('U15 un contrat qui recouvre un contrat terminé est accepté', cuc, "if (overlap) throw", "if (false) throw", 'unit'),
 ('U16 la création n’est plus tracée comme une création', cuc, "entityType: 'Contract', entityId: contract.id, action: AuditAction.Create", "entityType: 'Contract', entityId: contract.id, action: AuditAction.Update", 'unit'),
 ('U17 une version périmée d’un ajustement est acceptée', cuc, "if (contract.version !== command.version) throw new DomainError('CONFLICT', 'Le contrat a été modifié par un autre utilisateur : rechargez-le');\n      const views = await Views.load(this.employees, this.types, [contract]);\n      const before = views.view(contract);\n      contract.adjust(", "if (false) throw new DomainError('CONFLICT', 'Le contrat a été modifié par un autre utilisateur : rechargez-le');\n      const views = await Views.load(this.employees, this.types, [contract]);\n      const before = views.view(contract);\n      contract.adjust(", 'unit'),
 ('U18 une version périmée de la fin de contrat est acceptée', cuc, "if (contract.version !== command.version) throw new DomainError('CONFLICT', 'Le contrat a été modifié par un autre utilisateur : rechargez-le');\n      const views = await Views.load(this.employees, this.types, [contract]);\n      const before = views.view(contract);\n      contract.finish(", "if (false) throw new DomainError('CONFLICT', 'Le contrat a été modifié par un autre utilisateur : rechargez-le');\n      const views = await Views.load(this.employees, this.types, [contract]);\n      const before = views.view(contract);\n      contract.finish(", 'unit'),
 ('U19 un contrat hors périmètre est dit interdit au lieu d’introuvable', cuc, "if (!contract || !employee || !canView(query.access, employee)) throw new DomainError('NOT_FOUND', NOT_FOUND);", "if (!contract || !employee) throw new DomainError('NOT_FOUND', NOT_FOUND);", 'unit'),
 ('U20 la liste se lit sans droit', cuc, "if (read === null) throw new DomainError('FORBIDDEN', \"Vous n'avez pas le droit de voir des contrats\");", "if (false) throw new DomainError('FORBIDDEN', \"Vous n'avez pas le droit de voir des contrats\");", 'unit'),
 ('U21 la taille de page n’est plus bornée à 100', cuc, "Math.min(MAX_PAGE_SIZE, Math.max(1, Math.floor(query.pageSize)))", "Math.min(MAX_PAGE_SIZE + 1, Math.max(1, Math.floor(query.pageSize)))", 'unit'),
 ('U22 un employé voit les contrats d’un autre en filtrant par employé', cuc, "if (!employee || !canView(query.access, employee)) throw new DomainError('NOT_FOUND', 'Employé introuvable');", "if (!employee) throw new DomainError('NOT_FOUND', 'Employé introuvable');", 'unit'),
 ('U23 la portée Propre voit tous les contrats', cuc, "} else if (read !== Scope.All) {", "} else if (false) {", 'unit'),
 ('U24 les échéances sont ouvertes à la portée Propre', cuc, "if (scopeOf(query.access, 'hr.contract.read') !== Scope.All) throw", "if (false) throw", 'unit'),
 ('U25 la période par défaut des échéances n’est plus de 60 jours', cuc, "const days = query.days ?? DEFAULT_DEADLINE_DAYS;", "const days = query.days ?? 30;", 'unit'),
 ('U26 une période de zéro jour est acceptée', cuc, "days < 1 || days > MAX_DEADLINE_DAYS", "days < 0 || days > MAX_DEADLINE_DAYS", 'unit'),
 ('U27 une période de 366 jours est acceptée', cuc, "days < 1 || days > MAX_DEADLINE_DAYS", "days < 1 || days > MAX_DEADLINE_DAYS + 1", 'unit'),
 ('U28 le dernier jour de la fenêtre est exclu', cuc, "const to = addDays(today, days);", "const to = addDays(today, days - 1);", 'unit'),
 ('U29 une échéance d’aujourd’hui est exclue', cuc, "contract.end !== null && contract.end >= today &&", "contract.end !== null && contract.end > today &&", 'unit'),
 ('U30 les échéances ne sont plus triées par date', cuc, "a.date.localeCompare(b.date) ||", "b.date.localeCompare(a.date) ||", 'unit'),
 # --- Domaine des parcours
 ('J1 un titre de 151 caractères est accepté', jou, "if (value.length > 150) throw", "if (value.length > 151) throw", 'unit'),
 ('J2 un modèle peut avoir 31 tâches', jou, "export const MAX_TEMPLATE_TASKS = 30;", "export const MAX_TEMPLATE_TASKS = 31;", 'unit'),
 ('J3 une échéance de 366 jours est acceptée', jou, "Math.abs(offset as number) > MAX_OFFSET_DAYS", "Math.abs(offset as number) > MAX_OFFSET_DAYS + 1", 'unit'),
 ('J4 une échéance de 365 jours est refusée', jou, "Math.abs(offset as number) > MAX_OFFSET_DAYS", "Math.abs(offset as number) >= MAX_OFFSET_DAYS", 'unit'),
 ('J5 deux tâches de même titre sont acceptées', jou, "if (seen.has(key)) throw", "if (false) throw", 'unit'),
 ('J6 la casse distingue deux titres', jou, "const key = t.toLocaleLowerCase('fr');", "const key = t;", 'unit'),
 ('J7 un responsable hors liste est accepté', jou, "if (!TASK_OWNERS.includes(raw.owner as JourneyTaskOwner)) throw", "if (false) throw", 'unit'),
 ('J8 un modèle vide est accepté', jou, "if (!Array.isArray(input) || input.length === 0) throw", "if (!Array.isArray(input)) throw", 'unit'),
 ('J9 l’échéance relative est inversée', jou, "dueOn: addDays(input.referenceDate, t.dueOffsetDays)", "dueOn: addDays(input.referenceDate, -t.dueOffsetDays)", 'unit'),
 ('J10 un parcours annulé peut être coché', jou, "if (this.props.status !== 'ACTIVE') throw new DomainError('CONFLICT', this.props.status === 'CANCELLED' ?", "if (false) throw new DomainError('CONFLICT', this.props.status === 'CANCELLED' ?", 'unit'),
 ('J11 une tâche peut être cochée deux fois', jou, "if (task.doneAt) throw new DomainError('CONFLICT', 'La tâche est déjà cochée');", "if (false) throw new DomainError('CONFLICT', 'La tâche est déjà cochée');", 'unit'),
 ('J12 le parcours se termine dès la première tâche cochée', jou, "if (this.props.tasks.every((t) => t.doneAt))", "if (this.props.tasks.some((t) => t.doneAt))", 'unit'),
 ('J13 décocher ne rouvre pas un parcours terminé', jou, "if (this.props.status === 'COMPLETED') this.props = { ...this.props, status: 'ACTIVE', completedAt: null };", "", 'unit'),
 ('J14 un parcours annulé peut être décoché', jou, "reopen(taskId: string): void {\n    if (this.props.status === 'CANCELLED') throw", "reopen(taskId: string): void {\n    if (false) throw", 'unit'),
 ('J15 une tâche non cochée peut être décochée', jou, "if (!task.doneAt) throw new DomainError('CONFLICT', 'La tâche n’est pas cochée');", "if (false) throw new DomainError('CONFLICT', 'La tâche n’est pas cochée');", 'unit'),
 ('J16 décocher garde l’auteur de la coche', jou, "task.doneByUserId = null;", "", 'unit'),
 ('J17 cocher n’enregistre pas l’auteur', jou, "task.doneByUserId = by;", "task.doneByUserId = null;", 'unit'),
 ('J18 un parcours terminé peut être annulé', jou, "if (this.props.status !== 'ACTIVE') throw new DomainError('CONFLICT', 'Seul un parcours en cours peut être annulé');", "if (false) throw new DomainError('CONFLICT', 'Seul un parcours en cours peut être annulé');", 'unit'),
 ('J19 un parcours se lance sans tâche', jou, "if (input.template.length === 0) throw", "if (false) throw", 'unit'),
 ('J20 une nature de parcours inconnue est acceptée', jou, "if (!JOURNEY_KINDS.includes(input.kind)) throw", "if (false) throw", 'unit'),
 # --- Cas d'usage des parcours
 ('V1 un responsable voit les parcours de son équipe', juc, "if (read === Scope.All) return true;", "if (read !== null) return true;", 'unit'),
 ('V2 un employé voit le parcours de tout employé qui a un compte', juc, "return read !== null && employee.userId !== null && employee.userId === access.actorId;", "return read !== null && employee.userId !== null;", 'unit'),
 ('V3 la portée Équipe suffit pour gérer les parcours', juc, "scopeOf(access, 'hr.journey.manage') === Scope.All", "scopeOf(access, 'hr.journey.manage') !== null", 'unit'),
 ('V4 le droit de gérer les parcours n’est plus vérifié', juc, "if (!canManage(access)) throw", "if (false) throw", 'unit'),
 ('V5 les modèles se lisent sans portée Tous', juc, "if (scopeOf(query.access, 'hr.journey.read') !== Scope.All) throw", "if (false) throw", 'unit'),
 ('V6 une version périmée d’un modèle est acceptée', juc, "if (template.version !== command.version) throw", "if (false) throw", 'unit'),
 ('V7 un employé archivé reçoit un parcours', juc, "if (employee.isArchived) throw", "if (false) throw", 'unit'),
 ('V8 la fiche n’est plus verrouillée au lancement', juc, "await this.journeys.lockEmployee(employee.id);", "", 'unit'),
 ('V9 un second parcours de même nature en cours est accepté', juc, "if (await this.journeys.activeOf(employee.id, kind)) throw", "if (false) throw", 'unit'),
 ('V10 la date de référence par défaut est inversée', juc, "(kind === 'ONBOARDING' ? employee.hiredOn : today)", "(kind === 'ONBOARDING' ? today : employee.hiredOn)", 'unit'),
 ('V11 une version périmée d’un parcours est acceptée', juc, "if (journey.version !== command.version) throw", "if (false) throw", 'unit'),
 ('V12 rouvrir un parcours terminé ignore un autre parcours en cours', juc, "if (other && other.id !== journey.id) throw", "if (false) throw", 'unit'),
 ('V13 un parcours hors périmètre est dit interdit au lieu d’introuvable', juc, "if (!journey || !employee || !canView(query.access, employee)) throw", "if (!journey || !employee) throw", 'unit'),
 ('V14 la liste des parcours se lit sans droit', juc, "if (read === null) throw new DomainError('FORBIDDEN', \"Vous n'avez pas le droit de voir des parcours\");", "if (false) throw new DomainError('FORBIDDEN', \"Vous n'avez pas le droit de voir des parcours\");", 'unit'),
 ('V15 la portée Propre voit tous les parcours', juc, "} else if (read !== Scope.All) {", "} else if (false) {", 'unit'),
 ('V16 la taille de page des parcours n’est plus bornée', juc, "Math.min(MAX_PAGE_SIZE, Math.max(1, Math.floor(query.pageSize)))", "Math.min(MAX_PAGE_SIZE + 1, Math.max(1, Math.floor(query.pageSize)))", 'unit'),
 ('V17 une tâche dont l’échéance est aujourd’hui est en retard', jvw, "t.dueOn < today,", "t.dueOn <= today,", 'unit'),
 ('V18 une tâche d’un parcours annulé est en retard', jvw, "t.doneAt === null && journey.isActive && t.dueOn < today", "t.doneAt === null && t.dueOn < today", 'unit'),
 ('V19 l’auteur d’une coche n’est plus nommé', jvw, "doneByName: t.doneByUserId ? names.users.get(t.doneByUserId) ?? null : null,", "doneByName: null,", 'unit'),
 # --- Routes et lecture en base
 ('R1 les échéances exigent le droit de gérer au lieu de lire', cctl, "@Get('deadlines')\n  @Protected('hr.contract.read')", "@Get('deadlines')\n  @Protected('hr.contract.manage')", CON_DB),
 ('R2 les échéances ne sont plus déclarées avant l’identifiant', cctl, "@Get('deadlines')", "@Get('deadlines-x')", CON_DB),
 ('R3 les échéances incluent les contrats terminés', crepo, "where: { status: 'ACTIVE', OR: [", "where: { OR: [", CON_DB),
 ('R4 la liste des contrats ignore le filtre d’état', crepo, "...(query.status ? { status: query.status } : {}),", "", CON_DB),
 ('R5 la liste des contrats ignore le filtre d’employé', crepo, "...(query.employeeIds ? { employeeId: { in: [...query.employeeIds] } } : {}),", "", CON_DB),
 ('R6 un second contrat en cours est dit introuvable au lieu de conflit', crepo, "throw new DomainError('CONFLICT', 'Un contrat est déjà en cours pour cet employé');", "throw new DomainError('NOT_FOUND', 'Un contrat est déjà en cours pour cet employé');", CON_DB),
 ('R7 un modèle périmé écrase le modèle', jrepo, "where: { id: template.id, version: template.version }, data: { version: { increment: 1 } }", "where: { id: template.id }, data: { version: { increment: 1 } }", JOU_DB),
 ('R8 la liste des parcours ignore le filtre de nature', jrepo, "...(query.kind ? { kind: query.kind } : {}),", "", JOU_DB),
 ('R9 la coche n’est plus enregistrée en base', jrepo, "data: { doneAt: task.doneAt, doneByUserId: task.doneByUserId }", "data: { doneAt: null, doneByUserId: null }", JOU_DB),
 ('R10 le parcours déjà en cours est cherché sans l’état', jrepo, "where: { employeeId, kind, status: 'ACTIVE' }", "where: { employeeId, kind }", JOU_DB),
# R11 (retiré) : le tri des tâches en mémoire double l'ordre que la base rend déjà (index sur le parcours et l'ordre) ; sa suppression est sans effet observable (équivalent).
 ('R12 les parcours ne sont plus triés du plus récent au plus ancien', jrepo, "orderBy: [{ createdAt: 'desc' }, { id: 'asc' }]", "orderBy: [{ createdAt: 'asc' }, { id: 'asc' }]", JOU_DB),
 # --- Règles garanties par la base
 ('B1 plusieurs contrats en cours par employé sont permis', mig3a, "CREATE UNIQUE INDEX \"contracts_one_active_per_employee\" ON \"hr\".\"contracts\"(\"employee_id\") WHERE \"status\" = 'ACTIVE';", "CREATE INDEX \"contracts_one_active_per_employee\" ON \"hr\".\"contracts\"(\"employee_id\") WHERE \"status\" = 'ACTIVE';", CON_DB),
 ('B2 une fin avant le début est permise en base', mig3a, "CHECK (COALESCE(\"end_date\" IS NULL OR \"end_date\" >= \"start_date\", false));", "CHECK (true);", CON_DB),
 ('B3 une fin d’essai hors du contrat est permise en base', mig3a, "ADD CONSTRAINT \"contracts_probation_within\" CHECK (COALESCE(\"probation_end_date\" IS NULL OR (\"probation_end_date\" >= \"start_date\" AND (\"end_date\" IS NULL OR \"probation_end_date\" <= \"end_date\")), false));", "ADD CONSTRAINT \"contracts_probation_within\" CHECK (true);", CON_DB),
 ('B4 un contrat terminé sans motif est permis en base', mig3a, "OR (\"status\" = 'ENDED' AND \"ended_on\" IS NOT NULL AND \"end_reason\" IS NOT NULL AND", "OR (\"status\" = 'ENDED' AND \"ended_on\" IS NOT NULL AND", CON_DB),
 ('B5 un contrat en cours avec un motif est permis en base', mig3a, "(\"status\" = 'ACTIVE' AND \"ended_on\" IS NULL AND \"end_reason\" IS NULL)", "(\"status\" = 'ACTIVE' AND \"ended_on\" IS NULL)", CON_DB),
 ('B6 une fin effective avant le début est permise en base', mig3a, "AND \"ended_on\" >= \"start_date\" AND", "AND", CON_DB),
 ('B7 une fin effective après la fin prévue est permise en base', mig3a, "(\"end_date\" IS NULL OR \"ended_on\" <= \"end_date\")", "true", CON_DB),
 ('B8 un code de type mal formé est permis en base', mig3a, "CHECK (COALESCE(\"code\" ~ '^[A-Z][A-Z0-9_]{1,29}$', false));", "CHECK (true);", CON_DB),
 ('B9 un libellé de type vide est permis en base', mig3a, "ADD CONSTRAINT \"contract_types_label_not_blank\" CHECK (COALESCE(length(btrim(\"label\")) > 0, false));", "ADD CONSTRAINT \"contract_types_label_not_blank\" CHECK (true);", CON_DB),
 ('B10 un ordre de type hors bornes est permis en base', mig3a, "CHECK (COALESCE(\"sort_order\" >= 0 AND \"sort_order\" <= 10000, false));", "CHECK (true);", CON_DB),
 ('B11 plusieurs parcours en cours par employé et nature sont permis', mig3b, "CREATE UNIQUE INDEX \"journeys_one_active_per_employee_kind\"", "CREATE INDEX \"journeys_one_active_per_employee_kind\"", JOU_DB),
 ('B12 un parcours terminé sans date est permis en base', mig3b, "OR (\"status\" = 'COMPLETED' AND \"completed_at\" IS NOT NULL AND \"cancelled_at\" IS NULL)", "OR (\"status\" = 'COMPLETED' AND \"cancelled_at\" IS NULL)", JOU_DB),
 ('B13 un parcours en cours avec une date de fin est permis en base', mig3b, "(\"status\" = 'ACTIVE' AND \"completed_at\" IS NULL AND \"cancelled_at\" IS NULL)", "(\"status\" = 'ACTIVE' AND \"cancelled_at\" IS NULL)", JOU_DB),
 ('B14 une tâche cochée sans auteur est permise en base', mig3b, "CHECK ((\"done_at\" IS NULL) = (\"done_by_user_id\" IS NULL));", "CHECK (true);", JOU_DB),
 ('B15 une échéance de modèle hors bornes est permise en base', mig3b, "CHECK (COALESCE(\"due_offset_days\" >= -365 AND \"due_offset_days\" <= 365, false));", "CHECK (true);", JOU_DB),
 ('B16 un titre de tâche vide est permis en base', mig3b, "ADD CONSTRAINT \"journey_tasks_title_not_blank\" CHECK (COALESCE(length(btrim(\"title\")) > 0, false));", "ADD CONSTRAINT \"journey_tasks_title_not_blank\" CHECK (true);", JOU_DB),
 ('B17 plusieurs modèles par nature sont permis', mig3b, "CREATE UNIQUE INDEX \"journey_templates_kind_key\"", "CREATE INDEX \"journey_templates_kind_key\"", JOU_DB),
 ('B18 un contrat peut être supprimé avec son type', mig3a, "ADD CONSTRAINT \"contracts_contract_type_id_fkey\" FOREIGN KEY (\"contract_type_id\") REFERENCES \"hr\".\"contract_types\"(\"id\") ON DELETE RESTRICT", "ADD CONSTRAINT \"contracts_contract_type_id_fkey\" FOREIGN KEY (\"contract_type_id\") REFERENCES \"hr\".\"contract_types\"(\"id\") ON DELETE CASCADE", CON_DB),
 ('B19 les tâches d’un parcours suivent sa suppression', mig3b, "ADD CONSTRAINT \"journey_tasks_journey_id_fkey\" FOREIGN KEY (\"journey_id\") REFERENCES \"hr\".\"journeys\"(\"id\") ON DELETE RESTRICT", "ADD CONSTRAINT \"journey_tasks_journey_id_fkey\" FOREIGN KEY (\"journey_id\") REFERENCES \"hr\".\"journeys\"(\"id\") ON DELETE CASCADE", JOU_DB),
 # --- Droits des rôles
 ('D1 la RH ne gère plus les contrats', roles, "g('hr.contract.manage', All), g('hr.journey.read', All), g('hr.journey.manage', All),", "g('hr.journey.read', All), g('hr.journey.manage', All),", 'unit'),
 ('D2 la RH ne gère plus les parcours', roles, "g('hr.contract.manage', All), g('hr.journey.read', All), g('hr.journey.manage', All),", "g('hr.contract.manage', All), g('hr.journey.read', All),", 'unit'),
 ('D3 la Direction ne lit plus que ses propres contrats', roles, "g('hr.contract.read', All), g('hr.journey.read', All), g('hr.leave.create', Own),", "g('hr.contract.read', Own), g('hr.journey.read', All), g('hr.leave.create', Own),", 'unit'),
 ('D4 la Direction ne lit plus que ses propres parcours', roles, "g('hr.contract.read', All), g('hr.journey.read', All), g('hr.leave.create', Own),", "g('hr.contract.read', All), g('hr.journey.read', Own), g('hr.leave.create', Own),", 'unit'),
 # --- Interface : contrats
 ('W1 un contrat à durée déterminée peut ne pas avoir de fin', lc, "if (fixedTerm === true && !input.end)", "if (false && !input.end)", 'web'),
 ('W2 un contrat à durée indéterminée peut avoir une fin', lc, "if (fixedTerm === false && input.end)", "if (false && input.end)", 'web'),
 ('W3 une fin le jour du début est refusée', lc, "if (input.end && input.end < input.start)", "if (input.end && input.end <= input.start)", 'web'),
 ('W4 une fin d’essai le jour du début est refusée', lc, "if (input.probationEnd < input.start)", "if (input.probationEnd <= input.start)", 'web'),
 ('W5 une fin d’essai le jour de la fin est refusée', lc, "else if (input.end && input.probationEnd > input.end)", "else if (input.end && input.probationEnd >= input.end)", 'web'),
 ('W6 ajuster et terminer sont proposés sur un contrat terminé', lc, "return canManage && contract.status === 'ACTIVE' ? ['adjust', 'end'] : [];", "return canManage ? ['adjust', 'end'] : [];", 'web'),
 ('W7 ajuster et terminer sont proposés sans le droit', lc, "return canManage && contract.status === 'ACTIVE' ? ['adjust', 'end'] : [];", "return contract.status === 'ACTIVE' ? ['adjust', 'end'] : [];", 'web'),
 ('W8 une échéance dans 7 jours n’est plus rouge', lc, "if (daysLeft <= 7) return 'bad';", "if (daysLeft < 7) return 'bad';", 'web'),
 ('W9 une échéance dans 30 jours n’est plus orange', lc, "if (daysLeft <= 30) return 'warn';", "if (daysLeft < 30) return 'warn';", 'web'),
 ('W10 « Demain » n’est plus dit', lc, "if (daysLeft === 1) return 'Demain';", "", 'web'),
 ('W11 une fin effective le jour du début est refusée', lc, "else if (form.endedOn < contract.start)", "else if (form.endedOn <= contract.start)", 'web'),
 ('W12 une fin effective le jour de la fin prévue est refusée', lc, "else if (contract.end && form.endedOn > contract.end)", "else if (contract.end && form.endedOn >= contract.end)", 'web'),
 ('W13 le motif de fin n’est plus contrôlé', lc, "if (!END_REASONS.some((r) => r.code === form.reason))", "if (false)", 'web'),
 ('W14 la fin est envoyée aussi pour une durée indéterminée', lc, "...(contract.fixedTerm ? { end: form.end } : {})", "{ end: form.end }", 'web'),
 ('W15 une fin d’essai vide n’efface plus la date', lc, "probationEnd: form.probationEnd || null", "probationEnd: form.probationEnd || undefined", 'web'),
 ('W16 un code de type d’une lettre est accepté', lc, "/^[A-Z][A-Z0-9_]{1,29}$/", "/^[A-Z][A-Z0-9_]{0,29}$/", 'web'),
 ('W17 un ordre de 10 001 est accepté pour un type', lc, "order > 10_000", "order > 10_001", 'web'),
 ('W18 la création envoie une fin vide', lc, "...(form.end ? { end: form.end } : {}),", "end: form.end,", 'web'),
 ('W19 la liste des motifs perd « Autre »', lc, "  { code: 'OTHER', label: 'Autre' },\n", "", 'web'),
 # --- Interface : parcours
 ('X1 un autre que la RH peut cocher', lj, "if (!canManage || journey.status === 'CANCELLED') return null;", "if (journey.status === 'CANCELLED') return null;", 'web'),
 ('X2 une tâche d’un parcours annulé peut être décochée', lj, "if (!canManage || journey.status === 'CANCELLED') return null;", "if (!canManage) return null;", 'web'),
 ('X3 une tâche d’un parcours terminé peut être cochée', lj, "return journey.status === 'ACTIVE' ? 'check' : null;", "return 'check';", 'web'),
 ('X4 un parcours terminé peut être annulé', lj, "canManage && journey.status === 'ACTIVE'", "canManage", 'web'),
 ('X5 le pourcentage est arrondi par excès', lj, "Math.round((p.done / p.total) * 100)", "Math.ceil((p.done / p.total) * 100)", 'web'),
 ('X6 « 1 jour » prend un s', lj, "n > 1 ? 's' : ''", "n >= 1 ? 's' : ''", 'web'),
 ('X7 « avant » et « après » sont inversés', lj, "days < 0 ? 'avant' : 'après'", "days < 0 ? 'après' : 'avant'", 'web'),
 ('X8 un modèle de 31 tâches est accepté', lj, "else if (rows.length > MAX_TEMPLATE_TASKS)", "else if (rows.length > MAX_TEMPLATE_TASKS + 1)", 'web'),
 ('X9 une échéance de 365 jours est refusée', lj, "Math.abs(n) > MAX_OFFSET_DAYS", "Math.abs(n) >= MAX_OFFSET_DAYS", 'web'),
 ('X10 deux titres identiques sont acceptés', lj, "if (seen.has(key)) out[i].title = 'Ce titre figure déjà dans la liste.';", "", 'web'),
 ('X11 la casse distingue deux titres', lj, "const key = title.toLocaleLowerCase('fr');", "const key = title;", 'web'),
 ('X12 un titre de 151 caractères est accepté', lj, "else if (title.length > 150)", "else if (title.length > 151)", 'web'),
 ('X13 monter la première tâche déplace une autre', lj, "if (index < 0 || index >= rows.length || target < 0 || target >= rows.length) return [...rows];", "if (index < 0 || index >= rows.length) return [...rows];", 'web'),
 ('X14 les clés des lignes ne sont plus uniques', lj, "export const newRowKey = (): string => `row-${++counter}`;", "export const newRowKey = (): string => `row-${counter}`;", 'web'),
 ('X15 le corps d’un modèle ne nettoie plus les titres', lj, "tasks: rows.map((r) => ({ title: r.title.trim().replace(/\\s+/g, ' '), owner: r.owner, dueOffsetDays: Number(r.offset) })),", "tasks: rows.map((r) => ({ title: r.title, owner: r.owner, dueOffsetDays: Number(r.offset) })),", 'web'),
 ('X16 le lancement n’exige plus l’employé', lj, "if (!form.employeeId) errors.employeeId = 'Choisissez l’employé.';", "", 'web'),
 ('X17 une nature inconnue est acceptée au lancement', lj, "if (form.kind !== 'ONBOARDING' && form.kind !== 'OFFBOARDING') errors.kind", "if (false) errors.kind", 'web'),
 ('X18 une date de référence impossible est acceptée', lj, "|| date.toISOString().slice(0, 10) !== form.referenceDate) errors.referenceDate", "|| false) errors.referenceDate", 'web'),
 # --- Interface : menu et écrans
 ('Y1 les échéances sont proposées à qui lit seulement', lm, "href: '/hr/contracts/deadlines', permission: 'hr.contract.manage', allScope: true }", "href: '/hr/contracts/deadlines', permission: 'hr.contract.manage' }", 'web'),
 ('Y2 les modèles sont proposés à qui lit seulement', lm, "href: '/hr/journeys/templates', permission: 'hr.journey.manage', allScope: true }", "href: '/hr/journeys/templates', permission: 'hr.journey.manage' }", 'web'),
 ('Y3 le menu des contrats exige le droit de gérer', lm, "href: '/hr/contracts', permission: 'hr.contract.read' }", "href: '/hr/contracts', permission: 'hr.contract.manage' }", 'web'),
 ('Y4 le menu des parcours exige le droit de gérer', lm, "href: '/hr/journeys', permission: 'hr.journey.read' }", "href: '/hr/journeys', permission: 'hr.journey.manage' }", 'web'),
 ('Y5 l’écran des contrats propose « Nouveau contrat » à qui lit seulement', pc, "const canManage = canAll(profile, 'hr.contract.manage');", "const canManage = canAll(profile, 'hr.contract.read');", 'web'),
 ('Y6 l’écran des parcours propose « Lancer » à qui lit seulement', pj, "const canManage = canAll(profile, 'hr.journey.manage');", "const canManage = canAll(profile, 'hr.journey.read');", 'web'),
 ('Y7 l’écran d’un parcours laisse cocher à qui lit seulement', pjd, "const canManage = canAll(profile, 'hr.journey.manage');", "const canManage = canAll(profile, 'hr.journey.read');", 'web'),
]
only = sys.argv[1:]
if only:
    M = [m for m in M if m[0].split(' ')[0] in only]
env = dict(os.environ, TEST_DB_PORT='54482')
SPECS = {
    con: 'src/modules/hr/domain/contract.spec.ts src/modules/hr/application/contract-use-cases.spec.ts',
    cuc: 'src/modules/hr/application/contract-use-cases.spec.ts',
    jou: 'src/modules/hr/domain/journey.spec.ts src/modules/hr/application/journey-use-cases.spec.ts',
    juc: 'src/modules/hr/application/journey-use-cases.spec.ts',
    jvw: 'src/modules/hr/application/journey-use-cases.spec.ts',
    roles: 'src/modules/iam/domain/roles.spec.ts',
}
WEB = 'pnpm exec vitest run test/rh-3c.test.ts test/n1-navigation.test.ts test/s38.test.ts'


def read(path):
    raw = open(path, 'rb').read()
    return raw, raw.decode('utf8')


if os.environ.get('DRY'):
    bad = 0
    for name, path, a, b, kind in M:
        text = read(path)[1].replace('\r\n', '\n')
        n = text.count(a)
        if n != 1 or a == b:
            bad += 1
        print(name, 'ok' if n == 1 else f'MOTIF {n}')
    print('MOTIFS INVALIDES' if bad else 'tous les motifs sont uniques', bad)
    sys.exit(0)


def run(kind, path):
    if kind == 'unit':
        out = subprocess.run('pnpm exec jest --runInBand --silent ' + SPECS[path], cwd=api, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True, timeout=900, shell=True).stdout
    elif kind == 'web':
        out = subprocess.run(WEB, cwd=web, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True, timeout=600, shell=True).stdout
        lines = [l for l in out.splitlines() if l.strip().startswith('Tests')]
        assert lines, 'run inconclusive: ' + out[-300:]
        # Une suite qui ne compile plus (« no tests », « Test Files … failed ») est aussi une faute détectée.
        files = [l for l in out.splitlines() if l.strip().startswith('Test Files')]
        return ' failed' in lines[-1] or 'no tests' in lines[-1] or any(' failed' in l for l in files)
    else:
        out = subprocess.run(['node', 'scripts/test-db.mjs', '--tests=' + kind.split(':')[1]], cwd=api, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True, timeout=800, env=env).stdout
    lines = [l for l in out.splitlines() if l.startswith('Tests:')]
    assert lines, 'run inconclusive: ' + out[-300:]
    # Une suite qui ne compile plus (le vérificateur de types refuse la faute) est aussi une faute détectée.
    return ' failed' in lines[-1] or any(l.startswith('Test Suites:') and ' failed' in l for l in out.splitlines())


res = []
for name, path, a, b, kind in M:
    raw, s = read(path)
    crlf = '\r\n' in s
    text = s.replace('\r\n', '\n')
    if text.count(a) != 1:
        print(name, 'MOTIF', text.count(a), flush=True)
        res.append((name, None))
        continue
    mutated = text.replace(a, b)
    open(path, 'wb').write((mutated.replace('\n', '\r\n') if crlf else mutated).encode('utf8'))
    try:
        killed = run(kind, path)
    except AssertionError as e:
        print(name, 'INCONCLUANT', str(e)[:200], flush=True)
        killed = None
    finally:
        open(path, 'wb').write(raw)
    res.append((name, killed))
    print(name, {True: 'TUÉ', False: 'SURVIVANT', None: 'INCONCLUANT'}[killed], flush=True)
print('BILAN', sum(1 for _, k in res if k), '/', len(res), 'tués ;', [n for n, k in res if k is False], 'survivants ;', [n for n, k in res if k is None], 'inconcluants')
