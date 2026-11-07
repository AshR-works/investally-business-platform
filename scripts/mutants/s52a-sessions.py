from pathlib import Path
# Racine du dépôt : ce script se trouve dans scripts/mutants/.
REPO = Path(__file__).resolve().parents[2]
import subprocess, os, sys
api = str(REPO / 'apps' / 'crm-api')
web = str(REPO / 'apps' / 'crm-web')
base = os.path.join(api, 'src', 'modules', 'training')
dates = os.path.join(base, 'domain', 'session-dates.ts')
sess = os.path.join(base, 'domain', 'training-session.ts')
uc = os.path.join(base, 'application', 'session-use-cases.ts')
ctrl = os.path.join(base, 'presentation', 'session.controller.ts')
repo = os.path.join(base, 'infrastructure', 'prisma-session.repository.ts')
mig = os.path.join(api, 'prisma', 'migrations', '20261113000000_s5_2a_sessions', 'migration.sql')
wlib = os.path.join(web, 'lib', 'sessions.ts')
wmod = os.path.join(web, 'lib', 'modules.ts')
seedrun = os.path.join(api, 'src', 'cli', 'seed', 'run-seed.ts')
seedplan = os.path.join(api, 'src', 'cli', 'seed', 'seed-plan.ts')
M = [
 ('S1 week-end accepté comme jour de cours', dates, "return day >= 1 && day <= 5;", "return day >= 0 && day <= 6;", 'unit'),
 ('S2 week-end compté dans la durée', dates, "if (day >= 1 && day <= 5) remaining -= 1;", "remaining -= 1;", 'unit'),
 ('S3 durée d’une session d’un jour trop longue', dates, "let remaining = rhythm.weeks * rhythm.daysPerWeek - 1;", "let remaining = rhythm.weeks * rhythm.daysPerWeek;", 'unit'),
 ('S4 chevauchement : bornes exclues', dates, "return aStart <= bEnd && bStart <= aEnd;", "return aStart < bEnd && bStart < aEnd;", 'unit'),
 ('S5 date du calendrier non vérifiée', dates, "if (toIsoDate(date) !== text) throw", "if (false) throw", 'unit'),
 ('S6 date de début dans le passé acceptée', sess, "if (start < today) throw", "if (false) throw", 'unit'),
 ('S7 date de début un week-end acceptée', sess, "if (!isWorkingDay(start)) throw", "if (false) throw", 'unit'),
 ('S8 rythme du soir (en préparation) accepté', sess, "if (!rhythm.open) throw", "if (false) throw", 'unit'),
 ('S9 capacité non bornée', sess, "if (!Number.isInteger(raw) || raw < 1 || raw > 1000) throw", "if (false) throw", 'unit'),
 ('S10 salle changée après le début', sess, "if (this.hasStarted(today)) throw new DomainError('INVARIANT_VIOLATION', 'La session a commencé : la salle", "if (false) throw new DomainError('INVARIANT_VIOLATION', 'La session a commencé : la salle", 'unit'),
 ('S11 report accepté après le début', sess, "if (this.hasStarted(today)) throw new DomainError('INVARIANT_VIOLATION', 'La session a commencé : elle", "if (false) throw new DomainError('INVARIANT_VIOLATION', 'La session a commencé : elle", 'unit'),
 ('S12 report sans motif accepté', sess, "if (!motive) throw new DomainError('VALIDATION', 'Le motif du report est obligatoire');", "if (false) throw new DomainError('VALIDATION', 'Le motif du report est obligatoire');", 'unit'),
 ('S13 report à la même date accepté', sess, "if (start === this.props.startDate) throw", "if (false) throw", 'unit'),
 ('S14 fin non recalculée au report', sess, "this.props = { ...this.props, startDate: start, endDate: endDateFor(start, rhythmOf(this.props.rhythm)) };", "this.props = { ...this.props, startDate: start };", 'unit'),
 ('S15 annulation sans motif acceptée', sess, "if (!motive) throw new DomainError('VALIDATION', \"Le motif de l'annulation est obligatoire\");", "if (false) throw new DomainError('VALIDATION', \"Le motif de l'annulation est obligatoire\");", 'unit'),
 ('S16 session clôturée annulable', sess, "if (this.props.status === 'CLOSED') throw new DomainError('INVARIANT_VIOLATION', \"Une session clôturée ne s'annule pas\");", "if (false) throw new DomainError('INVARIANT_VIOLATION', \"Une session clôturée ne s'annule pas\");", 'unit'),
 ('S17 session ouverte deux fois', sess, "if (this.props.status === 'OPEN') throw new DomainError('INVARIANT_VIOLATION', 'La session est déjà ouverte aux inscriptions');", "if (false) throw new DomainError('INVARIANT_VIOLATION', 'La session est déjà ouverte aux inscriptions');", 'unit'),
 ('S18 session annulée modifiable', sess, "if (this.props.status === 'CANCELLED') throw new DomainError('INVARIANT_VIOLATION', 'La session est annulée : elle ne se modifie plus');", "if (false) throw new DomainError('INVARIANT_VIOLATION', 'La session est annulée : elle ne se modifie plus');", 'unit'),
 ('S19 capacité au-delà des places utiles acceptée', uc, "&& session.capacity > room.usableSeats) {", "&& false) {", 'unit'),
 ('S20 module pratique accepté en salle de cours', uc, "m.requiresWorkstations) && room.kind !== 'WORKSTATIONS') {", "m.requiresWorkstations) && false) {", 'unit'),
 ('S21 chevauchement de salle ou de formateur non contrôlé', uc, "      if (first) {\n        const sameRoom", "      if (false) {\n        const sameRoom", 'unit'),
 ('S22 planifications concurrentes non sérialisées (verrou absent)', uc, "      await this.sessions.lockResources(session.roomId, session.trainerId);\n", "", 'unit'),
 ('S23 salle désactivée acceptée', uc, "if ((changes.created || changes.room) && room.status === 'ARCHIVED') throw", "if (false) throw", 'unit'),
 ('S24 formateur désactivé accepté', uc, "if ((changes.created || changes.trainer) && trainer.status === 'ARCHIVED') throw", "if (false) throw", 'unit'),
 ('S25 certificat archivé accepté', uc, "if (changes.created && training.status === 'ARCHIVED') throw", "if (false) throw", 'unit'),
 ('S26 lecture d’une session : portée du formateur ignorée', uc, "if (!trainer?.userId || !visibility.ownerIds.includes(trainer.userId)) throw new DomainError('NOT_FOUND', SESSION_NOT_FOUND);", "if (false) throw new DomainError('NOT_FOUND', SESSION_NOT_FOUND);", 'unit'),
 ('S27 liste des sessions : portée du formateur ignorée', uc, "visibleToUserIds: visibility.unrestricted ? undefined : visibility.ownerIds,", "visibleToUserIds: undefined,", 'unit'),
 ('S28 verrou optimiste absent', uc, "  assertVersion(session.version, version, 'La session');\n", "", 'unit'),
 ('S29 motif du report non tracé', uc, "newValue: { ...after, postponeReason: command.reason.trim() },", "newValue: { ...after },", 'unit'),
 ('S30 capacité non recontrôlée à la modification', uc, "(changes.created || changes.capacity || changes.room) &&", "(changes.created || changes.room) &&", 'unit'),
 ('S31 planification sous le droit de lecture', ctrl, "@Post() @HttpCode(201) @Protected('training.session.create')", "@Post() @HttpCode(201) @Protected('training.session.read')", 'db:sessions-http'),
 ('S32 annulation sous le droit de lecture', ctrl, "@Protected('training.session.cancel')", "@Protected('training.session.read')", 'db:sessions-http'),
 ('S33 report sous le droit de lecture', ctrl, "@Post(':id/postpone') @HttpCode(200) @Protected('training.session.update')", "@Post(':id/postpone') @HttpCode(200) @Protected('training.session.read')", 'db:sessions-http'),
 ('S34 verrou optimiste absent au niveau de la base', repo, "db.updateMany({ where: { id: session.id, version: session.version }", "db.updateMany({ where: { id: session.id }", 'db:sessions-http'),
 ('S35 une session annulée compte comme conflit', repo, "        status: { not: 'CANCELLED' },\n", "", 'db:sessions-http'),
 ('S36 portée du formateur ignorée en base', repo, "      ...(query.visibleToUserIds ? { trainer: { userId: { in: [...query.visibleToUserIds] } } } : {}),\n", "", 'db:sessions-http'),
 ('S37 capacité non bornée par la base', mig, "CHECK (COALESCE(\"capacity\" BETWEEN 1 AND 1000, false))", "CHECK (true)", 'db:sessions-http'),
 ('S38 dates non ordonnées acceptées par la base', mig, "CHECK (COALESCE(\"end_date\" >= \"start_date\", false))", "CHECK (true)", 'db:sessions-http'),
 ('S39 motif d’annulation non contrôlé par la base', mig, "CHECK (COALESCE((\"status\" = 'CANCELLED') = (\"cancel_reason\" IS NOT NULL), false))", "CHECK (true)", 'db:sessions-http'),
 ('S40 salle supprimable malgré ses sessions (cascade)', mig, "\"sessions_room_id_fkey\" FOREIGN KEY (\"room_id\") REFERENCES \"training\".\"rooms\"(\"id\") ON DELETE RESTRICT", "\"sessions_room_id_fkey\" FOREIGN KEY (\"room_id\") REFERENCES \"training\".\"rooms\"(\"id\") ON DELETE CASCADE", 'db:sessions-http'),
 ('S41 interface : salle de cours acceptée pour un module pratique', wlib, "else if (room && ctx.needsWorkstations === true && room.kind !== 'WORKSTATIONS')", "else if (room && ctx.needsWorkstations === true && false)", 'web'),
 ('S42 interface : capacité au-delà des places utiles acceptée', wlib, "  else if (room && capacity > room.usableSeats) errors.capacity = `La capacité dépasse les places utiles de la salle (${room.usableSeats})`;\n  return errors;\n}\n\nexport const planBody", "  return errors;\n}\n\nexport const planBody", 'web'),
 ('S43 interface : report à la même date accepté', wlib, "else if (start === session.startDate) errors.startDate", "else if (false) errors.startDate", 'web'),
 ('S44 interface : report proposé pour une session commencée', wlib, "postpone: can.update && live && !hasStarted(session, today),", "postpone: can.update && live,", 'web'),
 ('S45 interface : ouverture proposée pour une session déjà ouverte', wlib, "open: can.update && session.status === 'PLANNED',", "open: can.update && live,", 'web'),
 ('S46 interface : la salle est toujours renvoyée à la modification', wlib, "if (form.roomId !== session.roomId) body.roomId = form.roomId;", "body.roomId = form.roomId;", 'web'),
 ('S47 interface : date de fin décalée d’un jour', wlib, "let remaining = weeks * 5 - 1;", "let remaining = weeks * 5;", 'web'),
 ('S48 interface : module Sessions ouvert sans le droit de lecture', wmod, "href: '/training/sessions', permission: 'training.session.read' }", "href: '/training/sessions' }", 'web'),
 ('S49 chargement par blocs : les sessions sont toujours rechargées', seedrun, "sessions: (await prisma.db.trainingSession.count({ where: { trainer: { emailKey: { endsWith: TRAINERS_MARKER } } } })) > 0,", "sessions: false,", 'db:seed-demo'),
 ('S50 chargement par blocs : une session est classée dans le bloc commercial', seedplan, "|| op.k === 'sessionCancel') return 'sessions';", "|| op.k === 'sessionCancel') return 'crm';", 'unit'),
]
only = sys.argv[1:]
if only:
    M = [m for m in M if m[0].split(' ')[0] in only]
