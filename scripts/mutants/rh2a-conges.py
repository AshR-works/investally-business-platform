from pathlib import Path
# Racine du dépôt : ce script se trouve dans scripts/mutants/.
REPO = Path(__file__).resolve().parents[2]
import subprocess, os, sys
api = str(REPO / 'apps' / 'api')
hr = os.path.join(api, 'src', 'modules', 'hr')
cal = os.path.join(hr, 'domain', 'leave-calendar.ts')
req = os.path.join(hr, 'domain', 'leave-request.ts')
cfg = os.path.join(hr, 'domain', 'leave-config.ts')
uc = os.path.join(hr, 'application', 'leave-use-cases.ts')
repo = os.path.join(hr, 'infrastructure', 'prisma-leave.repositories.ts')
mig = os.path.join(api, 'prisma', 'migrations', '20261117000000_rh_2a_leave', 'migration.sql')
roles = os.path.join(api, 'src', 'modules', 'iam', 'domain', 'roles.ts')
DB = 'db:hr-leave-http'
M = [
 # --- Calendrier (domaine pur)
 ('C1 une date irréelle est acceptée', cal, "return m !== null && new Date(Date.UTC(+m[1]!, +m[2]! - 1, +m[3]!)).toISOString().slice(0, 10) === text;", "return m !== null;", 'cal'),
 ('C2 le dimanche compte', cal, "  if (weekday === 0) return false;\n", "", 'cal'),
 ('C3 le samedi compte toujours', cal, "if (weekday === 6 && !rules.countsSaturday) return false;", "if (false) return false;", 'cal'),
 ('C4 les jours fériés comptent', cal, "return !rules.holidays.has(iso);", "return true;", 'cal'),
 ('C5 une fin avant le début est acceptée', cal, "if (period.end < period.start) throw", "if (false) throw", 'cal'),
 ('C6 la durée maximale d’une demande est ignorée', cal, "- dayOrdinal(period.start) + 1 > MAX_LEAVE_SPAN_DAYS", "- dayOrdinal(period.start) + 1 > 100000", 'cal'),
 ('C7 une journée « après-midi et midi » est acceptée', cal, "if (period.start === period.end && period.startHalf && period.endHalf) {", "if (false) {", 'cal'),
 ('C8 commencer l’après-midi ne retire rien', cal, "if (period.startHalf && isWorkingDay(period.start, rules)) days -= 0.5;", "if (period.startHalf && isWorkingDay(period.start, rules)) days -= 0;", 'cal'),
 ('C9 finir à midi ne retire rien', cal, "if (period.endHalf && isWorkingDay(period.end, rules)) days -= 0.5;", "if (period.endHalf && isWorkingDay(period.end, rules)) days -= 0;", 'cal'),
 ('C10 une demi-journée sur un jour non ouvré retire quand même', cal, "if (period.startHalf && isWorkingDay(period.start, rules)) days -= 0.5;", "if (period.startHalf) days -= 0.5;", 'cal'),
 ('C11 l’après-midi de début n’est pas numérotée', cal, "(period.startHalf ? 1 : 0), last:", "(period.startHalf ? 0 : 0), last:", 'cal'),
 ('C12 l’après-midi de fin n’est pas numérotée', cal, "(period.endHalf ? 0 : 1) };", "(period.endHalf ? 1 : 1) };", 'cal'),
 ('C13 deux périodes jointives se chevauchent', cal, "return x.first <= y.last && y.first <= x.last;", "return x.first < y.last && y.first < x.last;", 'cal'),
 ('C14 le mois entamé jusqu’au dernier jour ne compte pas', cal, "while (addMonths(start, months + 1) <= endExclusive) months += 1;", "while (addMonths(start, months + 1) < endExclusive) months += 1;", 'cal'),
 ('C15 la date d’entrée est ignorée dans l’année', cal, "const start = hiredOn > yearStart ? hiredOn : yearStart;", "const start = yearStart;", 'cal'),
 ('C16 la date de sortie est ignorée', cal, "const lastDay = leftOn !== null && leftOn < yearEnd ? leftOn : yearEnd;", "const lastDay = yearEnd;", 'cal'),
 ('C17 un 31 ne se prolonge pas en fin de mois', cal, "Math.min(+m[3]!, lastDay)", "+m[3]!", 'cal'),
 ('C18 les droits ne sont pas arrondis', cal, "return Math.round(monthsOfService(hiredOn, leftOn, year) * accrualPerMonth * 100) / 100;", "return monthsOfService(hiredOn, leftOn, year) * accrualPerMonth;", 'cal'),
 ('C19 les jours en attente augmentent le solde', cal, "input.entitlement + input.adjustments - input.taken - input.pending", "input.entitlement + input.adjustments - input.taken + input.pending", 'cal'),
 ('C20 le solde n’est pas arrondi', cal, "available: round2(input.entitlement + input.adjustments - input.taken - input.pending)", "available: input.entitlement + input.adjustments - input.taken - input.pending", 'cal'),
 # --- Demande (agrégat)
 ('R1 une demande saisie par la RH reste en attente', req, "status: approved ? LeaveStatus.Approved : LeaveStatus.Pending,", "status: LeaveStatus.Pending,", 'req'),
 ('R2 une durée absurde est acceptée', req, "if (!(input.days > 0) || input.days * 2 !== Math.round(input.days * 2)) throw", "if (false) throw", 'req'),
 ('R3 des identifiants non UUID sont acceptés', req, "if (!UUID.test(input.employeeId) || !UUID.test(input.leaveTypeId)) throw", "if (false) throw", 'req'),
 ('R4 une demande décidée se valide encore', req, "if (this.props.status !== LeaveStatus.Pending) throw new DomainError('CONFLICT', \"Seule une demande en attente peut être validée\");", "if (false) throw new DomainError('CONFLICT', \"Seule une demande en attente peut être validée\");", 'req'),
 ('R5 le motif de refus est facultatif', req, "const note = requiredText(input.note, 'Le motif du refus');", "const note = optionalText(input.note, 'Le motif du refus') ?? '';", 'req'),
 ('R6 une demande décidée se refuse encore', req, "if (this.props.status !== LeaveStatus.Pending) throw new DomainError('CONFLICT', 'Seule une demande en attente peut être refusée');", "if (false) throw new DomainError('CONFLICT', 'Seule une demande en attente peut être refusée');", 'req'),
 ('R7 une demande terminée s’annule encore', req, "if (this.props.status !== LeaveStatus.Pending && this.props.status !== LeaveStatus.Approved) throw", "if (false) throw", 'req'),
 ('R8 le motif d’annulation d’une demande validée est facultatif', req, "? requiredText(input.reason", "? optionalText(input.reason", 'req'),
 ('R9 l’année de congé est celle de la fin', req, "Number(this.props.start.slice(0, 4))", "Number(this.props.end.slice(0, 4))", 'req'),
 ('R10 la longueur du motif n’est pas limitée', req, "if (value.length > 500) throw new DomainError('VALIDATION', `${label} ne peut dépasser 500 caractères`);", "if (value.length > 50000) throw new DomainError('VALIDATION', `${label} ne peut dépasser 500 caractères`);", 'req'),
 ('R11 une demande validée n’est plus « en cours »', req, "return this.props.status === LeaveStatus.Pending || this.props.status === LeaveStatus.Approved; }", "return this.props.status === LeaveStatus.Pending; }", 'req'),
 # --- Règles, types, jours fériés, ajustements
 ('K1 jours par mois illimités', cfg, "value < 0 || value > 5", "value < 0 || value > 50", 'cfg'),
 ('K2 jours par mois au-delà du centième', cfg, " || Math.round(value * 100) !== value * 100) {", ") {", 'cfg'),
 ('K3 le code du type n’est pas mis en majuscules', cfg, "(input.code ?? '').trim().toUpperCase()", "(input.code ?? '').trim()", 'cfg'),
 ('K4 un code d’un seul caractère est accepté', cfg, "const CODE = /^[A-Z][A-Z0-9_]{1,29}$/;", "const CODE = /^[A-Z][A-Z0-9_]{0,29}$/;", 'cfg'),
 ('K5 un plafond hors demi-journée est accepté', cfg, " || raw * 2 !== Math.round(raw * 2)) {", ") {", 'cfg'),
 ('K6 le libellé du type n’est pas limité', cfg, "if (value.length > 100) throw new DomainError('VALIDATION', 'Le libellé ne peut dépasser 100 caractères');", "if (value.length > 100000) throw new DomainError('VALIDATION', 'Le libellé ne peut dépasser 100 caractères');", 'cfg'),
 ('K7 l’ordre d’affichage n’est pas borné', cfg, "changes.sortOrder > 10_000", "changes.sortOrder > 10_000_000", 'cfg'),
 ('K8 un jour férié irréel est accepté', cfg, "if (!isIsoDate((input.day ?? '').trim())) throw", "if (false) throw", 'cfg'),
 ('K9 un ajustement nul est accepté', cfg, "input.days === 0 || ", "", 'cfg'),
 ('K10 un ajustement énorme est accepté', cfg, "Math.abs(input.days) > 60", "Math.abs(input.days) > 6000", 'cfg'),
 ('K11 une année absurde est acceptée pour un ajustement', cfg, "input.year < 2000 || input.year > 2100) throw new DomainError('VALIDATION', \"L'année", "input.year < 1000 || input.year > 2100) throw new DomainError('VALIDATION', \"L'année", 'cfg'),
 ('K12 le motif d’un ajustement est facultatif', cfg, "if (!reason) throw new DomainError('VALIDATION', \"Le motif de l'ajustement est obligatoire\");", "if (false) throw new DomainError('VALIDATION', \"Le motif de l'ajustement est obligatoire\");", 'cfg'),
 ('K13 le taux de départ n’est pas 1,5 jour par mois', cfg, "export const DEFAULT_LEAVE_SETTINGS: LeaveSettings = { accrualDaysPerMonth: 1.5,", "export const DEFAULT_LEAVE_SETTINGS: LeaveSettings = { accrualDaysPerMonth: 2,", 'cfg'),
 # --- Cas d'usage : droits et portée
 ('U1 la RH ne voit plus toutes les demandes', uc, "if (read === Scope.All) return true;", "if (false) return true;", 'uc'),
 ('U2 tout lecteur voit les demandes de tous', uc, "if (read !== null && employee.userId === access.actorId) return true;", "if (read !== null) return true;", 'uc'),
 ('U3 le responsable ne voit plus l’équipe', uc, "return scopeOf(access, 'hr.leave.approve') !== null && actorEmployee !== null && employee.managerEmployeeId === actorEmployee.id;", "return false;", 'uc'),
 ('U4 on valide sa propre demande', uc, "if (employee.userId === access.actorId) return false;\n  const approve", "if (false) return false;\n  const approve", 'uc'),
 ('U5 la RH ne valide plus', uc, "if (approve === Scope.All) return true;\n  return actorEmployee !== null && employee.managerEmployeeId === actorEmployee.id;", "if (false) return true;\n  return actorEmployee !== null && employee.managerEmployeeId === actorEmployee.id;", 'uc'),
 ('U6 tout détenteur du droit valide pour n’importe qui', uc, "if (approve === Scope.All) return true;\n  return actorEmployee !== null && employee.managerEmployeeId === actorEmployee.id;", "if (approve === Scope.All) return true;\n  return actorEmployee !== null;", 'uc'),
 ('U7 paramétrer ne demande plus la portée Tous', uc, "scopeOf(access, 'hr.leave.manage') === Scope.All", "scopeOf(access, 'hr.leave.manage') !== null", 'uc'),
 # --- Demander
 ('U8 demander sans le droit', uc, "if (create === null) throw new DomainError('FORBIDDEN', \"Vous n'avez pas le droit de demander une absence\");", "if (false) throw new DomainError('FORBIDDEN', \"Vous n'avez pas le droit de demander une absence\");", 'uc'),
 ('U9 demander pour un autre employé', uc, "if (!employee || !(create === Scope.All || employee.userId === command.access.actorId)) throw new DomainError('NOT_FOUND', 'Employé introuvable');", "if (!employee) throw new DomainError('NOT_FOUND', 'Employé introuvable');", 'uc'),
 ('U10 absence saisie pour un employé archivé', uc, "if (employee.isArchived) throw new DomainError('CONFLICT', \"L'employé est archivé : aucune absence ne peut lui être saisie\");", "if (false) throw new DomainError('CONFLICT', \"L'employé est archivé : aucune absence ne peut lui être saisie\");", 'uc'),
 ('U11 un type désactivé se demande encore', uc, "if (!type || !type.active) throw", "if (!type) throw", 'uc'),
 ('U12 demi-journées malgré la règle', uc, "if (!settings.allowHalfDays && (startHalf || endHalf)) throw", "if (false) throw", 'uc'),
 ('U13 une demande sans jour décompté est acceptée', uc, "if (days <= 0) throw new DomainError('VALIDATION', 'Aucun jour décompté", "if (false) throw new DomainError('VALIDATION', 'Aucun jour décompté", 'uc'),
 ('U14 le plafond du type est ignoré', uc, "if (type.maxDaysPerRequest !== null && days > type.maxDaysPerRequest) throw", "if (false) throw", 'uc'),
 ('U15 une demande dans le passé est acceptée', uc, "if (command.start < todayOf(this.clock) && !canManage(command.access)) throw", "if (false && !canManage(command.access)) throw", 'uc'),
 ('U16 une demande avant l’entrée est acceptée', uc, "if (command.start < employee.hiredOn) throw", "if (false) throw", 'uc'),
 ('U17 la fiche de l’employé n’est pas verrouillée', uc, "      await this.requests.lockEmployee(employee.id);\n      const overlapping = await this.requests.findActiveOverlapping(employee.id, command.start, command.end);", "      const overlapping = await this.requests.findActiveOverlapping(employee.id, command.start, command.end);", 'uc'),
 ('U18 un chevauchement est accepté', uc, "if (overlapping.some((other) => periodsOverlap(period, other.period))) throw new DomainError('CONFLICT', 'Une demande couvre déjà", "if (false) throw new DomainError('CONFLICT', 'Une demande couvre déjà", 'uc'),
 ('U19 le solde n’est pas contrôlé à la demande', uc, "if (type.deductsBalance && !settings.allowNegativeBalance) {\n        const { available } = await balanceOf(", "if (false) {\n        const { available } = await balanceOf(", 'uc'),
 ('U20 le solde ne peut pas être épuisé exactement', uc, "if (days > available) throw new DomainError('INVARIANT_VIOLATION', `Solde insuffisant : ${available} jour(s) disponible(s), ${days} demandé(s)`);\n      }\n\n      // Saisie", "if (days >= available) throw new DomainError('INVARIANT_VIOLATION', `Solde insuffisant : ${available} jour(s) disponible(s), ${days} demandé(s)`);\n      }\n\n      // Saisie", 'uc'),
 ('U21 la demande de la RH pour un autre n’est pas validée d’emblée', uc, "? command.access.actorId : null;\n      const request", "? null : null;\n      const request", 'uc'),
 ('U22 la RH qui demande pour elle-même est validée d’emblée', uc, "const forSomeoneElse = employee.userId !== command.access.actorId;", "const forSomeoneElse = true;", 'uc'),
 ('U55 la création d’une demande n’est pas auditée', uc, "action: AuditAction.Create, newValue: { ...view } });\n      return view;\n    });\n  }\n}\n\nexport interface DecideLeaveCommand", "action: AuditAction.Create, newValue: {} });\n      return view;\n    });\n  }\n}\n\nexport interface DecideLeaveCommand", 'uc'),
 # --- Décider
 ('U23 la version d’une décision n’est pas contrôlée', uc, "if (request.version !== command.version) throw new DomainError('CONFLICT', 'La demande a été modifiée par un autre utilisateur : rechargez-la');\n      const before = toLeaveRequestView(request, { employee: employee.fullName, type: (await", "if (false) throw new DomainError('CONFLICT', 'La demande a été modifiée par un autre utilisateur : rechargez-la');\n      const before = toLeaveRequestView(request, { employee: employee.fullName, type: (await", 'uc'),
 ('U24 n’importe qui décide', uc, "if (!canApprove(command.access, employee, mine)) throw new DomainError('FORBIDDEN', 'Vous ne pouvez pas valider ou refuser cette demande');", "if (false) throw new DomainError('FORBIDDEN', 'Vous ne pouvez pas valider ou refuser cette demande');", 'uc'),
 ('U25 une demande étrangère est « interdite » plutôt qu’« introuvable »', uc, "if (!request || !employee || !canView(command.access, employee, mine)) throw new DomainError('NOT_FOUND', NOT_FOUND);\n      if (!canApprove", "if (!request || !employee) throw new DomainError('NOT_FOUND', NOT_FOUND);\n      if (!canApprove", 'uc'),
 ('U26 le chevauchement n’est pas revérifié à la validation', uc, "if (overlapping.some((other) => periodsOverlap(request.period, other.period))) throw new DomainError('INVARIANT_VIOLATION'", "if (false) throw new DomainError('INVARIANT_VIOLATION'", 'uc'),
 ('U27 le solde n’est pas revérifié à la validation', uc, "if (type?.deductsBalance && !settings.allowNegativeBalance) {", "if (false) {", 'uc'),
 ('U28 la demande est comptée deux fois à la validation', uc, "employee, request.year, request.id);", "employee, request.year);", 'uc'),
 ('U29 le refus n’existe plus', uc, "if (command.decision === 'REJECT') {", "if (false) {", 'uc'),
 # --- Annuler
 ('U30 l’employé annule une demande validée le jour même', uc, "request.status === LeaveStatus.Approved && request.start > today", "request.status === LeaveStatus.Approved && request.start >= today", 'uc'),
 ('U31 n’importe qui annule', uc, "if (!ownCanCancel && !canManage(command.access)) {", "if (false) {", 'uc'),
 ('U32 tout lecteur est « l’employé » pour annuler', uc, "const own = employee.userId === command.access.actorId && scopeOf(command.access, 'hr.leave.create') !== null;", "const own = true;", 'uc'),
 ('U33 la version d’une annulation n’est pas contrôlée', uc, "if (request.version !== command.version) throw new DomainError('CONFLICT', 'La demande a été modifiée par un autre utilisateur : rechargez-la');\n      const typeLabel", "if (false) throw new DomainError('CONFLICT', 'La demande a été modifiée par un autre utilisateur : rechargez-la');\n      const typeLabel", 'uc'),
 # --- Lire, lister, solde, calendrier
 ('U34 toutes les demandes sont listées à tous', uc, "if (scopeOf(query.access, 'hr.leave.read') !== Scope.All) throw new DomainError('FORBIDDEN', \"Vous n'avez pas le droit de voir toutes les demandes\");", "if (false) throw new DomainError('FORBIDDEN', \"Vous n'avez pas le droit de voir toutes les demandes\");", 'uc'),
 ('U35 l’équipe est celle qui n’est PAS la sienne', uc, ".filter((e) => e.managerEmployeeId === mine.id)", ".filter((e) => e.managerEmployeeId !== mine.id)", 'uc'),
 ('U36 sans fiche, on voit toutes les demandes', uc, "employeeIds = mine ? [mine.id] : [];", "employeeIds = mine ? [mine.id] : undefined;", 'uc'),
 ('U37 la taille de page n’est pas bornée', uc, "Math.min(MAX_PAGE_SIZE, ", "Math.min(100000, ", 'uc'),
 ('U38 l’année du solde par défaut est fausse', uc, "const year = query.year ?? Number(todayOf(this.clock).slice(0, 4));", "const year = query.year ?? 2000;", 'uc'),
 ('U39 le solde d’un autre employé est lisible', uc, "if (!employee || !canView(query.access, employee, mine)) throw new DomainError('NOT_FOUND', 'Employé introuvable');\n    const year", "if (!employee) throw new DomainError('NOT_FOUND', 'Employé introuvable');\n    const year", 'uc'),
 ('U40 le calendrier est lisible sans le droit', uc, "if (scopeOf(query.access, 'hr.leave.read') === null) throw new DomainError('FORBIDDEN', \"Vous n'avez pas le droit de voir le calendrier\");", "if (false) throw new DomainError('FORBIDDEN', \"Vous n'avez pas le droit de voir le calendrier\");", 'uc'),
 ('U41 la période du calendrier n’est pas bornée', uc, "> MAX_CALENDAR_DAYS", "> 100000", 'uc'),
 ('U42 chacun choisit le service du calendrier', uc, "const department = wide ? query.department?.trim() || null : mine?.department ?? null;", "const department = query.department?.trim() || null;", 'uc'),
 ('U43 un collègue voit le type d’absence', uc, "leaveTypeLabel: canView(query.access, employee, mine) ? labels.get(request.leaveTypeId) ?? null : null,", "leaveTypeLabel: labels.get(request.leaveTypeId) ?? null,", 'uc'),
 ('U53 le solde ignore la date de sortie', uc, "annualEntitlement(employee.hiredOn, employee.leftOn, year, settings.accrualDaysPerMonth)", "annualEntitlement(employee.hiredOn, null, year, settings.accrualDaysPerMonth)", 'uc'),
 ('U54 le solde compte la demande qu’on décide', uc, "deps.requests.sumDays(employee.id, year, excludeId)", "deps.requests.sumDays(employee.id, year)", 'uc'),
 # --- Paramétrage
 ('U44 les types désactivés sont visibles de tous', uc, "query.includeInactive === true && canManage(query.access);", "query.includeInactive === true;", 'uc'),
 ('U45 paramétrer sans le droit', uc, "if (!canManage(access)) throw new DomainError('FORBIDDEN', \"Vous n'avez pas le droit de paramétrer les absences\");", "if (false) throw new DomainError('FORBIDDEN', \"Vous n'avez pas le droit de paramétrer les absences\");", 'uc'),
 ('U46 deux types de même code', uc, "if (await this.config.findTypeByCode(type.code)) throw new DomainError('CONFLICT'", "if (false) throw new DomainError('CONFLICT'", 'uc'),
 ('U47 la version d’un type n’est pas contrôlée', uc, "if (type.version !== command.version) throw new DomainError('CONFLICT', \"Le type d'absence a été modifié", "if (false) throw new DomainError('CONFLICT', \"Le type d'absence a été modifié", 'uc'),
 ('U48 la version des règles n’est pas contrôlée', uc, "if (current.version !== command.version) throw new DomainError('CONFLICT', 'Les règles de congés ont été modifiées", "if (false) throw new DomainError('CONFLICT', 'Les règles de congés ont été modifiées", 'uc'),
 ('U49 les règles ne sont pas validées', uc, "      validateLeaveSettings(command);\n", "", 'uc'),
 ('U50 deux jours fériés à la même date', uc, "if (await this.config.findHolidayByDay(valid.day)) throw", "if (false) throw", 'uc'),
 ('U51 un ajustement pour un employé inconnu', uc, "if (!employee) throw new DomainError('NOT_FOUND', 'Employé introuvable');\n      const adjustment", "const adjustment", 'uc'),
 ('U52 l’auteur de l’ajustement n’est pas conservé', uc, "createdByUserId: command.access.actorId, createdAt: this.clock.now() };", "createdByUserId: 'inconnu', createdAt: this.clock.now() };", 'uc'),
 # --- Base de données et persistance
 ('B1 dates inversées acceptées par la base', mig, "CHECK (COALESCE(\"end_date\" >= \"start_date\", false))", "CHECK (true)", DB),
 ('B2 jours invalides acceptés par la base', mig, "CHECK (COALESCE(\"days\" > 0 AND \"days\" * 2 = round(\"days\" * 2) AND \"days\" <= (\"end_date\" - \"start_date\" + 1), false))", "CHECK (true)", DB),
 ('B3 une journée « après-midi et midi » acceptée par la base', mig, "CHECK (COALESCE(NOT (\"start_date\" = \"end_date\" AND \"start_half\" AND \"end_half\"), false))", "CHECK (true)", DB),
 ('B4 année de congé incohérente acceptée par la base', mig, "CHECK (COALESCE(\"leave_year\" = EXTRACT(YEAR FROM \"start_date\")::int, false))", "CHECK (true)", DB),
 ('B5 état et dates incohérents acceptés par la base', mig, "OR (\"status\" = 'CANCELLED' AND \"cancelled_at\" IS NOT NULL), false));", "OR true, false));", DB),
 ('B6 ajustement invalide accepté par la base', mig, "CHECK (COALESCE(\"days\" <> 0 AND abs(\"days\") <= 60 AND \"days\" * 2 = round(\"days\" * 2), false))", "CHECK (true)", DB),
 ('B7 motif d’ajustement vide accepté par la base', mig, "CHECK (COALESCE(length(btrim(\"reason\")) > 0, false))", "CHECK (true)", DB),
 ('B8 année d’ajustement absurde acceptée par la base', mig, "CHECK (\"year\" BETWEEN 2000 AND 2100)", "CHECK (true)", DB),
 ('B9 code de type mal formé accepté par la base', mig, "CHECK (COALESCE(\"code\" ~ '^[A-Z][A-Z0-9_]{1,29}$', false))", "CHECK (true)", DB),
 ('B10 plafond de type absurde accepté par la base', mig, "CHECK (COALESCE(\"max_days_per_request\" IS NULL OR (\"max_days_per_request\" > 0 AND \"max_days_per_request\" * 2 = round(\"max_days_per_request\" * 2)), false))", "CHECK (true)", DB),
 ('B11 deux lignes de règles acceptées par la base', mig, "CHECK (\"id\" = 1)", "CHECK (true)", DB),
 ('B12 taux d’acquisition absurde accepté par la base', mig, "CHECK (COALESCE(\"accrual_days_per_month\" >= 0 AND \"accrual_days_per_month\" <= 5, false))", "CHECK (true)", DB),
 ('B13 libellé de jour férié vide accepté par la base', mig, "ADD CONSTRAINT \"public_holidays_label_not_blank\" CHECK (COALESCE(length(btrim(\"label\")) > 0, false))", "ADD CONSTRAINT \"public_holidays_label_not_blank\" CHECK (true)", DB),
 ('B14 deux jours fériés à la même date acceptés par la base', mig, "CREATE UNIQUE INDEX \"public_holidays_day_key\"", "CREATE INDEX \"public_holidays_day_key\"", DB),
 ('B15 deux types de même code acceptés par la base', mig, "CREATE UNIQUE INDEX \"leave_types_code_key\"", "CREATE INDEX \"leave_types_code_key\"", DB),
 ('B16 un employé qui a des demandes se supprime (cascade)', mig, "\"leave_requests_employee_id_fkey\" FOREIGN KEY (\"employee_id\") REFERENCES \"hr\".\"employees\"(\"id\") ON DELETE RESTRICT", "\"leave_requests_employee_id_fkey\" FOREIGN KEY (\"employee_id\") REFERENCES \"hr\".\"employees\"(\"id\") ON DELETE CASCADE", DB),
 ('B17 un type qui a des demandes se supprime (cascade)', mig, "\"leave_requests_leave_type_id_fkey\" FOREIGN KEY (\"leave_type_id\") REFERENCES \"hr\".\"leave_types\"(\"id\") ON DELETE RESTRICT", "\"leave_requests_leave_type_id_fkey\" FOREIGN KEY (\"leave_type_id\") REFERENCES \"hr\".\"leave_types\"(\"id\") ON DELETE CASCADE", DB),
 ('B18 version non positive acceptée par la base', mig, "ADD CONSTRAINT \"leave_requests_version_positive\" CHECK (\"version\" >= 1)", "ADD CONSTRAINT \"leave_requests_version_positive\" CHECK (true)", DB),
 ('B19 types de départ sans « congé annuel décompté »', mig, "'ANNUAL', 'Congé annuel', true, true, 10", "'ANNUAL', 'Congé annuel', false, true, 10", DB),
 ('P1 verrou optimiste des demandes retiré dans la base', repo, "where: { id: request.id, version: request.version }, data: { ...data, version: { increment: 1 } } });\n    if (updated.count === 1) return;\n    if ((await this.prisma.db.leaveRequest", "where: { id: request.id }, data: { ...data, version: { increment: 1 } } });\n    if (updated.count === 1) return;\n    if ((await this.prisma.db.leaveRequest", DB),
 ('P2 le chevauchement oublie le début de la période', repo, "startDate: { lte: date(to) }, endDate: { gte: date(from) }, ...(excludeId ? { id: { not: excludeId } } : {}) },\n      orderBy: { startDate: 'asc' },", "startDate: { lte: date(to) }, ...(excludeId ? { id: { not: excludeId } } : {}) },\n      orderBy: { startDate: 'asc' },", DB),
 ('P3 le calendrier montre aussi les demandes non validées', repo, "where: { status: LeaveStatus.Approved, startDate: { lte: date(to) }", "where: { startDate: { lte: date(to) }", DB),
 ('P4 les jours en attente comptent comme pris', repo, "if (row.status === LeaveStatus.Approved) approved += Number(row.days);", "if (row.status === LeaveStatus.Pending) approved += Number(row.days);", DB),
 ('P5 le filtre par année est ignoré', repo, "...(query.year ? { leaveYear: query.year } : {}),", "", DB),
 ('P6 la fiche de l’employé n’est pas verrouillée dans la base', repo, "await this.prisma.db.$queryRaw`SELECT id FROM hr.employees WHERE id = ${employeeId}::uuid FOR UPDATE`;", "", DB),
 # --- Droits (matrice des rôles)
 ('M1 la RH ne gère plus les absences', roles, " g('hr.leave.manage', All),", "", 'roles'),
 ('M2 la Direction ne lit plus toutes les absences', roles, "g('hr.leave.read', All), g('hr.leave.create', Own), g('hr.leave.approve', Own),", "g('hr.leave.read', Own), g('hr.leave.create', Own), g('hr.leave.approve', Own),", 'roles'),
]
only = sys.argv[1:]
if only:
    M = [m for m in M if m[0].split(' ')[0] in only]
