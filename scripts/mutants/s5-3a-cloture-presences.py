from pathlib import Path
# Racine du dépôt : ce script se trouve dans scripts/mutants/.
REPO = Path(__file__).resolve().parents[2]
import subprocess, os, sys
api = str(REPO / 'apps' / 'api')
web = str(REPO / 'apps' / 'web')
training = os.path.join(api, 'src', 'modules', 'training')
sess = os.path.join(training, 'domain', 'training-session.ts')
att = os.path.join(training, 'domain', 'attendance.ts')
dates = os.path.join(training, 'domain', 'session-dates.ts')
suc = os.path.join(training, 'application', 'session-use-cases.ts')
auc = os.path.join(training, 'application', 'attendance-use-cases.ts')
sctl = os.path.join(training, 'presentation', 'session.controller.ts')
actl = os.path.join(training, 'presentation', 'attendance.controller.ts')
prep = os.path.join(training, 'infrastructure', 'prisma-attendance.repository.ts')
mig = os.path.join(api, 'prisma', 'migrations', '20261122000000_s5_3a_cloture_presences', 'migration.sql')
roles = os.path.join(api, 'src', 'modules', 'iam', 'domain', 'roles.ts')
cat = os.path.join(api, 'src', 'modules', 'iam', 'domain', 'permission-catalog.ts')
ls = os.path.join(web, 'lib', 'sessions.ts')
sd = os.path.join(web, 'components', 'training', 'session-dialogs.tsx')
DB = 'db:sessions-http'
M = [
 # --- Domaine : clôture et réouverture de la session
 ('D1 une session déjà clôturée se reclôture', sess, "if (this.props.status === 'CLOSED') throw new DomainError('INVARIANT_VIOLATION', 'La session est déjà clôturée');", "", 'unit'),
 ('D2 une session planifiée se clôture', sess, "if (this.props.status !== 'OPEN') throw new DomainError('INVARIANT_VIOLATION', 'Seule une session ouverte peut être clôturée');", "", 'unit'),
 ('D3 clôturer ne change plus le statut', sess, "close(): void {\n    if (this.props.status === 'CLOSED') throw new DomainError('INVARIANT_VIOLATION', 'La session est déjà clôturée');\n    if (this.props.status !== 'OPEN') throw new DomainError('INVARIANT_VIOLATION', 'Seule une session ouverte peut être clôturée');\n    this.props = { ...this.props, status: 'CLOSED' };", "close(): void {\n    this.props = { ...this.props, status: 'CLOSED' };", 'unit'),
 ('D4 une session non clôturée se rouvre', sess, "if (this.props.status !== 'CLOSED') throw new DomainError('INVARIANT_VIOLATION', \"Seule une session clôturée peut être rouverte\");", "", 'unit'),
 ('D5 la réouverture accepte un motif vide', sess, "if (!motive) throw new DomainError('VALIDATION', 'Le motif de la réouverture est obligatoire');", "", 'unit'),
 ('D6 rouvrir remet au statut clôturé', sess, "this.props = { ...this.props, status: 'OPEN' };\n  }\n\n  /** Annule la session", "this.props = { ...this.props, status: 'CLOSED' };\n  }\n\n  /** Annule la session", 'unit'),
 # --- Domaine : présence à une séance
 ('D7 un statut hors liste est accepté', att, "if (!ATTENDANCE_STATUSES.includes(raw as AttendanceStatus)) throw new DomainError('VALIDATION', 'La présence doit être : présent, en retard ou absent');", "if (false) throw new DomainError('VALIDATION', 'La présence doit être : présent, en retard ou absent');", 'unit'),
 ('D8 un jour hors de la session est accepté', att, "if (day < start || day > end) throw new DomainError('VALIDATION', 'Ce jour est hors de la période de la session');", "if (false) throw new DomainError('VALIDATION', 'Ce jour est hors de la période de la session');", 'unit'),
 ('D9 un week-end est un jour de cours', att, "if (!isWorkingDay(day)) throw new DomainError('VALIDATION', 'Ce jour n\\'est pas un jour de cours (du lundi au vendredi)');", "if (false) throw new DomainError('VALIDATION', 'Ce jour n\\'est pas un jour de cours (du lundi au vendredi)');", 'unit'),
 ('D10 une présence commence à la version 2', att, "createdAt: input.now, updatedAt: input.now, version: 1,", "createdAt: input.now, updatedAt: input.now, version: 2,", 'unit'),
 ('D11 corriger ne retient plus le dernier auteur', att, "this.props = { ...this.props, status: parseAttendanceStatus(input.status), recordedByUserId: input.by, updatedAt: input.now };", "this.props = { ...this.props, status: parseAttendanceStatus(input.status), updatedAt: input.now };", 'unit'),
 # --- Dates : jours de cours d'une période
 ('D12 le dernier jour de la période est exclu', dates, "while (cursor <= last) {\n    const iso = toIsoDate(cursor);\n    if (isWorkingDay(iso)) days.push(iso);\n    cursor = new Date(cursor.getTime() + DAY_MS);\n  }\n  return days;", "while (cursor < last) {\n    const iso = toIsoDate(cursor);\n    if (isWorkingDay(iso)) days.push(iso);\n    cursor = new Date(cursor.getTime() + DAY_MS);\n  }\n  return days;", 'unit'),
 ('D13 un week-end devient une séance', dates, "if (isWorkingDay(iso)) days.push(iso);", "days.push(iso);", 'unit'),
 # --- Cas d'usage : clôturer, rouvrir
 ('U1 clôturer ne trace plus l’avant/après', suc, "session.close();\n      await this.sessions.save(session);\n      const after = await this.views.of((await this.sessions.findById(session.id)) ?? session);\n      await this.audit.record({ actor: command.actor, module: 'training', entityType: 'TrainingSession', entityId: session.id, action: AuditAction.Update, oldValue: { ...before }, newValue: { ...after } });", "session.close();\n      await this.sessions.save(session);\n      const after = await this.views.of((await this.sessions.findById(session.id)) ?? session);", 'unit'),
 ('U2 le motif de réouverture n’est plus tracé', suc, "oldValue: { ...before }, newValue: { ...after, reopenReason: command.reason.trim() },", "oldValue: { ...before }, newValue: { ...after },", 'unit'),
 ('U3 le motif de réouverture n’est plus nettoyé', suc, "newValue: { ...after, reopenReason: command.reason.trim() },", "newValue: { ...after, reopenReason: command.reason },", 'unit'),
 # --- Cas d'usage : présence
 ('U4 une inscription d’une autre session est acceptée', auc, "if (!enrollment || enrollment.sessionId !== session.id) throw new DomainError('NOT_FOUND', ENROLLMENT_NOT_FOUND);", "if (!enrollment) throw new DomainError('NOT_FOUND', ENROLLMENT_NOT_FOUND);", 'unit'),
 ('U5 une inscription non confirmée a une feuille de présence', auc, "if (enrollment.status !== 'CONFIRMED') throw new DomainError('INVARIANT_VIOLATION', \"Seuls les inscrits confirmés ont une feuille de présence\");", "if (false) throw new DomainError('INVARIANT_VIOLATION', \"Seuls les inscrits confirmés ont une feuille de présence\");", 'unit'),
 ('U6 une session clôturée accepte une saisie', auc, "if (session.status === 'CLOSED') throw new DomainError('INVARIANT_VIOLATION', 'La session est clôturée : les présences sont figées (il faut la rouvrir)');", "if (false) throw new DomainError('INVARIANT_VIOLATION', 'La session est clôturée : les présences sont figées (il faut la rouvrir)');", 'unit'),
 ('U7 redéclarer la même valeur écrit dans le journal', auc, "if (existing.status === command.status) return toAttendanceView(existing);", "", 'unit'),
 ('U8 corriger est tracé comme une création', auc, "action: AuditAction.Update, oldValue: { ...before }, newValue: { ...after } });\n        return after;\n      }\n      const created = Attendance.record", "action: AuditAction.Create, oldValue: { ...before }, newValue: { ...after } });\n        return after;\n      }\n      const created = Attendance.record", 'unit'),
 ('U9 la création est tracée comme une correction', auc, "action: AuditAction.Create, newValue: { ...view } });\n      return view;\n    });\n  }\n}\n\n/**\n * Feuille", "action: AuditAction.Update, newValue: { ...view } });\n      return view;\n    });\n  }\n}\n\n/**\n * Feuille", 'unit'),
 ('U10 la feuille montre les inscrits non confirmés', auc, "const confirmed = await this.enrollments.listConfirmed(session.id);", "const confirmed = await this.enrollments.listSeats(session.id);", DB),
 ('U11 la feuille peut se saisir même clôturée', auc, "canRecord: session.status !== 'CLOSED' };", "canRecord: true };", 'unit'),
 ('U12 les lignes sont triées à l’envers', auc, "rows.sort((a, b) => a.learnerName.localeCompare(b.learnerName, 'fr') || a.enrollmentId.localeCompare(b.enrollmentId));", "rows.sort((a, b) => b.learnerName.localeCompare(a.learnerName, 'fr'));", 'unit'),
 # --- Routes
 ('R1 clôturer répond 201 au lieu de 200', sctl, "@Post(':id/close') @HttpCode(200) @Protected('training.session.close')", "@Post(':id/close') @HttpCode(201) @Protected('training.session.close')", DB),
 ('R2 rouvrir répond 201 au lieu de 200', sctl, "@Post(':id/reopen') @HttpCode(200) @Protected('training.session.reopen')", "@Post(':id/reopen') @HttpCode(201) @Protected('training.session.reopen')", DB),
 ('R3 clôturer et rouvrir exigent la même permission', sctl, "@Post(':id/reopen') @HttpCode(200) @Protected('training.session.reopen')", "@Post(':id/reopen') @HttpCode(200) @Protected('training.session.close')", DB),
 ('R4 saisir une présence répond 201 au lieu de 200', actl, "@Put(':enrollmentId/:day') @HttpCode(200) @Protected('training.attendance.record')", "@Put(':enrollmentId/:day') @HttpCode(201) @Protected('training.attendance.record')", DB),
 ('R5 lire et saisir exigent la même permission', actl, "@Put(':enrollmentId/:day') @HttpCode(200) @Protected('training.attendance.record')", "@Put(':enrollmentId/:day') @HttpCode(200) @Protected('training.attendance.read')", DB),
 # --- Persistance
 ('P1 un conflit d’unicité n’est plus un conflit', prep, "if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') throw new DomainError('CONFLICT', 'Une présence est déjà saisie ce jour-là : rechargez la page');", "if (false) throw new DomainError('CONFLICT', 'Une présence est déjà saisie ce jour-là : rechargez la page');", DB),
 ('P2 la feuille lit les jours à l’envers', prep, "orderBy: [{ day: 'asc' }, { enrollmentId: 'asc' }]", "orderBy: [{ day: 'desc' }, { enrollmentId: 'asc' }]", DB),
 ('P3 corriger ne retient plus le dernier auteur en base', prep, "data: { status: attendance.status, recordedByUserId: attendance.recordedByUserId, version: { increment: 1 } }", "data: { status: attendance.status, version: { increment: 1 } }", DB),
 ('P4 la version n’augmente plus', prep, "version: { increment: 1 } }", "version: { increment: 0 } }", DB),
 # --- Garanties de la base
 ('G1 plusieurs présences le même jour sont permises', mig, "CREATE UNIQUE INDEX \"attendances_enrollment_id_day_key\"", "CREATE INDEX \"attendances_enrollment_id_day_key\"", DB),
 ('G2 l’inscription d’une présence n’est plus contrôlée', mig, 'ALTER TABLE "training"."attendances" ADD CONSTRAINT "attendances_enrollment_id_fkey" FOREIGN KEY ("enrollment_id") REFERENCES "training"."enrollments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;', '', DB),
 # --- Droits
 ('L1 le formateur retrouve le droit de saisir une présence', roles, "g('training.session.read', Own), g('training.learner.read', Own),\n    // Présences : jamais saisies par le formateur (externe, sans compte, S1/ADR-0016) ; retiré ici (S5.3a).\n    g('training.evaluation.read', Own), g('training.evaluation.record', Own),", "g('training.session.read', Own), g('training.learner.read', Own),\n    g('training.attendance.read', Own), g('training.attendance.record', Own),\n    g('training.evaluation.read', Own), g('training.evaluation.record', Own),", 'unit:roles'),
 ('L2 l’action « rouvrir » disparaît du catalogue', cat, "actions: [...CRUD, 'cancel', 'close', 'reopen'] }", "actions: [...CRUD, 'cancel', 'close'] }", 'unit:roles'),
 # --- Interface : actions selon l'état et les droits
 ('W1 une session ouverte ne peut plus se clôturer', ls, "close: can.close && session.status === 'OPEN',", "close: false,", 'web'),
 ('W2 une session clôturée ne peut plus se rouvrir', ls, "reopen: can.reopen && session.status === 'CLOSED',", "reopen: false,", 'web'),
 ('W3 une session planifiée peut se clôturer', ls, "close: can.close && session.status === 'OPEN',", "close: can.close,", 'web'),
 ('W4 la réouverture accepte un motif vide', ls, "export function validateReopen(reason: string): string | undefined {\n  const text = reason.trim();\n  if (!text) return 'Le motif de la réouverture est obligatoire';", "export function validateReopen(reason: string): string | undefined {\n  const text = reason.trim();\n  if (false) return 'Le motif de la réouverture est obligatoire';", 'web'),
 ('W5 le motif de réouverture n’a plus de limite', ls, "if (text.length > 500) return 'Le motif ne peut dépasser 500 caractères';\n  return undefined;\n}\n\n/** Une session commencée", "return undefined;\n}\n\n/** Une session commencée", 'web'),
]
only = sys.argv[1:]
if only:
    M = [m for m in M if m[0].split(' ')[0] in only]
env = dict(os.environ, TEST_DB_PORT='54484')
SPECS = {
    sess: 'src/modules/training/domain/training-session.spec.ts',
    att: 'src/modules/training/domain/attendance.spec.ts',
    dates: 'src/modules/training/domain/training-session.spec.ts src/modules/training/application/attendance-use-cases.spec.ts',
    suc: 'src/modules/training/application/session-use-cases.spec.ts',
    auc: 'src/modules/training/application/attendance-use-cases.spec.ts',
    roles: 'src/modules/iam/domain/roles.spec.ts',
    cat: 'src/modules/iam/domain/roles.spec.ts',
}
WEB = 'pnpm exec vitest run test/s56-sessions.test.ts test/s38.test.ts'


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
        files = [l for l in out.splitlines() if l.strip().startswith('Test Files')]
        return ' failed' in lines[-1] or 'no tests' in lines[-1] or any(' failed' in l for l in files)
    else:
        out = subprocess.run(['node', 'scripts/test-db.mjs', '--tests=' + kind.split(':')[1]], cwd=api, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True, timeout=800, env=env).stdout
    lines = [l for l in out.splitlines() if l.startswith('Tests:')]
    assert lines, 'run inconclusive: ' + out[-300:]
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
