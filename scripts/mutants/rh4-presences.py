from pathlib import Path
# Racine du dépôt : ce script se trouve dans scripts/mutants/.
REPO = Path(__file__).resolve().parents[2]
import subprocess, os, sys
api = str(REPO / 'apps' / 'api')
web = str(REPO / 'apps' / 'web')
hr = os.path.join(api, 'src', 'modules', 'hr')
dom = os.path.join(hr, 'domain', 'presence.ts')
puc = os.path.join(hr, 'application', 'presence-use-cases.ts')
ctl = os.path.join(hr, 'presentation', 'presences.controller.ts')
dto = os.path.join(hr, 'presentation', 'dto', 'presence.dto.ts')
rep = os.path.join(hr, 'infrastructure', 'prisma-presence.repository.ts')
mig = os.path.join(api, 'prisma', 'migrations', '20261121000000_rh_4a_presences', 'migration.sql')
roles = os.path.join(api, 'src', 'modules', 'iam', 'domain', 'roles.ts')
cat = os.path.join(api, 'src', 'modules', 'iam', 'domain', 'permission-catalog.ts')
lp = os.path.join(web, 'lib', 'presences.ts')
lm = os.path.join(web, 'lib', 'modules.ts')
pg = os.path.join(web, 'app', '(app)', 'hr', 'presences', 'page.tsx')
DB = 'db:hr-presences-http'
M = [
 # --- Domaine
 ('D1 un mode inconnu est accepté', dom, "if (!PRESENCE_MODES.includes(raw as PresenceMode)) throw", "if (false) throw", 'unit'),
 ('D2 un employé qui n’est pas un identifiant est accepté', dom, "if (!UUID.test(input.employeeId)) throw", "if (false) throw", 'unit'),
 ('D3 un jour impossible est accepté', dom, "if (!isIsoDate(day)) throw", "if (false) throw", 'unit'),
 ('D4 un jour après la fin d’une absence est couvert', dom, "if (ordinal < first || ordinal > last) return false;", "if (ordinal < first) return false;", 'unit'),
 ('D5 un jour avant le début d’une absence est couvert', dom, "if (ordinal < first || ordinal > last) return false;", "if (ordinal > last) return false;", 'unit'),
 ('D6 une demi-journée de début interdit la déclaration', dom, "if (ordinal === first && period.startHalf) return false;", "", 'unit'),
 ('D7 une demi-journée de fin interdit la déclaration', dom, "if (ordinal === last && period.endHalf) return false;", "", 'unit'),
 ('D8 la fenêtre de l’employé remonte à 8 jours', dom, "export const SELF_WINDOW = { past: 7, future: 30 } as const;", "export const SELF_WINDOW = { past: 8, future: 30 } as const;", 'unit'),
 ('D9 la fenêtre de l’employé va à 31 jours', dom, "export const SELF_WINDOW = { past: 7, future: 30 } as const;", "export const SELF_WINDOW = { past: 7, future: 31 } as const;", 'unit'),
 ('D10 la fenêtre de la RH remonte à 91 jours', dom, "export const HR_WINDOW = { past: 90, future: 90 } as const;", "export const HR_WINDOW = { past: 91, future: 90 } as const;", 'unit'),
 ('D11 la fenêtre de la RH va à 91 jours', dom, "export const HR_WINDOW = { past: 90, future: 90 } as const;", "export const HR_WINDOW = { past: 90, future: 91 } as const;", 'unit'),
 ('D12 changer le mode ne retient plus l’auteur', dom, "mode: parseMode(input.mode), declaredByUserId: input.by, updatedAt: input.now };", "mode: parseMode(input.mode), updatedAt: input.now };", 'unit'),
 ('D13 une déclaration commence à la version 2', dom, "createdAt: input.now, updatedAt: input.now, version: 1,", "createdAt: input.now, updatedAt: input.now, version: 2,", 'unit'),
 ('D14 changer le mode ne contrôle plus le nouveau mode', dom, "this.props = { ...this.props, mode: parseMode(input.mode), declaredByUserId: input.by, updatedAt: input.now };", "this.props = { ...this.props, mode: input.mode as PresenceMode, declaredByUserId: input.by, updatedAt: input.now };", 'unit'),
 ('D15 la liste de l’API perd un mode', dto, "export const PRESENCE_MODE_CODES = ['ON_SITE', 'REMOTE', 'TRAVEL'];", "export const PRESENCE_MODE_CODES = ['ON_SITE', 'REMOTE'];", 'unit'),
 # --- Cas d'usage : déclarer et retirer
 ('U1 déclarer ne vérifie plus le droit', puc, "if (declare === null) throw new DomainError('FORBIDDEN', \"Vous n'avez pas le droit de déclarer", "if (false) throw new DomainError('FORBIDDEN', \"Vous n'avez pas le droit de déclarer", 'unit'),
 ('U2 retirer ne vérifie plus le droit', puc, "if (declare === null) throw new DomainError('FORBIDDEN', \"Vous n'avez pas le droit de modifier", "if (false) throw new DomainError('FORBIDDEN', \"Vous n'avez pas le droit de modifier", 'unit'),
 ('U3 chacun déclare pour n’importe quel employé', puc, "if (!employee || !(declare === Scope.All || employee.userId === access.actorId)) throw", "if (!employee) throw", 'unit'),
 ('U4 tout employé avec un compte est déclarable par un autre', puc, "(declare === Scope.All || employee.userId === access.actorId)", "(declare === Scope.All || employee.userId !== null)", 'unit'),
 ('U5 un compte sans fiche déclare quand même', puc, "if (!employeeId && !employee) throw new DomainError('VALIDATION',", "if (false) throw new DomainError('VALIDATION',", 'unit'),
 ('U6 la fenêtre de la RH vaut pour tous', puc, "const window = declare === Scope.All ? HR_WINDOW : SELF_WINDOW;", "const window = HR_WINDOW;", 'unit'),
 ('U7 la fenêtre de l’employé vaut pour la RH', puc, "const window = declare === Scope.All ? HR_WINDOW : SELF_WINDOW;", "const window = SELF_WINDOW;", 'unit'),
 ('U8 le dernier jour passé de la fenêtre est refusé', puc, "if (offset < -window.past) throw", "if (offset <= -window.past) throw", 'unit'),
 ('U9 le dernier jour à venir de la fenêtre est refusé', puc, "if (offset > window.future) throw", "if (offset >= window.future) throw", 'unit'),
 ('U10 un jour avant l’entrée est accepté', puc, "if (day < employee.hiredOn) throw", "if (false) throw", 'unit'),
 ('U12 un employé archivé reçoit une présence', puc, "if (employee.isArchived) throw new DomainError('CONFLICT', \"L'employé est archivé", "if (false) throw new DomainError('CONFLICT', \"L'employé est archivé", 'unit'),
 ('U13 une absence validée n’interdit plus la déclaration', puc, "if (leaves.some((l) => l.status === LeaveStatus.Approved && coversWholeDay(l.period, command.day))) throw", "if (false) throw", 'unit'),
 ('U14 une demande en attente interdit la déclaration', puc, "l.status === LeaveStatus.Approved && coversWholeDay(l.period, command.day)", "coversWholeDay(l.period, command.day)", 'unit'),
 ('U15 une demi-journée d’absence interdit la déclaration', puc, "l.status === LeaveStatus.Approved && coversWholeDay(l.period, command.day)", "l.status === LeaveStatus.Approved", 'unit'),
 ('U16 redéclarer le même mode écrit dans le journal', puc, "if (existing.mode === mode) return toPresenceView(existing, nameOf(employee));", "", 'unit'),
 ('U17 changer le mode est tracé comme une création', puc, "entityId: existing.id, action: AuditAction.Update,", "entityId: existing.id, action: AuditAction.Create,", 'unit'),
 ('U18 la création est tracée comme une modification', puc, "entityId: created.id, action: AuditAction.Create,", "entityId: created.id, action: AuditAction.Update,", 'unit'),
 ('U19 le retrait est tracé comme une modification', puc, "entityId: existing.id, action: AuditAction.Delete,", "entityId: existing.id, action: AuditAction.Update,", 'unit'),
 ('U20 changer le mode garde l’ancien auteur', puc, "existing.change({ mode, by: command.access.actorId, now });", "existing.change({ mode, by: existing.declaredByUserId, now });", 'unit'),
 ('U21 la saisie par la RH n’est plus marquée', puc, "mode, declaredByUserId: command.access.actorId, now });", "mode, declaredByUserId: employee.userId ?? command.access.actorId, now });", 'unit'),
 ('U22 retirer une déclaration absente réussit', puc, "if (!existing) throw new DomainError('NOT_FOUND', 'Aucune présence déclarée ce jour-là');", "if (!existing) return;", 'unit'),
 ('U23 retirer ne supprime plus rien', puc, "await this.presences.remove(employee.id, command.day);", "", 'unit'),
 ('U24 l’ancienne valeur n’est plus gardée au retrait', puc, "action: AuditAction.Delete, oldValue: { ...before } });", "action: AuditAction.Delete });", 'unit'),
 # --- Cas d'usage : tableau
 ('B1 le tableau se lit sans droit', puc, "if (read === null) throw new DomainError('FORBIDDEN', \"Vous n'avez pas le droit de voir les présences\");", "if (false) throw new DomainError('FORBIDDEN', \"Vous n'avez pas le droit de voir les présences\");", 'unit'),
 ('B2 une période inversée est acceptée', puc, "|| query.to < query.from) throw", "|| false) throw", 'unit'),
 ('B3 une période d’un seul jour est refusée', puc, "|| query.to < query.from) throw", "|| query.to <= query.from) throw", DB),
 ('B4 la période peut durer 94 jours', puc, "const MAX_BOARD_DAYS = 93;", "const MAX_BOARD_DAYS = 94;", 'unit'),
 ('B5 une période de 93 jours est refusée', puc, "+ 1 > MAX_BOARD_DAYS)", "+ 1 >= MAX_BOARD_DAYS)", 'unit'),
 ('B6 chacun voit tout le personnel', puc, ".filter((e) => wide || e.id === mine!.id || e.managerEmployeeId === mine!.id)", ".filter(() => true)", 'unit'),
 ('B7 chacun voit les collègues de son service', puc, "e.managerEmployeeId === mine!.id)", "e.department === mine!.department)", 'unit'),
 ('B8 la lecture en portée Propre voit tout', puc, "const wide = read === Scope.All;", "const wide = read !== null;", 'unit'),
 ('B9 un responsable ne voit plus sa propre ligne', puc, "wide || e.id === mine!.id ||", "wide ||", 'unit'),
 ('B10 le service distingue les majuscules', puc, ".filter((e) => department === null || e.department.toLowerCase() === department.toLowerCase());", ".filter((e) => department === null || e.department === department);", 'unit'),
 ('B11 le service n’est plus nettoyé', puc, "query.department?.trim() || null", "query.department || null", 'unit'),
 ('B12 un compte sans fiche charge tout le personnel', puc, "const active = wide || mine ? await this.employees.allActive(MAX_EMPLOYEES) : [];", "const active = await this.employees.allActive(MAX_EMPLOYEES);", 'unit'),
 ('B13 un jour d’absence partielle est compté absent', puc, "if (coversWholeDay(l.period, day)) leaveDays.add(day);", "leaveDays.add(day);", 'unit'),
 ('B14 les lignes sont triées à l’envers', puc, "rows.sort((a, b) => a.employeeName.localeCompare(b.employeeName, 'fr')", "rows.sort((a, b) => b.employeeName.localeCompare(a.employeeName, 'fr')", 'unit'),
 ('B15 la RH ne peut plus déclarer pour tous selon le tableau', puc, "scopeOf(query.access, 'hr.presence.declare') === Scope.All, rows }", "scopeOf(query.access, 'hr.presence.declare') !== null, rows }", 'unit'),
 ('B16 la fiche du demandeur n’est plus indiquée', puc, "viewerEmployeeId: mine?.id ?? null", "viewerEmployeeId: null", 'unit'),
 ('B17 les absences d’avant la période sont comptées', puc, "ordinal = Math.max(first, dayOrdinal(l.start));", "ordinal = dayOrdinal(l.start);", 'unit'),
 ('B18 les absences d’après la période sont comptées', puc, "ordinal <= Math.min(last, dayOrdinal(l.end));", "ordinal <= dayOrdinal(l.end);", 'unit'),
 # --- Routes et base
 ('R1 le retrait répond 200 au lieu de 204', ctl, "@HttpCode(204)", "@HttpCode(200)", DB),
 ('R2 la déclaration répond 201 au lieu de 200', ctl, "@Put(':day')\n  @HttpCode(200)", "@Put(':day')\n  @HttpCode(201)", DB),
 ('P1 un conflit d’unicité n’est plus un conflit', rep, "if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') throw", "if (false) throw", DB),
 ('P2 le tableau lit les jours à l’envers', rep, "orderBy: [{ day: 'asc' }, { employeeId: 'asc' }]", "orderBy: [{ day: 'desc' }, { employeeId: 'asc' }]", DB),
 ('P3 le dernier jour de la période est exclu', rep, "lte: date(to)", "lt: date(to)", DB),
 ('P4 le premier jour de la période est exclu', rep, "gte: date(from)", "gt: date(from)", DB),
 ('P5 retirer supprime tous les jours de l’employé', rep, "deleteMany({ where: { employeeId, day: date(day) } })", "deleteMany({ where: { employeeId } })", DB),
 ('P6 changer le mode ne retient plus l’auteur en base', rep, "declaredByUserId: declaration.declaredByUserId, version: { increment: 1 } }", "version: { increment: 1 } }", DB),
 ('P7 changer le mode ne change rien en base', rep, "data: { mode: declaration.mode, declaredByUserId", "data: { declaredByUserId", DB),
 ('P8 la version n’augmente plus', rep, "version: { increment: 1 } }", "version: { increment: 0 } }", DB),
 ('G1 plusieurs déclarations le même jour sont permises', mig, "CREATE UNIQUE INDEX \"presence_declarations_employee_id_day_key\"", "CREATE INDEX \"presence_declarations_employee_id_day_key\"", DB),
 ('G2 une version de zéro est permise', mig, "CHECK (\"version\" >= 1)", "CHECK (\"version\" >= 0)", DB),
 ('G3 un quatrième mode est permis', mig, "AS ENUM ('ON_SITE', 'REMOTE', 'TRAVEL')", "AS ENUM ('ON_SITE', 'REMOTE', 'TRAVEL', 'HOME')", DB),
 ('G4 l’employé d’une déclaration n’est plus contrôlé', mig, "ALTER TABLE \"hr\".\"presence_declarations\" ADD CONSTRAINT \"presence_declarations_employee_id_fkey\" FOREIGN KEY (\"employee_id\") REFERENCES \"hr\".\"employees\"(\"id\") ON DELETE RESTRICT ON UPDATE CASCADE;", "", DB),
 # --- Droits
 ('L1 la Direction ne lit plus tout le personnel', roles, "g('hr.presence.read', All), g('hr.presence.declare', Own), g('hr.leave.create', Own)", "g('hr.presence.read', Own), g('hr.presence.declare', Own), g('hr.leave.create', Own)", 'unit:roles'),
 ('L2 la RH ne déclare plus pour tous', roles, "g('hr.presence.read', All), g('hr.presence.declare', All)", "g('hr.presence.read', All), g('hr.presence.declare', Own)", 'unit:roles'),
 ('L3 la RH ne lit plus tout le personnel', roles, "g('hr.presence.read', All), g('hr.presence.declare', All)", "g('hr.presence.read', Own), g('hr.presence.declare', All)", 'unit:roles'),
 ('L4 le rôle Fiscalité ne peut plus déclarer', roles, "g('hr.presence.declare', Own), g('hr.leave.create', Own), g('hr.leave.approve', Own), g('iam.session.read', Own)", "g('hr.leave.create', Own), g('hr.leave.approve', Own), g('iam.session.read', Own)", 'unit:roles'),
 ('L5 l’action « déclarer » disparaît du catalogue', cat, "actions: ['read', 'declare'] }", "actions: ['read'] }", 'unit:roles'),
 # --- Interface : règles de saisie
 ('W1 la semaine commence le dimanche', lp, "-((weekday(iso) + 6) % 7)", "-(weekday(iso) % 7)", 'web'),
 ('W2 la semaine n’a que six jours', lp, "Array.from({ length: 7 }, (_, i) => addDays(start, i))", "Array.from({ length: 6 }, (_, i) => addDays(start, i))", 'web'),
 ('W3 une semaine plus tard saute six jours', lp, "addDays(start, weeks * 7)", "addDays(start, weeks * 6)", 'web'),
 ('W4 le samedi n’est plus un week-end', lp, "weekday(iso) === 0 || weekday(iso) === 6;", "weekday(iso) === 0;", 'web'),
 ('W5 la fenêtre de l’employé remonte à 8 jours', lp, "export const SELF_WINDOW = { past: 7, future: 30 } as const;", "export const SELF_WINDOW = { past: 8, future: 30 } as const;", 'web'),
 ('W6 la fenêtre de l’employé va à 31 jours', lp, "export const SELF_WINDOW = { past: 7, future: 30 } as const;", "export const SELF_WINDOW = { past: 7, future: 31 } as const;", 'web'),
 ('W7 la fenêtre de la RH remonte à 91 jours', lp, "export const HR_WINDOW = { past: 90, future: 90 } as const;", "export const HR_WINDOW = { past: 91, future: 90 } as const;", 'web'),
 ('W8 le dernier jour passé est exclu', lp, "offset >= -window.past && offset <= window.future", "offset > -window.past && offset <= window.future", 'web'),
 ('W9 le dernier jour à venir est exclu', lp, "offset >= -window.past && offset <= window.future", "offset >= -window.past && offset < window.future", 'web'),
 ('W10 la fenêtre de la RH n’existe plus', lp, "const window = forAll ? HR_WINDOW : SELF_WINDOW;", "const window = SELF_WINDOW;", 'web'),
 ('W11 chacun saisit la ligne d’un autre', lp, "if (!mine && !board.canDeclareForAll) return false;", "", 'web'),
 ('W12 un jour d’absence validée est modifiable', lp, "  if (row.leaveDays.includes(day)) return false;\n  return inWindow", "  return inWindow", 'web'),
 ('W13 la RH a la fenêtre courte', lp, "return inWindow(day, today, board.canDeclareForAll);", "return inWindow(day, today, false);", 'web'),
 ('W14 un week-end d’absence est compté absent', lp, "if (row.leaveDays.includes(day) && !isWeekend(day)) return { kind: 'leave' };", "if (row.leaveDays.includes(day)) return { kind: 'leave' };", 'web'),
 ('W15 les absents sont comptés deux fois', lp, "if (cell.kind === 'leave') totals.LEAVE += 1;", "if (cell.kind === 'leave') totals.LEAVE += 2;", 'web'),
 ('W16 le télétravail change de nom', lp, "{ code: 'REMOTE', label: 'Télétravail', symbol: '⌂' }", "{ code: 'REMOTE', label: 'Travail à distance', symbol: '⌂' }", 'web'),
 ('W17 deux modes ont le même symbole', lp, "{ code: 'REMOTE', label: 'Télétravail', symbol: '⌂' }", "{ code: 'REMOTE', label: 'Télétravail', symbol: '■' }", 'web'),
 ('W18 le code du déplacement change', lp, "{ code: 'TRAVEL', label: 'Déplacement', symbol: '→' }", "{ code: 'TRIP', label: 'Déplacement', symbol: '→' }", 'web'),
 # --- Interface : menu et écran
 ('Y1 le menu exige le droit de déclarer', lm, "href: '/hr/presences', permission: 'hr.presence.read' }", "href: '/hr/presences', permission: 'hr.presence.declare' }", 'web'),
 ('Y2 l’écran se lit avec le droit de déclarer', pg, "const canRead = can(profile, 'hr.presence.read');", "const canRead = can(profile, 'hr.presence.declare');", 'web'),
 ('Y3 le filtre par service est proposé à qui lit seulement', pg, "const seesAll = canAll(profile, 'hr.presence.read');", "const seesAll = can(profile, 'hr.presence.read');", 'web'),
]
only = sys.argv[1:]
if only:
    M = [m for m in M if m[0].split(' ')[0] in only]
env = dict(os.environ, TEST_DB_PORT='54483')
SPECS = {
    dom: 'src/modules/hr/domain/presence.spec.ts src/modules/hr/application/presence-use-cases.spec.ts',
    dto: 'src/modules/hr/domain/presence.spec.ts',
    puc: 'src/modules/hr/application/presence-use-cases.spec.ts',
    roles: 'src/modules/iam/domain/roles.spec.ts',
    cat: 'src/modules/iam/domain/roles.spec.ts',
}
WEB = 'pnpm exec vitest run test/rh-4b.test.ts test/n1-navigation.test.ts test/s38.test.ts'


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
    if kind in ('unit', 'unit:roles'):
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
