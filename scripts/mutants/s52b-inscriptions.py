from pathlib import Path
# Racine du dépôt : ce script se trouve dans scripts/mutants/.
REPO = Path(__file__).resolve().parents[2]
import subprocess, os, sys
api = str(REPO / 'apps' / 'crm-api')
web = str(REPO / 'apps' / 'crm-web')
base = os.path.join(api, 'src', 'modules', 'training')
cover = os.path.join(base, 'domain', 'approval-cover.ts')
money = os.path.join(base, 'domain', 'money.ts')
enr = os.path.join(base, 'domain', 'enrollment.ts')
lrn = os.path.join(base, 'domain', 'learner.ts')
euc = os.path.join(base, 'application', 'enrollment-use-cases.ts')
luc = os.path.join(base, 'application', 'learner-use-cases.ts')
suc = os.path.join(base, 'application', 'session-use-cases.ts')
ctrl = os.path.join(base, 'presentation', 'enrollment.controllers.ts')
repo = os.path.join(base, 'infrastructure', 'prisma-enrollment.repositories.ts')
mig = os.path.join(api, 'prisma', 'migrations', '20261114000000_s5_2b_inscriptions', 'migration.sql')
wlib = os.path.join(web, 'lib', 'enrollments.ts')
wmod = os.path.join(web, 'lib', 'modules.ts')
seedrun = os.path.join(api, 'src', 'cli', 'seed', 'run-seed.ts')
seedplan = os.path.join(api, 'src', 'cli', 'seed', 'seed-plan.ts')
M = [
 ('E1 agrément seulement demandé accepté', cover, "if (approval.status === 'REQUESTED') throw", "if (false) throw", 'unit'),
 ('E2 agrément expiré accepté', cover, "if (approval.status === 'EXPIRED') throw", "if (false) throw", 'unit'),
 ('E3 agrément annulé accepté', cover, "if (approval.status === 'CANCELLED') throw", "if (false) throw", 'unit'),
 ('E4 dernier jour de validité refusé', cover, "approval.validUntil < sessionStart", "approval.validUntil <= sessionStart", 'unit'),
 ('E5 plafond de places décalé d’une unité', cover, "used.places + 1 > approval.places", "used.places > approval.places", 'unit'),
 ('E6 somme exactement épuisée refusée', cover, "if (price > remaining) {", "if (price >= remaining) {", 'unit'),
 ('E7 certificat sans prix accepté sous un agrément en somme', cover, "if (certificate.fullPrice === null) {", "if (false) {", 'unit'),
 ('E8 devise différente acceptée', cover, "if (certificate.currency !== approval.currency) {", "if (false) {", 'unit'),
 ('E9 consommation de la somme ignorée', cover, "const remaining = toCents(approval.amount) - used.cents;", "const remaining = toCents(approval.amount) - 0;", 'unit'),
 ('E10 centimes mal convertis', money, "Number(match[1]) * 100 +", "Number(match[1]) * 10 +", 'unit'),
 ('E11 confirmation d’une inscription annulée', enr, "if (this.props.status !== 'PENDING') throw", "if (false) throw", 'unit'),
 ('E12 annulation d’inscription sans motif', enr, "if (!motive) throw new DomainError('VALIDATION', \"Le motif de l'annulation est obligatoire\");", "if (false) throw new DomainError('VALIDATION', \"Le motif de l'annulation est obligatoire\");", 'unit'),
 ('E13 une inscription confirmée n’occupe plus de place', enr, "export const SEAT_STATUSES: readonly EnrollmentStatus[] = ['PENDING', 'CONFIRMED'];", "export const SEAT_STATUSES: readonly EnrollmentStatus[] = ['PENDING'];", 'unit'),
 ('E14 « à replacer » depuis n’importe quel état', enr, "if (!SEAT_STATUSES.includes(this.props.status)) throw", "if (false) throw", 'unit'),
 ('E15 inscription annulée deux fois', enr, "if (this.props.status === 'CANCELLED') throw new DomainError('INVARIANT_VIOLATION', \"L'inscription est déjà annulée\");", "if (false) throw new DomainError('INVARIANT_VIOLATION', \"L'inscription est déjà annulée\");", 'unit'),
 ('E16 e-mail d’apprenant non normalisé', lrn, "email: normalizeEmail(input.email),", "email: input.email ?? null,", 'unit'),
 ('E17 apprenant supprimé modifiable', lrn, "if (this.props.deletedAt) throw", "if (false) throw", 'unit'),
 ('E18 inscription à une session non ouverte', euc, "if (session.status === 'PLANNED') throw", "if (false) throw", 'unit'),
 ('E19 doublon d’inscription accepté', euc, "if (await this.enrollments.hasLive(session.id, learner.id)) throw", "if (false) throw", 'unit'),
 ('E20 recouvrement de sessions ignoré', euc, "    if (overlap) {\n      const other", "    if (false) {\n      const other", 'unit'),
 ('E21 session complète acceptée', euc, "if (taken >= session.capacity) throw", "if (false) throw", 'unit'),
 ('E22 agrément d’une autre entreprise accepté', euc, "if (!approval || approval.companyId !== learner.companyId) throw", "if (!approval) throw", 'unit'),
 ('E23 agrément non verrouillé', euc, "    await this.directory.lockApproval(approval.id);\n", "", 'unit'),
 ('E24 session non verrouillée à l’inscription', euc, "\"L'entreprise est archivée : on ne peut plus y inscrire d'apprenant\");\n      await this.enrollments.lockSession(command.sessionId);", "\"L'entreprise est archivée : on ne peut plus y inscrire d'apprenant\");", 'unit'),
 ('E25 entreprise archivée acceptée à l’inscription', euc, "if (company.archived) throw new DomainError('INVARIANT_VIOLATION', \"L'entreprise est archivée : on ne peut plus y inscrire", "if (false) throw new DomainError('INVARIANT_VIOLATION', \"L'entreprise est archivée : on ne peut plus y inscrire", 'unit'),
 ('E26 agrément non revérifié à la confirmation', euc, "      assertApprovalValid(approval, session.startDate);\n", "", 'unit'),
 ('E27 confirmation sur une session plus ouverte', euc, "if (session.status !== 'OPEN') throw new DomainError('INVARIANT_VIOLATION', 'La session n\\'est plus ouverte aux inscriptions');", "if (false) throw new DomainError('INVARIANT_VIOLATION', 'La session n\\'est plus ouverte aux inscriptions');", 'unit'),
 ('E28 annulation sur une session clôturée', euc, "if (session?.status === 'CLOSED') throw new DomainError('INVARIANT_VIOLATION', \"Une inscription d'une session clôturée ne s'annule pas\");", "if (false) throw new DomainError('INVARIANT_VIOLATION', \"Une inscription d'une session clôturée ne s'annule pas\");", 'unit'),
 ('E29 replacement sur la même session', euc, "if (command.sessionId === old.sessionId) throw", "if (false) throw", 'unit'),
 ('E30 replacement d’une inscription annulée', euc, "if (old.status === 'CANCELLED') throw new DomainError('INVARIANT_VIOLATION', \"L'inscription est annulée : inscrivez de nouveau l'apprenant\");", "if (false) throw new DomainError('INVARIANT_VIOLATION', \"L'inscription est annulée : inscrivez de nouveau l'apprenant\");", 'unit'),
 ('E31 lien avec le remplacement absent', euc, "      cancelled.linkReplacement(replacement.id);\n", "", 'unit'),
 ('E32 pourquoi un agrément ne couvre pas : raison perdue', euc, "reason = error.message;", "reason = null;", 'unit'),
 ('E33 suppression d’un apprenant confirmé acceptée', luc, "if (await this.enrollments.hasConfirmed(learner.id)) {", "if (false) {", 'unit'),
 ('E34 doublon d’apprenant non signalé à la création', luc, "      await assertNoDuplicate(this.learners, learner, command.allowDuplicate);\n", "", 'unit'),
 ('E35 contact d’une autre entreprise accepté', luc, "if (contactId && !(await directory.contactBelongsTo(contactId, companyId))) {", "if (false) {", 'unit'),
 ('E36 liste des apprenants : portée ignorée', luc, "companyId: query.companyId, ownerIds: visibility.unrestricted ? undefined : visibility.ownerIds,", "companyId: query.companyId, ownerIds: undefined,", 'unit'),
 ('E37 liste des inscriptions : portée ignorée', euc, "      ownerIds: visibility.unrestricted ? undefined : visibility.ownerIds,\n    });\n    return { ...result, items: await this.views.many(result.items) };", "      ownerIds: undefined,\n    });\n    return { ...result, items: await this.views.many(result.items) };", 'unit'),
 ('E38 apprenant lu hors de la portée de son entreprise', luc, "if (!learner || !company || !decideFor(access, permission, company.ownerUserId).allowed) throw new DomainError('NOT_FOUND', NOT_FOUND_LEARNER);", "if (!learner || !company) throw new DomainError('NOT_FOUND', NOT_FOUND_LEARNER);", 'unit'),
 ('E39 inscription lue hors de la portée de son entreprise', euc, "if (!enrollment || !company || !decideFor(access, permission, company.ownerUserId).allowed) throw new DomainError('NOT_FOUND', NOT_FOUND_ENROLLMENT);", "if (!enrollment || !company) throw new DomainError('NOT_FOUND', NOT_FOUND_ENROLLMENT);", 'unit'),
 ('E40 annuler une session ne place pas les inscriptions « à replacer »', suc, "        enrollment.markToReplace();\n", "", 'unit'),
 ('E41 capacité sous le nombre d’inscrits acceptée', suc, "if (session.capacity < taken) throw", "if (false) throw", 'unit'),
 ('E42 report qui recouvre une autre session de l’inscrit accepté', suc, "if (overlap) throw new DomainError('CONFLICT', `Un apprenant inscrit", "if (false) throw new DomainError('CONFLICT', `Un apprenant inscrit", 'unit'),
 ('E43 places occupées d’une session non comptées', suc, "enrolled: seats.get(session.id) ?? 0", "enrolled: 0", 'unit'),
 ('E44 inscription sous le droit de lecture', ctrl, "@Post() @HttpCode(201) @Protected('training.enrollment.create')", "@Post() @HttpCode(201) @Protected('training.enrollment.read')", 'db:enrollments-http'),
 ('E45 confirmation sous le droit de lecture', ctrl, "@Post(':id/confirm') @HttpCode(200) @Protected('training.enrollment.update')", "@Post(':id/confirm') @HttpCode(200) @Protected('training.enrollment.read')", 'db:enrollments-http'),
 ('E46 annulation sous le droit de lecture', ctrl, "@Post(':id/cancel') @HttpCode(200) @Protected('training.enrollment.cancel')", "@Post(':id/cancel') @HttpCode(200) @Protected('training.enrollment.read')", 'db:enrollments-http'),
 ('E47 suppression d’apprenant sous le droit de modification', ctrl, "@Delete(':id') @HttpCode(204) @Protected('training.learner.delete')", "@Delete(':id') @HttpCode(204) @Protected('training.learner.update')", 'db:enrollments-http'),
 ('E48 verrou optimiste absent au niveau de la base', repo, "db.updateMany({ where: { id: enrollment.id, version: enrollment.version }", "db.updateMany({ where: { id: enrollment.id }", 'db:enrollments-http'),
 ('E49 une inscription annulée consomme encore l’agrément', repo, "findMany({ where: { approvalId, status: { in: seatStatuses } }, select: { chargedAmount: true } })", "findMany({ where: { approvalId }, select: { chargedAmount: true } })", 'db:enrollments-http'),
 ('E50 une inscription annulée occupe encore une place', repo, "return this.prisma.db.enrollment.count({ where: { sessionId, status: { in: seatStatuses } } });", "return this.prisma.db.enrollment.count({ where: { sessionId } });", 'db:enrollments-http'),
 ('E51 liste des inscriptions : portée ignorée en base', repo, "      ...(query.status ? { status: query.status } : {}),\n      ...(query.ownerIds ? { company: { ownerUserId: { in: [...query.ownerIds] } } } : {}),\n", "      ...(query.status ? { status: query.status } : {}),\n", 'db:enrollments-http'),
 ('E52 une inscription annulée bloque une nouvelle inscription', repo, "where: { sessionId, learnerId, status: { not: 'CANCELLED' } } })) > 0;", "where: { sessionId, learnerId } })) > 0;", 'db:enrollments-http'),
 ('E53 index unique « une inscription vivante par apprenant et par session » absent', mig, "CREATE UNIQUE INDEX \"enrollments_one_live_per_learner_session\" ON \"training\".\"enrollments\"(\"session_id\", \"learner_id\") WHERE \"status\" <> 'CANCELLED';", "", 'db:enrollments-http'),
 ('E54 motif d’annulation non contrôlé par la base', mig, "CHECK (COALESCE((\"status\" = 'CANCELLED') = (\"cancel_reason\" IS NOT NULL), false))", "CHECK (true)", 'db:enrollments-http'),
 ('E55 date de confirmation non contrôlée par la base', mig, "CHECK (COALESCE(\"status\" <> 'CONFIRMED' OR \"confirmed_at\" IS NOT NULL, false))", "CHECK (true)", 'db:enrollments-http'),
 ('E56 montant compté non contrôlé par la base', mig, "CHECK (COALESCE(\"charged_amount\" IS NULL OR \"charged_amount\" > 0, false))", "CHECK (true)", 'db:enrollments-http'),
 ('E57 apprenant supprimable malgré ses inscriptions (cascade)', mig, "\"enrollments_learner_id_fkey\" FOREIGN KEY (\"learner_id\") REFERENCES \"training\".\"learners\"(\"id\") ON DELETE RESTRICT", "\"enrollments_learner_id_fkey\" FOREIGN KEY (\"learner_id\") REFERENCES \"training\".\"learners\"(\"id\") ON DELETE CASCADE", 'db:enrollments-http'),
 ('E58 téléphone d’apprenant non contrôlé par la base', mig, "CHECK (COALESCE(\"phone\" IS NULL OR \"phone\" ~ '^\\+?[1-9][0-9]{7,14}$', false))", "CHECK (true)", 'db:enrollments-http'),
 ('E59 interface : entreprise exigée à la modification', wlib, "if (!editing && !form.companyId)", "if (!form.companyId)", 'web'),
 ('E60 interface : agrément indisponible accepté', wlib, "    if (option && !option.eligible) errors.approvalId = option.reason ?? 'Cet agrément ne peut pas couvrir cette inscription';\n  }", "  }", 'web'),
 ('E61 interface : confirmation proposée sur une session non ouverte', wlib, "confirm: can.confirm && e.status === 'PENDING' && e.sessionStatus === 'OPEN',", "confirm: can.confirm && e.status === 'PENDING',", 'web'),
 ('E62 interface : annulation proposée sur une session clôturée', wlib, "cancel: can.cancel && !closed && e.status !== 'CANCELLED',", "cancel: can.cancel && e.status !== 'CANCELLED',", 'web'),
 ('E63 interface : l’entreprise renvoyée à la modification', wlib, "if (extra.version === undefined) body.companyId = form.companyId;\n  else body.version = extra.version;", "body.companyId = form.companyId;\n  if (extra.version !== undefined) body.version = extra.version;", 'web'),
 ('E64 interface : session complète non reconnue', wlib, "export const isFull = (enrolled: number, capacity: number): boolean => enrolled >= capacity;", "export const isFull = (enrolled: number, capacity: number): boolean => enrolled > capacity;", 'web'),
 ('E65 interface : module Apprenants ouvert sans le droit de lecture', wmod, "href: '/training/learners', permission: 'training.learner.read' }", "href: '/training/learners' }", 'web'),
 ('E66 interface : téléphone envoyé avec ses espaces', wlib, "phone: form.phone.trim() ? cleanPhone(form.phone) : '',", "phone: form.phone.trim(),", 'web'),
 ('E67 interface : replacement sur la même session accepté', wlib, "else if (form.sessionId === current.sessionId) errors.sessionId", "else if (false) errors.sessionId", 'web'),
 ('E68 chargement par blocs : les inscriptions sont toujours rechargées', seedrun, "inscriptions: (await prisma.db.company.count({ where: { name: FORMATION_CLIENTS[0]![0] } })) > 0,", "inscriptions: false,", 'db:seed-demo'),
 ('E69 chargement par blocs : un apprenant est classé dans le bloc commercial', seedplan, "if (op.k === 'learner' || op.k === 'enroll' || op.k === 'enrollConfirm' || op.k === 'enrollCancel' || op.k === 'enrollReplace') return 'inscriptions';", "if (op.k === 'learner' || op.k === 'enroll' || op.k === 'enrollConfirm' || op.k === 'enrollCancel' || op.k === 'enrollReplace') return 'crm';", 'unit'),
]
only = sys.argv[1:]
if only:
    M = [m for m in M if m[0].split(' ')[0] in only]
env = dict(os.environ, TEST_DB_PORT='54410')
def run(kind):
    if kind == 'unit':
        out = subprocess.run('pnpm exec jest src/modules/training src/cli/seed --silent', cwd=api, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True, timeout=900, shell=True).stdout
    elif kind == 'web':
        out = subprocess.run('pnpm exec vitest run test/s57-enrollments.test.ts', cwd=web, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True, timeout=600, shell=True).stdout
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
