from pathlib import Path
# Racine du dépôt : ce script se trouve dans scripts/mutants/.
REPO = Path(__file__).resolve().parents[2]
import subprocess, os, sys
api = str(REPO / 'apps' / 'api')
training = os.path.join(api, 'src', 'modules', 'training')
ev = os.path.join(training, 'domain', 'evaluation.ts')
euc = os.path.join(training, 'application', 'evaluation-use-cases.ts')
ectl = os.path.join(training, 'presentation', 'evaluation.controller.ts')
tctl = os.path.join(training, 'presentation', 'training-thresholds.controller.ts')
prep = os.path.join(training, 'infrastructure', 'prisma-evaluation.repository.ts')
tprep = os.path.join(training, 'infrastructure', 'prisma-training-thresholds.repository.ts')
mig = os.path.join(api, 'prisma', 'migrations', '20261123000000_s5_3b_evaluations_et_seuils', 'migration.sql')
roles = os.path.join(api, 'src', 'modules', 'iam', 'domain', 'roles.ts')
cat = os.path.join(api, 'src', 'modules', 'iam', 'domain', 'permission-catalog.ts')
DB = 'db:sessions-http'
M = [
 # --- Domaine : note sur 20
 ('D1 une note négative est acceptée', ev, "raw < MIN_SCORE || raw > MAX_SCORE", "raw > MAX_SCORE", 'unit'),
 ('D2 une note au-dessus de 20 est acceptée', ev, "raw < MIN_SCORE || raw > MAX_SCORE || Math.round(raw * 100) !== raw * 100", "raw < MIN_SCORE || Math.round(raw * 100) !== raw * 100", 'unit'),
 ('D3 plus de deux décimales sont acceptées', ev, "Math.round(raw * 100) !== raw * 100", "false", 'unit'),
 ('D4 une évaluation commence à la version 2', ev, "createdAt: input.now, updatedAt: input.now, version: 1,", "createdAt: input.now, updatedAt: input.now, version: 2,", 'unit'),
 ('D5 corriger ne retient plus le dernier auteur', ev, "this.props = { ...this.props, score: parseScore(input.score), recordedByUserId: input.by, updatedAt: input.now };", "this.props = { ...this.props, score: parseScore(input.score), updatedAt: input.now };", 'unit'),
 # --- Domaine : seuils et calcul d'éligibilité
 ('D6 un taux de présence hors 0-100 est accepté', ev, "attendanceThresholdPercent < 0 || attendanceThresholdPercent > 100", "attendanceThresholdPercent > 100", 'unit'),
 ('D7 les seuils acceptent une note hors barème', ev, "parseScore(scoreThreshold);", "", 'unit'),
 ('D8 le taux de présence n’est plus comparé au seuil (toujours atteint)', ev, "const attendanceOk = attendanceRatePercent >= thresholds.attendanceThresholdPercent;", "const attendanceOk = true;", 'unit'),
 ('D9 un certificat se suggère sans que la note atteigne le seuil', ev, "if (score !== null && score >= thresholds.scoreThreshold) return 'CERTIFICATE';", "if (score !== null) return 'CERTIFICATE';", 'unit'),
 # --- Cas d'usage : saisir une évaluation
 ('U1 une inscription d’une autre session est acceptée', euc, "if (!enrollment || enrollment.sessionId !== session.id) throw new DomainError('NOT_FOUND', ENROLLMENT_NOT_FOUND);", "if (!enrollment) throw new DomainError('NOT_FOUND', ENROLLMENT_NOT_FOUND);", 'unit'),
 ('U2 une inscription non confirmée est évaluable', euc, "if (enrollment.status !== 'CONFIRMED') throw new DomainError('INVARIANT_VIOLATION', 'Seuls les inscrits confirmés ont une évaluation');", "if (false) throw new DomainError('INVARIANT_VIOLATION', 'Seuls les inscrits confirmés ont une évaluation');", 'unit'),
 ('U3 une session clôturée accepte une saisie', euc, "if (session.status === 'CLOSED') throw new DomainError('INVARIANT_VIOLATION', 'La session est clôturée : les évaluations sont figées (il faut la rouvrir)');", "if (false) throw new DomainError('INVARIANT_VIOLATION', 'La session est clôturée : les évaluations sont figées (il faut la rouvrir)');", 'unit'),
 ('U4 redéclarer la même note écrit dans le journal', euc, "if (existing.score === command.score) return toEvaluationView(existing);", "", 'unit'),
 ('U5 corriger est tracé comme une création', euc, "action: AuditAction.Update, oldValue: { ...before }, newValue: { ...after } });\n        return after;\n      }\n      const created = Evaluation.record", "action: AuditAction.Create, oldValue: { ...before }, newValue: { ...after } });\n        return after;\n      }\n      const created = Evaluation.record", 'unit'),
 ('U6 la création est tracée comme une correction', euc, "action: AuditAction.Create, newValue: { ...view } });\n      return view;\n    });\n  }\n}\n\n/** Taux de présence", "action: AuditAction.Update, newValue: { ...view } });\n      return view;\n    });\n  }\n}\n\n/** Taux de présence", 'unit'),
 # --- Cas d'usage : taux de présence et feuille
 ('U7 un retard ne compte plus comme présent (S3)', euc, "const counted = entries.filter((e) => e.status === 'PRESENT' || e.status === 'LATE').length;", "const counted = entries.filter((e) => e.status === 'PRESENT').length;", 'unit'),
 ('U8 la feuille montre les inscrits non confirmés', euc, "const confirmed = await this.enrollments.listConfirmed(session.id);", "const confirmed = await this.enrollments.listSeats(session.id);", DB),
 ('U9 la feuille peut se saisir même clôturée', euc, "return { sessionId: session.id, sessionStatus: session.status, rows, canRecord: session.status !== 'CLOSED' };", "return { sessionId: session.id, sessionStatus: session.status, rows, canRecord: true };", 'unit'),
 ('U10 les lignes sont triées à l’envers', euc, "rows.sort((a, b) => a.learnerName.localeCompare(b.learnerName, 'fr') || a.enrollmentId.localeCompare(b.enrollmentId));", "rows.sort((a, b) => b.learnerName.localeCompare(a.learnerName, 'fr'));", 'unit'),
 # --- Cas d'usage : seuils
 ('U11 modifier les seuils ne demande plus le droit de gérer', euc, "if (scopeOf(access, 'training.evaluation.manage') === null) throw new DomainError('FORBIDDEN', \"Vous n'avez pas le droit de modifier les seuils d'éligibilité\");", "if (false) throw new DomainError('FORBIDDEN', \"Vous n'avez pas le droit de modifier les seuils d'éligibilité\");", 'unit'),
 ('U12 lire les seuils ne demande plus de droit', euc, "if (scopeOf(query.access, 'training.evaluation.read') === null) throw new DomainError('FORBIDDEN', \"Vous n'avez pas le droit de voir les seuils d'éligibilité\");", "if (false) throw new DomainError('FORBIDDEN', \"Vous n'avez pas le droit de voir les seuils d'éligibilité\");", 'unit'),
 ('U13 les seuils acceptent des valeurs invalides', euc, "requireManage(command.access);\n      validateTrainingThresholds(command);", "requireManage(command.access);", 'unit'),
 ('U14 une version périmée des seuils est acceptée', euc, "if (current.version !== command.version) throw new DomainError('CONFLICT', \"Les seuils d'éligibilité ont été modifiés par un autre utilisateur : rechargez-les\");", "if (false) throw new DomainError('CONFLICT', \"Les seuils d'éligibilité ont été modifiés par un autre utilisateur : rechargez-les\");", 'unit'),
 # --- Routes
 ('R1 saisir une évaluation répond 201 au lieu de 200', ectl, "@Put(':enrollmentId') @HttpCode(200) @Protected('training.evaluation.record')", "@Put(':enrollmentId') @HttpCode(201) @Protected('training.evaluation.record')", DB),
 ('R2 lire et saisir une évaluation exigent la même permission', ectl, "@Put(':enrollmentId') @HttpCode(200) @Protected('training.evaluation.record')", "@Put(':enrollmentId') @HttpCode(200) @Protected('training.evaluation.read')", DB),
 ('R3 lire et gérer les seuils exigent la même permission', tctl, "@Put() @Protected('training.evaluation.manage')", "@Put() @Protected('training.evaluation.read')", DB),
 # --- Persistance : évaluations
 ('P1 un conflit d’unicité n’est plus un conflit', prep, "if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') throw new DomainError('CONFLICT', 'Une évaluation est déjà saisie pour cette inscription : rechargez la page');", "if (false) throw new DomainError('CONFLICT', 'Une évaluation est déjà saisie pour cette inscription : rechargez la page');", DB),
 ('P2 corriger ne retient plus le dernier auteur en base', prep, "data: { score: evaluation.score, recordedByUserId: evaluation.recordedByUserId, version: { increment: 1 } }", "data: { score: evaluation.score, version: { increment: 1 } }", DB),
 ('P3 la version n’augmente plus', prep, "data: { score: evaluation.score, recordedByUserId: evaluation.recordedByUserId, version: { increment: 1 } }", "data: { score: evaluation.score, recordedByUserId: evaluation.recordedByUserId, version: { increment: 0 } }", DB),
 # --- Persistance : seuils
 ('P4 une version périmée des seuils s’enregistre quand même', tprep, "where: { id: 1, version: thresholds.version },", "where: { id: 1 },", DB),
 # --- Garanties de la base
 ('G1 plusieurs évaluations pour la même inscription sont permises', mig, 'CREATE UNIQUE INDEX "evaluations_enrollment_id_key" ON "training"."evaluations"("enrollment_id");', '', DB),
 ('G2 l’inscription d’une évaluation n’est plus contrôlée', mig, 'ALTER TABLE "training"."evaluations" ADD CONSTRAINT "evaluations_enrollment_id_fkey" FOREIGN KEY ("enrollment_id") REFERENCES "training"."enrollments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;', '', DB),
 ('G3 une note hors barème s’enregistre quand même', mig, 'ALTER TABLE "training"."evaluations" ADD CONSTRAINT "evaluations_score_range" CHECK (COALESCE("score" >= 0 AND "score" <= 20, false));', '', DB),
 ('G4 plusieurs lignes de seuils sont permises', mig, 'ALTER TABLE "training"."training_thresholds" ADD CONSTRAINT "training_thresholds_single_row" CHECK ("id" = 1);', '', DB),
 # --- Droits
 ('L1 le formateur retrouve le droit de saisir ou lire une évaluation', roles, "    g('training.certification.read', Own),", "    g('training.evaluation.read', Own), g('training.evaluation.record', Own),\n    g('training.certification.read', Own),", 'unit:roles'),
 ('L2 l’action « gérer les seuils » disparaît du catalogue', cat, "{ module: 'training', resource: 'evaluation', label: 'Évaluations', actions: ['read', 'record', 'manage'] },", "{ module: 'training', resource: 'evaluation', label: 'Évaluations', actions: ['read', 'record'] },", 'unit:roles'),
]
only = sys.argv[1:]
if only:
    M = [m for m in M if m[0].split(' ')[0] in only]
env = dict(os.environ, TEST_DB_PORT='54485')
SPECS = {
    ev: 'src/modules/training/domain/evaluation.spec.ts',
    euc: 'src/modules/training/application/evaluation-use-cases.spec.ts',
    roles: 'src/modules/iam/domain/roles.spec.ts',
    cat: 'src/modules/iam/domain/roles.spec.ts',
}


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
