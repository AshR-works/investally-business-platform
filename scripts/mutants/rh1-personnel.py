from pathlib import Path
# Racine du dépôt : ce script se trouve dans scripts/mutants/.
REPO = Path(__file__).resolve().parents[2]
import subprocess, os, sys
api = str(REPO / 'apps' / 'api')
web = str(REPO / 'apps' / 'web')
hr = os.path.join(api, 'src', 'modules', 'hr')
emp = os.path.join(hr, 'domain', 'employee.ts')
uc = os.path.join(hr, 'application', 'employee-use-cases.ts')
repo = os.path.join(hr, 'infrastructure', 'prisma-employee.repository.ts')
mig = os.path.join(api, 'prisma', 'migrations', '20261116000000_rh_1a_employees', 'migration.sql')
roles = os.path.join(api, 'src', 'modules', 'iam', 'domain', 'roles.ts')
seedrun = os.path.join(api, 'src', 'cli', 'seed', 'run-seed.ts')
seedplan = os.path.join(api, 'src', 'cli', 'seed', 'seed-plan.ts')
wlib = os.path.join(web, 'lib', 'hr.ts')
wmod = os.path.join(web, 'lib', 'modules.ts')
wperm = os.path.join(web, 'lib', 'permissions.ts')
HR = 'db:hr-employees-http'
M = [
 # --- Domaine de l'employé
 ('H1 matricule non mis en majuscules', emp, "const value = (raw ?? '').trim().toUpperCase();", "const value = (raw ?? '').trim();", 'unit'),
 ('H2 matricule : n’importe quel caractère admis', emp, "const MATRICULE = /^[A-Z0-9][A-Z0-9._/-]{0,29}$/;", "const MATRICULE = /^.{0,30}$/;", 'unit'),
 ('H3 son propre responsable accepté à la création', emp, "if (input.managerEmployeeId && input.managerEmployeeId === input.id) throw", "if (false) throw", 'unit'),
 ('H4 son propre responsable accepté à la modification', emp, "if (next.managerEmployeeId === this.props.id) throw", "if (false) throw", 'unit'),
 ('H5 employé archivé modifiable', emp, "if (this.isArchived) throw new DomainError('CONFLICT', \"L'employé est archivé", "if (false) throw new DomainError('CONFLICT', \"L'employé est archivé", 'unit'),
 ('H6 double archivage accepté', emp, "if (this.isArchived) throw new DomainError('CONFLICT', \"L'employé est déjà archivé\");", "if (false) throw new DomainError('CONFLICT', \"L'employé est déjà archivé\");", 'unit'),
 ('H7 réactivation d’un employé en poste acceptée', emp, "if (!this.isArchived) throw new DomainError('CONFLICT', \"L'employé n'est pas archivé\");", "if (false) throw new DomainError('CONFLICT', \"L'employé n'est pas archivé\");", 'unit'),
 ('H8 sortie avant l’entrée acceptée', emp, "if (leftOn < this.props.hiredOn) throw", "if (false) throw", 'unit'),
 ('H9 la réactivation garde la date de sortie', emp, "archiveReason: null, leftOn: null };", "archiveReason: null };", 'unit'),
 ('H10 champ obligatoire vide accepté', emp, "if (!value) throw new DomainError('VALIDATION', `${label} est obligatoire`);", "if (false) throw new DomainError('VALIDATION', `${label} est obligatoire`);", 'unit'),
 ('H11 longueur maximale ignorée', emp, "if (value.length > max) throw", "if (false) throw", 'unit'),
 ('H12 date irréelle acceptée', emp, "if (!valid) throw new DomainError('VALIDATION', `${label} doit être", "if (false) throw new DomainError('VALIDATION', `${label} doit être", 'unit'),
 # --- Cas d'usage
 ('U1 création sans le droit', uc, "if (!decideFor(command.access, 'hr.employee.create', null).allowed) throw", "if (false) throw", 'unit'),
 ('U2 portée ignorée (fiche d’un autre visible)', uc, "if (!employee || !decideFor(access, permission, employee.userId).allowed) throw new DomainError('NOT_FOUND', NOT_FOUND);", "if (!employee) throw new DomainError('NOT_FOUND', NOT_FOUND);", 'unit'),
 ('U3 version de la modification non contrôlée', uc, "if (employee.version !== command.version) throw new DomainError('CONFLICT', \"L'employé a été modifié par un autre utilisateur : rechargez-le avant de le modifier\");", "if (false) throw new DomainError('CONFLICT', \"L'employé a été modifié par un autre utilisateur : rechargez-le avant de le modifier\");", 'unit'),
 ('U4 version de l’archivage non contrôlée', uc, "if (employee.version !== command.version) throw new DomainError('CONFLICT', \"L'employé a été modifié par un autre utilisateur : rechargez-le avant de continuer\");", "if (false) throw new DomainError('CONFLICT', \"L'employé a été modifié par un autre utilisateur : rechargez-le avant de continuer\");", 'unit'),
 ('U5 boucle dans la hiérarchie acceptée', uc, "if (current.id === employeeId) throw new DomainError('VALIDATION', 'Ce responsable créerait une boucle dans la hiérarchie');", "if (false) throw new DomainError('VALIDATION', 'Ce responsable créerait une boucle dans la hiérarchie');", 'unit'),
 ('U6 responsable archivé accepté', uc, "if (current.isArchived) throw new DomainError('VALIDATION', 'Le responsable est archivé", "if (false) throw new DomainError('VALIDATION', 'Le responsable est archivé", 'unit'),
 ('U7 responsable inconnu accepté', uc, "if (!current) throw new DomainError('NOT_FOUND', 'Responsable introuvable');", "if (false) throw new DomainError('NOT_FOUND', 'Responsable introuvable');", 'unit'),
 ('U8 compte inconnu accepté', uc, "if (!(await users.find(userId))) throw new DomainError('NOT_FOUND', 'Compte utilisateur introuvable');", "if (false) throw new DomainError('NOT_FOUND', 'Compte utilisateur introuvable');", 'unit'),
 ('U9 compte déjà lié à un autre employé accepté', uc, "if (other) throw new DomainError('CONFLICT', `Ce compte est déjà lié", "if (false) throw new DomainError('CONFLICT', `Ce compte est déjà lié", 'unit'),
 ('U10 matricule déjà pris accepté', uc, "if (other) throw new DomainError('CONFLICT', `Le matricule", "if (false) throw new DomainError('CONFLICT', `Le matricule", 'unit'),
 ('U11 e-mail professionnel déjà pris accepté', uc, "if (other) throw new DomainError('CONFLICT', `Un employé (« ", "if (false) throw new DomainError('CONFLICT', `Un employé (« ", 'unit'),
 ('U12 responsable avec des collaborateurs archivable', uc, "if (team.length > 0) throw new DomainError('INVARIANT_VIOLATION'", "if (false) throw new DomainError('INVARIANT_VIOLATION'", 'unit'),
 ('U13 lecture détaillée non tracée', uc, "await this.audit.record({ actor: query.actor, module: 'hr', entityType: 'Employee', entityId: employee.id, action: AuditAction.View });", "void 0;", 'unit'),
 ('U14 portée de la liste ignorée', uc, "userIds: visibility.unrestricted ? undefined : visibility.ownerIds,", "userIds: undefined,", 'unit'),
 ('U15 écarts ouverts à tous', uc, "if (!visibilityFor(query.access, 'hr.employee.read').unrestricted) throw new DomainError('FORBIDDEN'", "if (false) throw new DomainError('FORBIDDEN'", 'unit'),
 ('U16 écart signalé même quand les responsables concordent', uc, "if (!account || account.managerUserId === hrManager.userId) continue;", "if (!account) continue;", 'unit'),
 ('U17 comptes déjà liés encore proposés', uc, ".filter((u) => !linked.has(u.id))", ".filter(() => true)", 'unit'),
 ('U18 comptes à lier proposés sans le droit de modification', uc, "if (!decideFor(query.access, 'hr.employee.update', null).allowed) throw new DomainError('FORBIDDEN', \"Vous n'avez pas le droit de lier", "if (false) throw new DomainError('FORBIDDEN', \"Vous n'avez pas le droit de lier", 'unit'),
 # --- Base de données et persistance
 ('B1 verrou optimiste de la base retiré', repo, "where: { id: employee.id, version: employee.version }", "where: { id: employee.id }", HR),
 ('B2 l’annuaire montre aussi les archivés', repo, "      status: 'ACTIVE',\n      ...(query.department", "      ...(query.department", HR),
 ('B3 portée de la liste ignorée en base', repo, "...(query.userIds ? { userId: { in: [...query.userIds] } } : {}),", "", HR),
 ('B4 matricule non unique en base', mig, "CREATE UNIQUE INDEX \"employees_matricule_unique\"", "CREATE INDEX \"employees_matricule_unique\"", HR),
 ('B5 e-mail professionnel non unique en base', mig, "CREATE UNIQUE INDEX \"employees_work_email_unique\"", "CREATE INDEX \"employees_work_email_unique\"", HR),
 ('B6 compte lié non unique en base', mig, "CREATE UNIQUE INDEX \"employees_user_id_unique\"", "CREATE INDEX \"employees_user_id_unique\"", HR),
 ('B7 état et dates incohérents acceptés par la base', mig, "OR (\"status\" = 'ACTIVE' AND \"archived_at\" IS NULL AND \"archive_reason\" IS NULL AND \"left_on\" IS NULL)", "OR (\"status\" = 'ACTIVE')", HR),
 ('B8 son propre responsable accepté par la base', mig, "COALESCE(\"manager_employee_id\" IS NULL OR \"manager_employee_id\" <> \"id\", false)", "true", HR),
 ('B9 sortie avant l’entrée acceptée par la base', mig, "COALESCE(\"left_on\" IS NULL OR \"left_on\" >= \"hired_on\", false)", "true", HR),
 ('B10 un responsable avec des collaborateurs se supprime (cascade)', mig, "REFERENCES \"hr\".\"employees\"(\"id\") ON DELETE RESTRICT", "REFERENCES \"hr\".\"employees\"(\"id\") ON DELETE CASCADE", HR),
 ('B11 version non positive acceptée par la base', mig, "CHECK (\"version\" >= 1)", "CHECK (true)", HR),
 # --- Droits (matrice des rôles)
 ('P1 l’annuaire n’est plus lisible par la Fiscalité', roles, "[RoleCode.Tax]: [g('hr.employee.read', Own), g('hr.directory.read', All),", "[RoleCode.Tax]: [g('hr.employee.read', Own),", 'unit'),
 ('P2 la RH ne peut plus archiver', roles, "g('hr.employee.archive', All),", "", 'unit'),
 ('P3 la Direction peut modifier le personnel', roles, "  [RoleCode.Direction]: [\n    g('hr.employee.read', All),", "  [RoleCode.Direction]: [\n    g('hr.employee.read', All), g('hr.employee.update', All),", 'unit'),
 ('P4 le chargé de compte voit tout le personnel', roles, "  [RoleCode.AccountManager]: [\n    g('hr.employee.read', Own),", "  [RoleCode.AccountManager]: [\n    g('hr.employee.read', All),", 'unit'),
 ('P5 le Responsable commercial voit tout le personnel', roles, "  [RoleCode.HeadOfSales]: [\n    g('hr.employee.read', Team),", "  [RoleCode.HeadOfSales]: [\n    g('hr.employee.read', All),", 'unit'),
 # --- Interface
 ('W1 interface : matricule n’importe lequel', wlib, "const MATRICULE = /^[A-Z0-9][A-Z0-9._/-]{0,29}$/;", "const MATRICULE = /^.*$/;", 'web'),
 ('W2 interface : service facultatif', wlib, ", ['department', 'Le service', 100]];", "];", 'web'),
 ('W3 interface : sortie avant l’entrée acceptée', wlib, "else if (date < hiredOn) errors.leftOn", "else if (false) errors.leftOn", 'web'),
 ('W4 interface : responsable retiré non envoyé à la modification', wlib, "body.managerEmployeeId = form.managerEmployeeId || null;", "body.managerEmployeeId = form.managerEmployeeId;", 'web'),
 ('W5 interface : une boucle fait disparaître des personnes', wlib, "if (parent && !isAncestor(nodes, node.entry.id, parent.entry.id)) parent.reports.push(node);", "if (parent) parent.reports.push(node);", 'web'),
 ('W6 interface : réintégration proposée sans le droit', wlib, "if (rights.archive) actions.push('reactivate');", "actions.push('reactivate');", 'web'),
 ('W7 interface : Personnel proposé aux portées Propre et Équipe', wmod, "permission: 'hr.employee.read', allScope: true }", "permission: 'hr.employee.read' }", 'web'),
 ('W8 interface : portée Tous non distinguée', wperm, "grant.code === permission && grant.scope === 'ALL'", "grant.code === permission", 'web'),
 # --- Jeu de démonstration
 ('S1 chargement par blocs : le bloc rh est toujours rechargé', seedrun, "rh: (await prisma.db.employee.count({ where: { workEmail: { endsWith: RH_EMAIL_DOMAIN } } })) > 0,", "rh: false,", 'db:seed-demo'),
 ('S2 chargement par blocs : une fiche est classée dans le bloc commercial', seedplan, "if (op.k === 'employee' || op.k === 'employeeLeave') return 'rh';", "if (op.k === 'employeeLeave') return 'rh';", 'unit'),
]
only = sys.argv[1:]
if only:
    M = [m for m in M if m[0].split(' ')[0] in only]