env = dict(os.environ, TEST_DB_PORT='54482')
SUITES = {
    'cal': 'src/modules/hr/domain/leave-calendar.spec.ts',
    'req': 'src/modules/hr/domain/leave-request.spec.ts',
    'cfg': 'src/modules/hr/domain/leave-config.spec.ts',
    'uc': 'src/modules/hr/application/leave-use-cases.spec.ts',
    'roles': 'src/modules/iam/domain/roles.spec.ts',
}


def read(path):
    raw = open(path, 'rb').read()
    return raw, raw.decode('utf8')


if os.environ.get('DRY'):
    bad = 0
    for name, path, a, b, kind in M:
        n = read(path)[1].replace('\r\n', '\n').count(a)
        if n != 1:
            bad += 1
        print(name, 'ok' if n == 1 else f'MOTIF {n}')
    print('MOTIFS INVALIDES' if bad else 'tous les motifs sont uniques', bad)
    sys.exit(0)


def run(kind):
    if kind in SUITES:
        out = subprocess.run(f'pnpm exec jest {SUITES[kind]} --silent', cwd=api, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True, timeout=600, shell=True).stdout
    else:
        out = subprocess.run(['node', 'scripts/test-db.mjs', '--tests=' + kind.split(':')[1]], cwd=api, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True, timeout=900, env=env).stdout
    lines = [l for l in out.splitlines() if l.startswith('Tests:')]
    assert lines or 'Test Suites:' in out or 'Tests failed' in out, 'run inconclusive: ' + out[-300:]
    # Une suite qui ne compile plus (le vérificateur de types refuse la faute) est aussi une faute détectée : « Tests » ne compte alors que les autres suites.
    return (bool(lines) and ' failed' in lines[-1]) or any(l.startswith('Test Suites:') and ' failed' in l for l in out.splitlines())


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
    if mutated == text:
        print(name, 'NEUTRE (mutant identique : à retirer)', flush=True)
        res.append((name, None))
        continue
    open(path, 'wb').write((mutated.replace('\n', '\r\n') if crlf else mutated).encode('utf8'))
    try:
        killed = run(kind)
    except AssertionError as e:
        print(name, 'INCONCLUANT', str(e)[:200], flush=True)
        killed = None
    finally:
        open(path, 'wb').write(raw)
    print(name, 'TUÉ' if killed else ('SURVIVANT' if killed is False else 'INCONCLUANT'), flush=True)
    res.append((name, killed))
survivors = [n for n, k in res if k is not True]
print(f'\n{len(res) - len(survivors)} / {len(res)} tués')
for n in survivors:
    print('  survivant :', n)