env = dict(os.environ, TEST_DB_PORT='54380')
def run(kind):
    if kind == 'unit':
        out = subprocess.run('pnpm exec jest src/modules/training src/cli/seed --silent', cwd=api, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True, timeout=900, shell=True).stdout
    elif kind == 'web':
        out = subprocess.run('pnpm exec vitest run test/s56-sessions.test.ts', cwd=web, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True, timeout=600, shell=True).stdout
        lines = [l for l in out.splitlines() if l.strip().startswith('Tests')]
        assert lines, 'run inconclusive: ' + out[-300:]
        return ' failed' in lines[-1]
    else:
        out = subprocess.run(['node', 'scripts/test-db.mjs', '--tests=' + kind.split(':')[1]], cwd=api, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True, timeout=800, env=env).stdout
    lines = [l for l in out.splitlines() if l.startswith('Tests:')]
    assert lines, 'run inconclusive: ' + out[-300:]
    # Une suite qui ne compile plus (le vérificateur de types refuse la faute) est aussi une faute détectée.
    return ' failed' in lines[-1] or any(l.startswith('Test Suites:') and ' failed' in l for l in out.splitlines())
res = []
for name, path, a, b, kind in M:
    raw = open(path, 'rb').read()
    s = raw.decode('utf8')
    crlf = '\r\n' in s
    text = s.replace('\r\n', '\n')
    if text.count(a) != 1:
        print(name, 'MOTIF', text.count(a), flush=True)
        res.append((name, None))
        continue
    mutated = text.replace(a, b)
    open(path, 'wb').write((mutated.replace('\n', '\r\n') if crlf else mutated).encode('utf8'))
    try:
        killed = run(kind)
    except AssertionError as e:
        print(name, 'INCONCLUANT', str(e)[:200], flush=True)
        killed = None
    finally:
        open(path, 'wb').write(raw)
    res.append((name, killed))
    print(name, {True: 'TUÉ', False: 'SURVIVANT', None: 'INCONCLUANT'}[killed], flush=True)
print('BILAN', sum(1 for _, k in res if k), '/', len(res), 'tués ;', [n for n, k in res if k is False], 'survivants ;', [n for n, k in res if k is None], 'inconcluants')