env = dict(os.environ, TEST_DB_PORT='54480')


def read(path):
    raw = open(path, 'rb').read()
    return raw, raw.decode('utf8')


if os.environ.get('DRY'):
    bad = 0
    for name, path, a, b, kind in M:
        text = read(path)[1].replace('\r\n', '\n')
        n = text.count(a)
        if n != 1:
            bad += 1
        print(name, 'ok' if n == 1 else f'MOTIF {n}')
    print('MOTIFS INVALIDES' if bad else 'tous les motifs sont uniques', bad)
    sys.exit(0)


def run(kind):
    if kind == 'unit':
        out = subprocess.run('pnpm exec jest src/modules/hr src/modules/iam/domain/roles src/cli/seed --silent', cwd=api, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True, timeout=900, shell=True).stdout
    elif kind == 'web':
        out = subprocess.run('pnpm exec vitest run test/n7-hr.test.ts test/n1-navigation.test.ts test/s38.test.ts', cwd=web, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True, timeout=600, shell=True).stdout
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
        killed = run(kind)
    except AssertionError as e:
        print(name, 'INCONCLUANT', str(e)[:200], flush=True)
        killed = None
    finally:
        open(path, 'wb').write(raw)
    res.append((name, killed))
    print(name, {True: 'TUÉ', False: 'SURVIVANT', None: 'INCONCLUANT'}[killed], flush=True)
print('BILAN', sum(1 for _, k in res if k), '/', len(res), 'tués ;', [n for n, k in res if k is False], 'survivants ;', [n for n, k in res if k is None], 'inconcluants')
